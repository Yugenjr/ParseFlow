const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const { createClerkClient } = require('@clerk/backend');
const { connectDB } = require('./config/db');
const User = require('./models/User');
const Document = require('./models/Document');
const QueryEvent = require('./models/QueryEvent');
const Notification = require('./models/Notification');
const authMiddleware = require('./middleware/authMiddleware');
const { encrypt } = require('./utils/encryption');
const { generateFileHash } = require('./utils/hash');
const { uploadFileToCloudinary } = require('./utils/cloudinaryUpload');
const { analyzeImageWithLLM } = require('./services/visionLLM');
const { askGuideBot } = require('./services/guidebotService');
const { convertPdfToImages, cleanupFiles } = require('./services/pdfService');
const { createNotification } = require('./services/notificationService');
const { sendEmail } = require('./services/emailService');
const { createGoogleAuthUrl, getOAuthClient, uploadToDrive } = require('./services/driveService');
const notificationRoutes = require('./routes/notifications');
const fileRoutes = require('./routes/files');
const { startWeeklySummaryJob } = require('./cron/weeklySummary');

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (no origin) and known web/capacitor origins.
    if (!origin) return callback(null, true);

    const allowed = [
      /^http:\/\/localhost(?::\d+)?$/,
      /^capacitor:\/\/localhost$/,
      /^ionic:\/\/localhost$/,
      /^http:\/\/10\.0\.111\.131(?::\d+)?$/,
    ];

    if (allowed.some((rule) => rule.test(origin))) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  credentials: true,
};

const STORAGE_ROOT = path.resolve(path.join(__dirname, '..', '..', 'storage'));

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(fileRoutes);

// Serve files from storage directory for fallback local file access
app.use('/files', express.static(STORAGE_ROOT));

// Store uploads in backend/uploads (one level above src)
const UPLOADS_DIR = path.resolve(path.join(__dirname, '..', 'uploads'));
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const createCleanup = require('./services/cleanupService');
const cleanup = createCleanup({ uploadsDir: UPLOADS_DIR, intervalMs: 60000 });

const upload = multer({ dest: UPLOADS_DIR });
const clerkClient = process.env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  : null;

// Robust file mover: try rename, retry on transient errors, fallback to copy+unlink
async function safeMoveFile(src, dest) {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fs.promises.rename(src, dest);
      return;
    } catch (err) {
      // If it's a transient or cross-device error, try copy+unlink
      if (err && (err.code === 'EXDEV' || err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES')) {
        try {
          await fs.promises.copyFile(src, dest);
          // attempt to unlink with retries, but don't fail the whole flow if unlink fails
          let unlinked = false;
          for (let u = 0; u < 5; u++) {
            try {
              await fs.promises.unlink(src);
              unlinked = true;
              break;
            } catch (unlinkErr) {
              // if last attempt, log and continue without throwing
              if (u === 4) {
                console.error('safeMoveFile: failed to unlink source after copy (will keep original):', src, unlinkErr && (unlinkErr.message || unlinkErr));
                // schedule background cleanup for the leftover source
                try { cleanup.enqueueDelete(src); } catch (e) { console.error('safeMoveFile: enqueueDelete failed', e && e.message); }
              }
              // small backoff
              await new Promise(r => setTimeout(r, 100 * (u + 1)));
            }
          }
          // if copy succeeded but we couldn't remove original, ensure background job exists
          if (!unlinked) {
            try { cleanup.enqueueDelete(src); } catch (e) { /* best-effort */ }
          }
          return; // success (dest has file); even if original wasn't removed, proceed
        } catch (copyErr) {
          if (attempt === maxRetries - 1) throw copyErr;
          // wait a bit then retry
          await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
          continue;
        }
      }
      // non-recoverable
      throw err;
    }
  }
}

const ML_SERVICE_BASE_URL = (process.env.ML_API_URL || 'http://localhost:8001').replace(/\/+$/, '');
const ML_SERVICE_URLS = ML_SERVICE_BASE_URL.endsWith('/predict')
  ? [ML_SERVICE_BASE_URL]
  : [`${ML_SERVICE_BASE_URL}/predict`, ML_SERVICE_BASE_URL];
const STORAGE_LIMIT_MB = 20;
const STORAGE_ALERTS = [
  { threshold: 70, message: 'You have used 70% of your storage' },
  { threshold: 90, message: 'You have almost reached your storage limit' },
  { threshold: 100, message: 'Storage limit reached. Uploads are blocked' }
];

const CONFIDENCE_THRESHOLD_PERCENT = 97;
const ALLOWED_CATEGORIES = new Set(['Identity', 'Financial', 'Legal', 'Compliance', 'Tax', 'Business', 'Other']);
const DOCBOT_GROQ_API_URL = process.env.DOCBOT_GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const DOCBOT_GROQ_MODEL = process.env.DOCBOT_GROQ_MODEL || 'llama-3.1-8b-instant';
const DOCBOT_GROQ_API_KEY = process.env.DOCBOT_GROQ_API_KEY || process.env.GUIDEBOT_GROQ_API_KEY || process.env.GROQ_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://10.0.111.131:5173';
const GOOGLE_OAUTH_STATE_SECRET = process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.CLERK_SECRET_KEY || 'parseflow-google-state-dev-secret';

console.log('USING CLIENT:', process.env.GOOGLE_CLIENT_ID);
console.log('ML endpoints configured:', ML_SERVICE_URLS);

async function callMlService(filePath) {
  let lastError = null;
  for (const url of ML_SERVICE_URLS) {
    try {
      console.log('Calling ML service at:', url, 'with file:', filePath);
      
      // Final verification: ensure file exists and is readable
      try {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          throw new Error('File size is 0 - file may not have been fully written');
        }
        console.log('ML: File exists and has size:', stats.size);
      } catch (checkErr) {
        console.error('ML: File check failed before posting:', checkErr.message);
        throw checkErr;
      }

      const resp = await axios.post(
        url,
        { file_path: filePath },
        { timeout: 30000 }
      );
      return { response: resp, endpoint: url };
    } catch (err) {
      lastError = err;
      console.error('ML attempt failed for endpoint', url, err?.response?.data || err.message || err);
    }
  }
  throw lastError || new Error('All ML endpoint attempts failed');
}

function normalizeConfidencePercent(value) {
  if (value === null || value === undefined) return 0;

  let num = value;
  if (typeof num === 'string') {
    const cleaned = num.replace('%', '').trim();
    num = Number(cleaned);
  }

  if (!Number.isFinite(num)) return 0;

  if (num > 0 && num <= 1) {
    num = num * 100;
  }

  if (num < 0) return 0;
  if (num > 100) return 100;
  return Math.round(num);
}

function getDocTypeFromVisionResult(visionRes) {
  return (visionRes && (visionRes.document_type || visionRes.documentType || visionRes.type || visionRes.label)) || null;
}

function isUnknownDocType(docType) {
  if (!docType) return true;
  const val = String(docType).trim().toLowerCase();
  return val === '' || val === 'unknown' || val.includes('unknown');
}

function isIdentityClass(cls) {
  if (!cls) return false;
  const s = String(cls).toLowerCase();
  return s.includes('aadhar') || s.includes('aadhaar') || s.includes('pan') || s.includes('passport') || s.includes('driving') || s.includes('license') || s.includes('licence');
}

function cleanFolderName(docType) {
  if (!docType) return 'Other/Unknown';
  const t = String(docType).replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = t.split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1));
  return (isIdentityClass(docType) ? 'Identity/' : 'Other/') + parts.join('_');
}

async function backfillClerkUsersToMongo() {
  if (!clerkClient) {
    console.warn('Skipping Clerk backfill: CLERK_SECRET_KEY is not configured.');
    return;
  }

  const limit = 100;
  let offset = 0;
  let synced = 0;

  while (true) {
    const page = await clerkClient.users.getUserList({ limit, offset });
    const users = (page && page.data) || [];
    if (users.length === 0) break;

    for (const cu of users) {
      const primaryEmail = cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId);
      const email = primaryEmail ? primaryEmail.emailAddress : (cu.emailAddresses[0] && cu.emailAddresses[0].emailAddress) || null;
      const fullName = [cu.firstName, cu.lastName].filter(Boolean).join(' ').trim();
      const name = fullName || cu.username || null;

      await User.updateOne(
        { clerkId: cu.id },
        {
          $set: {
            email,
            name
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
      synced += 1;
    }

    if (users.length < limit) break;
    offset += limit;
  }

  console.log(`Clerk backfill complete. Synced users: ${synced}`);
}

async function upsertUserFromAuth(req) {
  if (!req.userId) {
    throw new Error('Missing authenticated user id');
  }

  let email = req.userEmail || null;
  let name = null;

  if (clerkClient) {
    try {
      const clerkUser = await clerkClient.users.getUser(req.userId);
      if (!email) {
        const primaryEmail = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
        email = primaryEmail ? primaryEmail.emailAddress : null;
      }
      const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();
      name = fullName || clerkUser.username || null;
    } catch (err) {
      console.warn('Unable to enrich Clerk user profile:', err && (err.message || err));
    }
  }

  let user = await User.findOne({ clerkId: req.userId });
  if (!user) {
    user = await User.create({
      clerkId: req.userId,
      email,
      name
    });
  } else {
    if (email && user.email !== email) user.email = email;
    if (name && user.name !== name) user.name = name;
    await user.save();
  }

  return user;
}

function signGoogleOauthState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', GOOGLE_OAUTH_STATE_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifyGoogleOauthState(stateToken) {
  if (!stateToken || typeof stateToken !== 'string' || !stateToken.includes('.')) {
    throw new Error('Invalid OAuth state');
  }

  const [body, sig] = stateToken.split('.');
  if (!body || !sig) {
    throw new Error('Invalid OAuth state token format');
  }

  const expected = crypto
    .createHmac('sha256', GOOGLE_OAUTH_STATE_SECRET)
    .update(body)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('OAuth state signature mismatch');
  }

  const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!decoded || !decoded.userId || !decoded.exp || Date.now() > Number(decoded.exp)) {
    throw new Error('OAuth state is expired or malformed');
  }

  return decoded;
}

async function maybeSyncDocumentToGoogleDrive({ req, savedDoc, category, docType }) {
  try {
    const userDoc = await User.findOne({ clerkId: req.userId });
    if (!userDoc || !userDoc.googleDrive || !userDoc.googleDrive.connected) {
      return null;
    }

    const synced = await uploadToDrive({
      filePath: savedDoc.filePath,
      fileName: savedDoc.filename,
      userId: req.userId,
      category,
      docType,
      userDoc,
    });

    savedDoc.storage = savedDoc.storage || {};
    // Preserve the Cloudinary URL
    const cloudinaryUrl = savedDoc.storage.fileUrl;
    savedDoc.storage.googleDrive = {
      fileId: synced.fileId,
      fileUrl: synced.fileUrl,
    };
    savedDoc.storage.googleDriveUrl = synced.fileUrl || null;
    // Restore Cloudinary URL if it was set
    if (cloudinaryUrl && /^https?:\/\//.test(cloudinaryUrl)) {
      savedDoc.storage.fileUrl = cloudinaryUrl;
    }
    savedDoc.markModified('storage');
    await savedDoc.save();

    return synced;
  } catch (err) {
    console.error('Google Drive sync failed (non-blocking):', err && (err.message || err));
    return null;
  }
}

function buildUploadSuccessResponse({ savedDoc, result }) {
  const docObj = savedDoc.toObject();
  const localPath = savedDoc.filePath;
  const googleDriveUrl =
    (savedDoc.storage && (savedDoc.storage.googleDriveUrl || (savedDoc.storage.googleDrive && savedDoc.storage.googleDrive.fileUrl))) ||
    null;

  return {
    success: true,
    document: { ...docObj, fileUrl: getFileUrl(savedDoc) },
    result,
    storage: {
      localPath,
      googleDriveUrl,
    },
  };
}

function deriveCategory(result) {
  const explicit = normalizeCategory(result && result.category);
  if (explicit) return explicit;

  const inferredFromResult = inferCategoryFromResult(result);
  if (inferredFromResult) return inferredFromResult;

  const docType = deriveDocType(result);
  const inferred = inferCategoryFromDocType(docType);
  if (inferred) return inferred;

  // If we cannot confidently map doc type to a supported category,
  // force it into Other (while preserving predicted doc type folder name).
  return 'Other';
}

function inferCategoryFromResult(result) {
  const merged = [
    String((result && result.document_type) || ''),
    String((result && result.folder) || ''),
    String((result && result.extracted_text) || ''),
    JSON.stringify((result && result.key_fields) || {})
  ].join(' ').toLowerCase();

  if (!merged.trim()) return null;

  if (/(aadhaar|aadhar|pan|passport|driving|license|licence|voter\s*id|identity\s*card)/.test(merged)) return 'Identity';
  if (/(train\s*ticket|railway\s*ticket|rail\s*ticket|metro\s*ticket|bus\s*ticket|flight\s*ticket|pnr\b|itinerary|travel\s*booking|expense\s*voucher|payment\s*receipt|invoice|receipt|bank\s*statement|transaction\s*slip|salary\s*slip)/.test(merged)) return 'Financial';
  if (/(compliance|conformity|certificate\s*of\s*compliance|regulatory|csa\s*international|\bce\b|\bfcc\b)/.test(merged)) return 'Compliance';
  if (/(gstr|gst|itr|form\s*16|tax|t[ -]?ds|challan)/.test(merged)) return 'Tax';
  if (/(agreement|contract|legal|deed|affidavit|notice)/.test(merged)) return 'Legal';
  if (/(registration|incorporation|msme|udyam|business|company)/.test(merged)) return 'Business';
  if (merged.includes('unknown')) return 'Other';

  return null;
}

function deriveDocType(result) {
  const raw = (result && result.document_type) || 'Unknown';
  const normalized = String(raw).trim() || 'Unknown';
  const specificFromContent = inferSpecificDocTypeFromContent(result);

  // Replace generic tax labels with specific form names when detected from OCR/folder text.
  const genericTaxLabels = new Set(['tax document', 'gst document', 'gst return', 'tax return']);
  if (specificFromContent && (genericTaxLabels.has(normalized.toLowerCase()) || normalized.toLowerCase().includes('tax'))) {
    return specificFromContent;
  }

  return normalized;
}

function inferSpecificDocTypeFromContent(result) {
  const merged = [
    String((result && result.document_type) || ''),
    String((result && result.folder) || ''),
    String((result && result.extracted_text) || ''),
    JSON.stringify((result && result.key_fields) || {})
  ].join(' ').toLowerCase();

  if (/(gstr\s*[- ]?3b|form\s*gstr\s*[- ]?3b)/.test(merged)) return 'GSTR 3B';
  if (/(gstr\s*[- ]?1|form\s*gstr\s*[- ]?1)/.test(merged)) return 'GSTR 1';
  if (/(form\s*16|form16)/.test(merged)) return 'Form 16';
  if (/(itr|income\s*tax\s*return)/.test(merged)) return 'ITR Acknowledgment';
  if (/(challan|gst\s*challan)/.test(merged)) return 'GST Challan';

  return null;
}

function normalizeCategory(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  const aliases = {
    identity: 'Identity',
    id: 'Identity',
    financial: 'Financial',
    finance: 'Financial',
    legal: 'Legal',
    compliance: 'Compliance',
    tax: 'Tax',
    taxation: 'Tax',
    business: 'Business',
    other: 'Other'
  };

  if (aliases[lowered]) return aliases[lowered];
  return ALLOWED_CATEGORIES.has(raw) ? raw : null;
}

function inferCategoryFromDocType(docType) {
  const t = String(docType || '').toLowerCase();
  if (!t) return null;
  if (/(aadhaar|aadhar|pan|passport|driving|license|licence|voter|id\b)/.test(t)) return 'Identity';
  if (/(invoice|receipt|bill|bank|statement|salary|pay\s*slip|train\s*ticket|railway\s*ticket|rail\s*ticket|metro\s*ticket|bus\s*ticket|flight\s*ticket|pnr|itinerary|travel\s*booking|expense\s*voucher|transaction\s*slip)/.test(t)) return 'Financial';
  if (/(compliance|conformity|certificate\s*of\s*compliance|regulatory|csa\s*international|\bce\b|\bfcc\b)/.test(t)) return 'Compliance';
  if (/(gstr|gst|itr|form\s*16|tax|t[ -]?ds)/.test(t)) return 'Tax';
  if (/(agreement|contract|legal|deed|affidavit)/.test(t)) return 'Legal';
  if (/(registration|incorporation|msme|business|company)/.test(t)) return 'Business';
  if (t.includes('unknown')) return 'Other';
  return null;
}

function createStorageTarget({ userId, result, filename }) {
  const category = deriveCategory(result) || 'Other';
  const docTypeRaw = deriveDocType(result);
  const docType = String(docTypeRaw || 'Unknown')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .replace(/\s+/g, '_') || 'Unknown';
  const targetDir = path.resolve(path.join(__dirname, '..', '..', 'storage', userId, category, docType));
  const targetPath = path.join(targetDir, filename);
  return { category, docType, targetDir, targetPath };
}

function makeFileUrl(filePathAbs) {
  const relative = path.relative(STORAGE_ROOT, filePathAbs).split(path.sep).join('/');
  return `/files/${relative}`;
}

function getFileUrl(doc) {
  // Prefer Cloudinary URL if available, otherwise fall back to local file URL
  if (doc.storage && doc.storage.fileUrl && /^https?:\/\//.test(doc.storage.fileUrl)) {
    return doc.storage.fileUrl;
  }
  // Fall back to local file URL
  return makeFileUrl(doc.filePath);
}

function listFilesRecursive(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else out.push(path.resolve(p));
    }
  }

  return out;
}

function inferFromStoragePath(userId, filePathAbs) {
  const rel = path.relative(path.join(STORAGE_ROOT, userId), filePathAbs).split(path.sep);
  const category = rel[0] || 'Other';
  const docType = rel[1] || 'Unknown';
  const document_type = String(docType).replace(/_/g, ' ');
  return { category, docType, document_type };
}

async function syncStorageForUser(userId) {
  const userRoot = path.join(STORAGE_ROOT, userId);
  const files = listFilesRecursive(userRoot);
  let created = 0;
  let updated = 0;

  for (const filePathAbs of files) {
    const filename = path.basename(filePathAbs);
    const inferred = inferFromStoragePath(userId, filePathAbs);
    const fileUrl = makeFileUrl(filePathAbs);

    const existing = await Document.findOne({ userId, filePath: filePathAbs });
    if (!existing) {
      await Document.create({
        userId,
        filename,
        filePath: filePathAbs,
        document_type: inferred.document_type,
        category: inferred.category,
        accuracy: 0,
        confidence: 0,
        method: 'Storage Sync',
        metadata: {},
        storage: {
          category: inferred.category,
          docType: inferred.docType,
          filePath: filePathAbs,
          fileUrl
        },
        classification: {
          document_type: inferred.document_type,
          category: inferred.category,
          accuracy: 0,
          confidence: 0,
          method: 'Storage Sync'
        }
      });
      created += 1;
      continue;
    }

    let changed = false;
    if (!existing.storage || !existing.storage.filePath) {
      existing.storage = {
        category: inferred.category,
        docType: inferred.docType,
        filePath: filePathAbs,
        fileUrl
      };
      changed = true;
    }
    if (!existing.classification || !existing.classification.document_type) {
      existing.classification = {
        document_type: existing.document_type || inferred.document_type,
        category: existing.category || inferred.category,
        accuracy: Number(existing.accuracy || 0),
        confidence: Number(existing.confidence || 0),
        method: existing.method || 'Storage Sync'
      };
      changed = true;
    }
    if (!existing.category) {
      existing.category = inferred.category;
      changed = true;
    }
    if (!existing.document_type) {
      existing.document_type = inferred.document_type;
      changed = true;
    }
    if (changed) {
      await existing.save();
      updated += 1;
    }
  }

  return { userId, scanned: files.length, created, updated };
}

async function syncAllExistingStorageForUsers() {
  const userIds = new Set();
  const users = await User.find({}, { clerkId: 1 }).lean();
  for (const u of users) {
    if (u && u.clerkId) userIds.add(String(u.clerkId));
  }

  const storageEntries = fs.existsSync(STORAGE_ROOT)
    ? fs.readdirSync(STORAGE_ROOT, { withFileTypes: true })
    : [];
  for (const entry of storageEntries) {
    if (entry.isDirectory()) userIds.add(entry.name);
  }

  let totalScanned = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  for (const userId of userIds) {
    const result = await syncStorageForUser(userId);
    totalScanned += result.scanned;
    totalCreated += result.created;
    totalUpdated += result.updated;
  }

  console.log(`Storage sync complete. users=${userIds.size}, scanned=${totalScanned}, created=${totalCreated}, updated=${totalUpdated}`);
}

async function persistDocumentForUser({ req, result, filePath }) {
  const category = deriveCategory(result);
  const docType = deriveDocType(result).replace(/\s+/g, '_');
  const fileUrl = makeFileUrl(filePath);
  const accuracy = normalizeConfidencePercent(result && (result.accuracy ?? result.confidence));
  const confidence = normalizeConfidencePercent(result && result.confidence);
  const processingTimeMs = Number(result && result.processing_time_ms) > 0
    ? Math.round(Number(result.processing_time_ms))
    : 0;
  const isVision = String((result && result.method) || '').toLowerCase().includes('vision');
  const extractedText = isVision ? String((result && result.extracted_text) || '') : '';
  const llmAnalysis = isVision
    ? {
      summary: String((result && result.summary) || ''),
      key_fields: (result && result.key_fields) || {}
    }
    : {};

  let fileHash = '';
  try {
    const fileBuffer = fs.readFileSync(filePath);
    fileHash = generateFileHash(fileBuffer);
  } catch (err) {
    console.error('File hash generation failed:', err && (err.message || err));
  }

  const encryptedData = encrypt({
    extracted_text: extractedText,
    key_fields: (result && result.key_fields) || {},
    llm_analysis: llmAnalysis,
    classification: {
      document_type: deriveDocType(result),
      category,
      accuracy,
      confidence,
      method: (result && result.method) || 'Unknown'
    }
  });

  return Document.create({
    userId: req.userId,
    filename: req.file.originalname,
    filePath,
    document_type: deriveDocType(result),
    category,
    accuracy,
    confidence,
    processing_time_ms: processingTimeMs,
    method: (result && result.method) || 'Unknown',
    metadata: (result && result.key_fields) || {},
    extracted_text: extractedText,
    encryptedData,
    fileHash,
    llm_analysis: llmAnalysis,
    storage: {
      category,
      docType,
      localPath: filePath,
      filePath,
      fileUrl
    },
    classification: {
      document_type: deriveDocType(result),
      category,
      accuracy,
      confidence,
      method: (result && result.method) || 'Unknown'
    }
  });
}

function getStorageUsedMB(files) {
  let totalBytes = 0;
  for (const doc of files) {
    try {
      if (doc.filePath && fs.existsSync(doc.filePath)) {
        totalBytes += fs.statSync(doc.filePath).size;
      }
    } catch {
      // Ignore file read errors for usage calculation.
    }
  }
  return totalBytes / (1024 * 1024);
}

async function calculateStorageUsage(userId) {
  const files = await Document.find({ userId }).select({ filePath: 1 }).lean();
  const usedMB = getStorageUsedMB(files);
  const percentage = (usedMB / STORAGE_LIMIT_MB) * 100;
  return { usedMB, percentage };
}

async function notifyStorageThresholds(userId, email) {
  const { percentage } = await calculateStorageUsage(userId);
  const roundedPercentage = Math.round(percentage);

  for (const alert of STORAGE_ALERTS) {
    if (percentage < alert.threshold) continue;

    const alreadySent = await Notification.findOne({
      userId,
      type: 'STORAGE',
      message: alert.message
    }).lean();

    if (alreadySent) continue;

    await createNotification(userId, alert.message, 'STORAGE');
    await sendEmail(
      email,
      'ParseFlow Storage Alert',
      `You have used ${roundedPercentage}% of your storage.`
    );
  }
}

async function resolveUserEmail(userId, tokenEmail) {
  if (tokenEmail) return tokenEmail;

  if (clerkClient) {
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      const primaryEmail = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
      if (primaryEmail && primaryEmail.emailAddress) {
        return primaryEmail.emailAddress;
      }
      if (clerkUser.emailAddresses[0] && clerkUser.emailAddresses[0].emailAddress) {
        return clerkUser.emailAddresses[0].emailAddress;
      }
    } catch (err) {
      console.warn('Unable to resolve user email from Clerk:', err && (err.message || err));
    }
  }

  const dbUser = await User.findOne({ clerkId: userId }).select({ email: 1 }).lean();
  return (dbUser && dbUser.email) || null;
}

async function persistAndNotify({ req, result, filePath }) {
  console.log('\n=== persistAndNotify START ===');
  console.log('File path:', filePath);
  console.log('Result:', result);
  
  const savedDoc = await persistDocumentForUser({ req, result, filePath });
  console.log('Document created with ID:', savedDoc._id);
  console.log('Initial storage.fileUrl:', savedDoc.storage?.fileUrl);
  
  const category = deriveCategory(result);
  const storageDocType = (savedDoc.storage && savedDoc.storage.docType) || deriveDocType(result).replace(/\s+/g, '_');

  console.log('Category:', category);
  console.log('StorageDocType:', storageDocType);

  // Upload file to Cloudinary and update the document with the Cloudinary URL
  let cloudinaryUrl = null;
  try {
    console.log('\n--- Starting Cloudinary upload ---');
    console.log('Uploading file to Cloudinary:', filePath);
    const cloudinaryFolder = `users/${req.userId}/${category}/${storageDocType}`;
    console.log('Cloudinary folder:', cloudinaryFolder);
    
    const cloudinaryResult = await uploadFileToCloudinary({
      filePath,
      folder: cloudinaryFolder,
      originalFilename: savedDoc.filename
    });
    
    console.log('Cloudinary result:', cloudinaryResult);
    
    if (cloudinaryResult && cloudinaryResult.secure_url) {
      cloudinaryUrl = cloudinaryResult.secure_url;
      console.log('✓ File uploaded to Cloudinary successfully:', cloudinaryUrl);

      // Update the document with the Cloudinary URL using explicit field assignment
      if (!savedDoc.storage) {
        savedDoc.storage = {};
      }
      console.log('Before update - savedDoc.storage.fileUrl:', savedDoc.storage.fileUrl);
      
      savedDoc.storage.fileUrl = cloudinaryUrl;
      savedDoc.storage.cloudinaryPublicId = cloudinaryResult.public_id;
      
      console.log('After assignment - savedDoc.storage.fileUrl:', savedDoc.storage.fileUrl);
      
      // Mark the storage field as modified for Mongoose
      savedDoc.markModified('storage');
      console.log('Marked storage as modified');
      
      await savedDoc.save();
      console.log('✓ Document saved');
      console.log('After save - savedDoc.storage.fileUrl:', savedDoc.storage.fileUrl);
      console.log('✓ Document updated with Cloudinary URL:', savedDoc._id, 'URL:', savedDoc.storage.fileUrl);
    } else {
      console.log('Cloudinary not configured or returned null, using local storage URL');
    }
  } catch (cloudinaryErr) {
    console.error('❌ Cloudinary upload failed (non-blocking):', cloudinaryErr && (cloudinaryErr.message || cloudinaryErr));
    console.error('Stack:', cloudinaryErr && cloudinaryErr.stack);
    // Continue with local storage URL if Cloudinary upload fails
    // The local file is already in storage, so the document is still accessible
  }

  console.log('\n--- Before Google Drive sync ---');
  console.log('Final savedDoc.storage.fileUrl before Google Drive:', savedDoc.storage?.fileUrl);

  await maybeSyncDocumentToGoogleDrive({
    req,
    savedDoc,
    category,
    docType: storageDocType,
  });

  console.log('--- After Google Drive sync ---');
  console.log('Final savedDoc.storage.fileUrl after Google Drive:', savedDoc.storage?.fileUrl);

  try {
    const docType = deriveDocType(result);
    const notificationDocType = (savedDoc.storage && savedDoc.storage.docType) || docType.replace(/\s+/g, '_');

    await createNotification(req.userId, `Upload successful: ${savedDoc.filename}`, 'ORGANIZATION');
    await createNotification(req.userId, `We detected a ${docType}`, 'INSIGHT');
    await createNotification(
      req.userId,
      `Your document has been categorized under ${category}/${notificationDocType}`,
      'ORGANIZATION'
    );

    const userEmail = await resolveUserEmail(req.userId, req.userEmail);
    await notifyStorageThresholds(req.userId, userEmail);
  } catch (notifyErr) {
    console.error('Notification flow failed:', notifyErr && (notifyErr.message || notifyErr));
  }

  // Reload document from DB to get latest state with all updates
  console.log('\n--- Reloading document from DB ---');
  const finalDoc = await Document.findById(savedDoc._id);
  console.log('Final doc storage.fileUrl after reload:', finalDoc?.storage?.fileUrl);
  console.log('=== persistAndNotify END ===\n');
  
  return finalDoc || savedDoc;
}

app.use('/notifications', notificationRoutes);
app.use('/upload', authMiddleware);

app.post('/api/auth/sync-user', authMiddleware, async (req, res) => {
  try {
    if (!clerkClient) {
      return res.status(500).json({ error: 'CLERK_SECRET_KEY is not configured' });
    }

    const user = await upsertUserFromAuth(req);

    return res.json({
      message: 'User synced',
      userId: user.clerkId
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'User sync failed' });
  }
});

app.get('/api/google-drive/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ clerkId: req.userId }).lean();
    const connected = Boolean(user && user.googleDrive && user.googleDrive.connected);
    return res.json({ connected });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch Google Drive status' });
  }
});

app.get('/api/google-drive/auth-url', authMiddleware, async (req, res) => {
  try {
    await upsertUserFromAuth(req);
    const state = signGoogleOauthState({
      userId: req.userId,
      exp: Date.now() + 10 * 60 * 1000,
    });
    const url = `${process.env.APP_BASE_URL || 'http://10.0.111.131:5000'}/auth/google?state=${encodeURIComponent(state)}`;
    return res.json({ url });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to initialize Google OAuth' });
  }
});

app.get('/auth/google', async (req, res) => {
  try {
    const state = String((req.query && req.query.state) || '');
    verifyGoogleOauthState(state);
    const url = createGoogleAuthUrl(state);
    return res.redirect(url);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to start Google OAuth' });
  }
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const code = req.query && req.query.code;
    const state = req.query && req.query.state;
    if (!code || !state) {
      return res.status(400).send('Missing Google OAuth callback parameters');
    }

    const statePayload = verifyGoogleOauthState(String(state));
    const oauth2Client = getOAuthClient();
    const tokenResp = await oauth2Client.getToken(String(code));
    const tokens = (tokenResp && tokenResp.tokens) || {};

    const user = await User.findOne({ clerkId: statePayload.userId });
    if (!user) {
      return res.status(404).send('User not found for Google Drive connection');
    }

    user.googleDrive = {
      connected: true,
      access_token: tokens.access_token || (user.googleDrive && user.googleDrive.access_token) || null,
      refresh_token: tokens.refresh_token || (user.googleDrive && user.googleDrive.refresh_token) || null,
      token_expiry_date: tokens.expiry_date || null,
    };
    await user.save();

    return res.redirect(`${FRONTEND_URL}/settings?drive=connected`);
  } catch (err) {
    console.error('Google OAuth callback failed:', err && (err.message || err));
    return res.redirect(`${FRONTEND_URL}/settings?drive=error`);
  }
});

function getDocbotFilteredDocs(question, docs) {
  const q = String(question || '').toLowerCase();
  const docText = (doc) => {
    const parts = [
      String(doc.filename || ''),
      String(doc.document_type || ''),
      String(doc.category || ''),
      JSON.stringify(doc.metadata || {}),
      JSON.stringify(doc.llm_analysis || {}),
      String(doc.extracted_text || '')
    ];
    return parts.join(' ').toLowerCase();
  };

  if (q.includes('aadhaar') || q.includes('aadhar')) {
    return docs.filter((doc) => {
      const hay = docText(doc);
      return hay.includes('aadhaar') || hay.includes('aadhar') || hay.includes('uid');
    });
  }
  if (q.includes('pan')) {
    return docs.filter((doc) => {
      const hay = docText(doc);
      return hay.includes(' pan ') || hay.includes('pan card') || hay.includes('permanent account number');
    });
  }
  if (q.includes('passport')) {
    return docs.filter((doc) => docText(doc).includes('passport'));
  }
  if (q.includes('invoice') || q.includes('bill') || q.includes('receipt')) {
    return docs.filter((doc) => {
      const hay = docText(doc);
      return hay.includes('invoice') || hay.includes('bill') || hay.includes('receipt');
    });
  }
  return docs;
}

function buildDocbotContext(docs) {
  const limitedDocs = docs.slice(0, 12);
  const context = limitedDocs.map((doc) => {
    const extracted = String(doc.extracted_text || '').slice(0, 2000);
    const structured = JSON.stringify(doc.llm_analysis || {}).slice(0, 1000);
    const metadata = JSON.stringify(doc.metadata || {}).slice(0, 1000);
    const classification = JSON.stringify(doc.classification || {}).slice(0, 500);
    return `Filename: ${doc.filename || 'Unknown'}\nDocument: ${doc.document_type}\nCategory: ${doc.category}\n\nExtracted Text:\n${extracted}\n\nStructured Data:\n${structured}\n\nMetadata:\n${metadata}\n\nClassification:\n${classification}`;
  }).join('\n\n');

  return context.slice(0, 12000);
}

function isDocumentDataQuery(question) {
  const q = String(question || '').toLowerCase();
  const docDataSignals = [
    'my pan', 'pan number', 'aadhaar', 'aadhar', 'uid', 'passport', 'license', 'licence',
    'document number', 'id number', 'invoice', 'receipt', 'amount', 'total', 'balance',
    'dob', 'date of birth', 'expiry', 'expir', 'what is in my', 'from my documents',
    'extract', 'metadata', 'field', 'number in', 'show my'
  ];
  return docDataSignals.some((k) => q.includes(k));
}

async function askDocBot({ question, context, mode }) {
  if (!DOCBOT_GROQ_API_KEY) {
    throw new Error('DOCBOT_GROQ_API_KEY is not configured');
  }

  const prompt = mode === 'documents'
    ? `You are DocBot.

You MUST answer ONLY using the provided documents.
Use values from Structured Data and Metadata first, then Extracted Text.
When possible, mention which filename the value came from.

If answer not found, say exactly:
"I couldn't find this in your documents."

Context:
${context}

Question:
${question}`
    : `You are DocBot, an interactive assistant inside ParseFlow.

Behavior:
- Be conversational, helpful, and guide users through ParseFlow features (upload, documents, history, export, settings).
- You can answer general product/navigation questions directly.
- If the question is ambiguous, ask one short clarifying follow-up.
- Keep answers concise and practical.

Optional Document Context (use only if relevant):
${context}

User Question:
${question}`;

  const response = await axios.post(
    DOCBOT_GROQ_API_URL,
    {
      model: DOCBOT_GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 600
    },
    {
      headers: {
        Authorization: `Bearer ${DOCBOT_GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  const answer = response && response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content;
  return String(answer || "I couldn't find this in your documents.").trim();
}

app.post('/api/guidebot/chat', authMiddleware, async (req, res) => {
  try {
    const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
    if (messages.length === 0) {
      return res.status(400).json({ error: 'messages are required' });
    }

    await QueryEvent.create({ userId: req.userId, source: 'GuideBot' });
    const reply = await askGuideBot(messages);
    return res.json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'GuideBot request failed' });
  }
});

async function handleDocbotQuery(req, res) {
  try {
    const question = String((req.body && req.body.question) || '').trim();
    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    await QueryEvent.create({ userId: req.userId, source: 'DocBot' });
    const docMode = isDocumentDataQuery(question);

    const allDocs = await Document.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();

    const filteredDocs = docMode ? getDocbotFilteredDocs(question, allDocs) : allDocs;
    const docsForContext = filteredDocs.length > 0 ? filteredDocs : allDocs;
    const context = buildDocbotContext(docsForContext);

    if (docMode && !context.trim()) {
      return res.json({
        answer: "I couldn't find this in your documents.",
        documents_used: 0
      });
    }

    const answer = await askDocBot({
      question,
      context,
      mode: docMode ? 'documents' : 'interactive'
    });

    const documentsUsed = docMode ? Math.min(docsForContext.length, 12) : 0;
    return res.json({
      answer: answer || "I couldn't find this in your documents.",
      documents_used: documentsUsed
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'DocBot query failed' });
  }
}

app.post('/api/docbot/query', authMiddleware, handleDocbotQuery);
app.post('/docbot/query', authMiddleware, handleDocbotQuery);

app.get('/api/documents', authMiddleware, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
    const docs = await Document.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const hydrated = docs.map((doc) => ({
      ...doc,
      accuracy: normalizeConfidencePercent(doc.accuracy ?? doc.confidence),
      confidence: normalizeConfidencePercent(doc.confidence),
      classification: {
        ...(doc.classification || {}),
        accuracy: normalizeConfidencePercent(doc.classification && (doc.classification.accuracy ?? doc.classification.confidence)),
        confidence: normalizeConfidencePercent(doc.classification && doc.classification.confidence)
      },
      fileUrl: getFileUrl(doc)
    }));

    return res.json({ documents: hydrated });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch documents' });
  }
});

app.get('/api/documents/preview', authMiddleware, async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid url parameter' });
    }

    const allowedHosts = new Set([
      'res.cloudinary.com',
      'localhost',
      '127.0.0.1',
      '10.0.111.131',
    ]);
    if (!allowedHosts.has(targetUrl.hostname)) {
      return res.status(400).json({ error: 'Unsupported preview host' });
    }

    const upstream = await axios.get(targetUrl.toString(), { responseType: 'stream' });
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store');

    upstream.data.on('error', (streamErr) => {
      console.error('Preview stream error:', streamErr && (streamErr.message || streamErr));
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream preview' });
      } else {
        res.destroy(streamErr);
      }
    });

    upstream.data.pipe(res);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to preview document' });
  }
});

app.get('/documents', authMiddleware, async (req, res) => {
  try {
    const docs = await Document.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    const hydrated = docs.map((doc) => ({
      ...doc,
      accuracy: normalizeConfidencePercent(doc.accuracy ?? doc.confidence),
      confidence: normalizeConfidencePercent(doc.confidence),
      classification: {
        ...(doc.classification || {}),
        accuracy: normalizeConfidencePercent(doc.classification && (doc.classification.accuracy ?? doc.classification.confidence)),
        confidence: normalizeConfidencePercent(doc.classification && doc.classification.confidence)
      },
      fileUrl: getFileUrl(doc)
    }));

    return res.json(hydrated);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch documents' });
  }
});

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const [timingAgg, queryCount] = await Promise.all([
      Document.aggregate([
        { $match: { userId: req.userId, processing_time_ms: { $gt: 0 } } },
        { $group: { _id: null, avgMs: { $avg: '$processing_time_ms' } } }
      ]),
      QueryEvent.countDocuments({ userId: req.userId })
    ]);

    const avgMs = timingAgg[0] && timingAgg[0].avgMs ? Number(timingAgg[0].avgMs) : 0;
    const avgProcessingTimeSec = avgMs > 0 ? Number((avgMs / 1000).toFixed(1)) : 0;

    return res.json({
      avgProcessingTimeSec,
      queryCount: Number(queryCount || 0)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch stats' });
  }
});

async function handleDeleteDocument(req, res) {
  try {
    const docId = decodeURIComponent(String(req.params.id || '').trim());
    if (!docId) {
      return res.status(400).json({ error: 'document id is required' });
    }

    if (!/^[a-fA-F0-9]{24}$/.test(docId)) {
      return res.status(400).json({ error: 'Invalid document id' });
    }

    // Delete DB record first so document is removed even if file unlink fails.
    const doc = await Document.findOneAndDelete({ _id: docId, userId: req.userId });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const absolutePath = path.resolve(doc.filePath || '');
    if (absolutePath && fs.existsSync(absolutePath)) {
      try {
        await fs.promises.unlink(absolutePath);
      } catch {
        // Best effort: DB record is already deleted.
      }
    }

    return res.json({ success: true, deletedId: String(doc._id) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete document' });
  }
}

app.delete('/api/documents/:id', authMiddleware, handleDeleteDocument);
app.delete('/documents/:id', authMiddleware, handleDeleteDocument);

app.post('/api/sync-storage', authMiddleware, async (req, res) => {
  try {
    const result = await syncStorageForUser(req.userId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Storage sync failed' });
  }
});

function sanitizeFolderPath(input) {
  const raw = String(input || '');
  const parts = raw
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/[^a-zA-Z0-9 _-]/g, ''))
    .filter(Boolean);

  if (parts.length < 2) return null;
  return parts.join('/');
}

app.post('/api/folders/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file required' });
    }

    const selectedFolder = sanitizeFolderPath(req.body && req.body.folder);
    if (!selectedFolder) {
      return res.status(400).json({ error: 'folder required in Category/Folder format' });
    }

    try {
      await upsertUserFromAuth(req);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to persist authenticated user' });
    }

    const uploadStartTs = Date.now();
    const originalPath = path.resolve(req.file.path);
    const folderParts = selectedFolder.split('/');
    const userRoot = path.resolve(path.join(STORAGE_ROOT, req.userId));
    const targetDir = path.resolve(path.join(userRoot, ...folderParts));

    // Block traversal and ensure all writes remain under this user's root.
    if (!targetDir.startsWith(userRoot)) {
      return res.status(400).json({ error: 'Invalid folder path' });
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, req.file.originalname);
    await safeMoveFile(originalPath, targetPath);

    // Verify file was moved successfully and has content
    try {
      const fileStats = fs.statSync(targetPath);
      if (fileStats.size === 0) {
        console.error('Folder upload resulted in empty file:', targetPath);
        return res.status(400).json({ error: 'File is empty after upload. Please try again.' });
      }
      console.log('Folder upload file verified: size =', fileStats.size, 'bytes');
    } catch (validateErr) {
      console.error('Folder upload file validation error:', validateErr && (validateErr.message || validateErr));
      return res.status(400).json({ error: 'File validation failed. Please try again.' });
    }

    const category = folderParts[0] || 'Other';
    const docTypePath = folderParts.slice(1).join('/');
    const docTypeLeaf = folderParts[folderParts.length - 1] || 'Manual Upload';
    const documentType = docTypeLeaf.replace(/_/g, ' ');
    const fileUrl = makeFileUrl(targetPath);

    let fileHash = '';
    try {
      const fileBuffer = fs.readFileSync(targetPath);
      fileHash = generateFileHash(fileBuffer);
    } catch (err) {
      console.error('Manual upload hash generation failed:', err && (err.message || err));
    }

    const manualResult = {
      document_type: documentType,
      category,
      folder: selectedFolder,
      accuracy: 0,
      confidence: 0,
      method: 'Manual Upload',
      extracted_text: '',
      key_fields: {},
      processing_time_ms: Date.now() - uploadStartTs
    };

    const savedDoc = await Document.create({
      userId: req.userId,
      filename: req.file.originalname,
      filePath: targetPath,
      document_type: documentType,
      category,
      accuracy: 0,
      confidence: 0,
      processing_time_ms: Number(manualResult.processing_time_ms) || 0,
      method: 'Manual Upload',
      metadata: {},
      extracted_text: '',
      encryptedData: encrypt({
        extracted_text: '',
        key_fields: {},
        llm_analysis: {},
        classification: {
          document_type: documentType,
          category,
          accuracy: 0,
          confidence: 0,
          method: 'Manual Upload'
        }
      }),
      fileHash,
      llm_analysis: {},
      storage: {
        category,
        docType: docTypePath,
        localPath: targetPath,
        filePath: targetPath,
        fileUrl
      },
      classification: {
        document_type: documentType,
        category,
        accuracy: 0,
        confidence: 0,
        method: 'Manual Upload'
      }
    });

    try {
      await createNotification(req.userId, `Manual upload successful: ${savedDoc.filename}`, 'ORGANIZATION');
      await createNotification(req.userId, `Stored under ${selectedFolder}`, 'ORGANIZATION');
    } catch (notifyErr) {
      console.error('Manual upload notification flow failed:', notifyErr && (notifyErr.message || notifyErr));
    }

    // Upload file to Cloudinary for manual uploads as well
    let cloudinaryUrl = null;
    try {
      console.log('Uploading manually uploaded file to Cloudinary:', targetPath);
      const cloudinaryFolder = `users/${req.userId}/${category}/${docTypeLeaf}`;
      const cloudinaryResult = await uploadFileToCloudinary({
        filePath: targetPath,
        folder: cloudinaryFolder,
        originalFilename: savedDoc.filename
      });
      
      if (cloudinaryResult && cloudinaryResult.secure_url) {
        cloudinaryUrl = cloudinaryResult.secure_url;
        console.log('Manual upload file uploaded to Cloudinary successfully:', cloudinaryUrl);

        // Update the document with the Cloudinary URL
        savedDoc.storage = savedDoc.storage || {};
        savedDoc.storage.fileUrl = cloudinaryUrl;
        savedDoc.storage.cloudinaryPublicId = cloudinaryResult.public_id;
        savedDoc.markModified('storage');
        await savedDoc.save();
        console.log('Manual upload document updated with Cloudinary URL:', cloudinaryUrl);
      } else {
        console.log('Cloudinary not configured, using local storage URL for manual upload');
      }
    } catch (cloudinaryErr) {
      console.error('Cloudinary upload for manual upload failed (non-blocking):', cloudinaryErr && (cloudinaryErr.message || cloudinaryErr));
      // Continue with local storage URL if Cloudinary upload fails
    }

    await maybeSyncDocumentToGoogleDrive({
      req,
      savedDoc,
      category,
      docType: docTypePath || documentType,
    });

    // Reload document from DB to get latest state with Cloudinary URL
    const reloadedDoc = await Document.findById(savedDoc._id);

    return res.json(buildUploadSuccessResponse({ savedDoc: reloadedDoc || savedDoc, result: manualResult }));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Manual folder upload failed' });
  }
});

app.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file required' });
    }

    try {
      await upsertUserFromAuth(req);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to persist authenticated user' });
    }

    const uploadStartTs = Date.now();

    const ext = path.extname(req.file.originalname || '').toLowerCase();
    let originalPath = path.resolve(req.file.path);

    // Multer temp files are extensionless by default; some PDF tools rely on .pdf extension.
    if (ext) {
      const currentExt = path.extname(originalPath).toLowerCase();
      if (!currentExt || currentExt !== ext) {
        const normalizedPath = `${originalPath}${ext}`;
        await safeMoveFile(originalPath, normalizedPath);
        originalPath = normalizedPath;
      }
    }

    // Verify file exists and has content
    try {
      const fileStats = fs.statSync(originalPath);
      if (fileStats.size === 0) {
        console.error('File upload resulted in empty file:', originalPath);
        return res.status(400).json({ error: 'File is empty after upload. Please try again.' });
      }
      console.log('File verified: size =', fileStats.size, 'bytes');

      // For JPG/PNG files, verify magic bytes to ensure valid image
      if ((ext === '.jpg' || ext === '.jpeg' || ext === '.png') && fileStats.size > 0) {
        const buf = Buffer.alloc(4);
        const fd = fs.openSync(originalPath, 'r');
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);

        const isValidJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
        const isValidPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;

        if (ext === '.jpg' || ext === '.jpeg') {
          if (!isValidJpeg) {
            console.error('JPG file has invalid magic bytes:', buf, 'file:', originalPath);
            return res.status(400).json({ error: 'Uploaded JPG file is invalid or corrupted. Please try again.' });
          }
          console.log('JPG magic bytes verified');
        } else if (ext === '.png') {
          if (!isValidPng) {
            console.error('PNG file has invalid magic bytes:', buf, 'file:', originalPath);
            return res.status(400).json({ error: 'Uploaded PNG file is invalid or corrupted. Please try again.' });
          }
          console.log('PNG magic bytes verified');
        }
      }
    } catch (validateErr) {
      console.error('File validation error:', validateErr && (validateErr.message || validateErr));
      return res.status(400).json({ error: 'File validation failed. Please try again.' });
    }

    console.log('Processing file:', originalPath);

    // prepare list of image paths to process (single image by default)
    let processingPaths = [originalPath];
    let tempImages = [];

    if (ext === '.pdf') {
      console.log('PDF detected → converting to images (up to 3 pages)');
      const imgs = await convertPdfToImages(originalPath, 3);
      if (imgs && imgs.length > 0) {
        processingPaths = imgs.map(p => path.resolve(p));
        tempImages = imgs.slice();
      } else {
        processingPaths = [];
        console.log('PDF conversion produced no images; returning Unknown from Vision LLM flow');
      }
    }

    // PDF-specific path: Vision LLM only, sequential page probing.
    // Try page1 -> page2 -> page3 and stop on first non-Unknown result.
    if (ext === '.pdf') {
      console.log('PDF Vision flow: processing up to 3 converted page image(s) sequentially');

      let pdfVisionResult = null;
      let lastVisionUnknown = null;
      let lastPdfVisionError = null;

      for (const p of processingPaths) {
        try {
          console.log('Vision LLM analyzing PDF page image:', p);
          const visionRes = await analyzeImageWithLLM(p);
          console.log('Vision LLM result for PDF page', p, visionRes);

          const llmDocType = getDocTypeFromVisionResult(visionRes);
          if (!isUnknownDocType(llmDocType)) {
            pdfVisionResult = {
              ...(visionRes || {}),
              document_type: llmDocType,
              folder: (visionRes && visionRes.folder) || cleanFolderName(llmDocType),
              confidence: normalizeConfidencePercent(visionRes && visionRes.confidence),
              method: 'Vision LLM'
            };
            break;
          }

          lastVisionUnknown = {
            extracted_text: (visionRes && visionRes.extracted_text) || '',
            document_type: 'Unknown',
            category: 'Other',
            folder: 'Other/Unknown',
            confidence: 0,
            key_fields: {
              name: null,
              id_number: null,
              date_of_birth: null,
              document_number: null,
              issuing_authority: null
            },
            method: 'Vision LLM',
            ...(visionRes || {})
          };
        } catch (vErr) {
          lastPdfVisionError = vErr && (vErr.message || String(vErr));
          console.error('Vision LLM failed for PDF page', p, vErr && (vErr.message || vErr));
        }
      }

      if (!pdfVisionResult) {
        console.warn('PDF Vision flow did not produce a confident result', {
          pagesTried: processingPaths.length,
          lastPdfVisionError,
        });
      }

      const finalPdfResult = pdfVisionResult || lastVisionUnknown || {
        extracted_text: '',
        document_type: 'Unknown',
        category: 'Other',
        folder: 'Other/Unknown',
        accuracy: 0,
        confidence: 0,
        key_fields: {
          name: null,
          id_number: null,
          date_of_birth: null,
          document_number: null,
          issuing_authority: null
        },
        method: 'Vision LLM'
      };
      finalPdfResult.processing_time_ms = Date.now() - uploadStartTs;
      finalPdfResult.category = deriveCategory(finalPdfResult);
      finalPdfResult.accuracy = normalizeConfidencePercent(finalPdfResult.accuracy ?? finalPdfResult.confidence);
      finalPdfResult.confidence = normalizeConfidencePercent(finalPdfResult.confidence);
      if (!finalPdfResult.confidence && finalPdfResult.accuracy) {
        finalPdfResult.confidence = finalPdfResult.accuracy;
      }

      try {
        const target = createStorageTarget({ userId: req.userId, result: finalPdfResult, filename: req.file.originalname });
        const { targetDir, targetPath } = target;
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        await safeMoveFile(originalPath, targetPath);
        const savedDoc = await persistAndNotify({
          req,
          result: finalPdfResult,
          filePath: targetPath
        });

        cleanupFiles(tempImages);
        for (const img of tempImages) {
          try { if (fs.existsSync(img)) cleanup.enqueueDelete(img); } catch (e) { console.error('enqueueDelete failed for', img, e && e.message); }
        }

        return res.json(buildUploadSuccessResponse({ savedDoc, result: finalPdfResult }));
      } catch (e) {
        console.error('Failed to move PDF original file to storage:', e.message || e);
      }

      cleanupFiles(tempImages);
      for (const img of tempImages) {
        try { if (fs.existsSync(img)) cleanup.enqueueDelete(img); } catch (e) { console.error('enqueueDelete failed for', img, e && e.message); }
      }

      return res.status(500).json({ error: 'Failed to store processed PDF' });
    }

    console.log('Processing', processingPaths.length, 'page(s) sequentially (ML -> Vision LLM fallback)...');

    // Process pages in order: ML first, then Vision LLM for that page if ML confidence is low.
    let finalResult = null;
    let lastMlError = null;
    let lastVisionError = null;
    for (const p of processingPaths) {
      try {
        // ML analysis
        const { response: mlResponse, endpoint: mlEndpoint } = await callMlService(p);
        console.log('ML endpoint used:', mlEndpoint);
        console.log('ML Success for', p, mlResponse.data);
        const predictedClass = mlResponse.data.class || mlResponse.data['class'];
        const confidenceRaw = parseFloat(mlResponse.data.confidence || 0);
        const confidencePercent = normalizeConfidencePercent(confidenceRaw);

        if (confidencePercent >= CONFIDENCE_THRESHOLD_PERCENT) {
          // Good ML result — accept and return
          console.log('ML HIGH CONFIDENCE -> RETURNING ML Result for', p);
          finalResult = {
            document_type: predictedClass || 'Unknown',
            folder: cleanFolderName(predictedClass),
            category: deriveCategory({ document_type: predictedClass, folder: cleanFolderName(predictedClass) }),
            accuracy: confidencePercent,
            confidence: confidencePercent,
            method: 'ML',
            extracted_text: '',
            key_fields: {}
          };
          finalResult.processing_time_ms = Date.now() - uploadStartTs;
        } else {
          // ML low confidence — try Vision LLM for this page
          console.log('ML low confidence (', confidenceRaw, ') — invoking Vision LLM on', p);
          try {
            const visionRes = await analyzeImageWithLLM(p);
            console.log('Vision LLM result for', p, visionRes);
            // decide whether vision result is meaningful
            const llmDocType = getDocTypeFromVisionResult(visionRes);
            if (!isUnknownDocType(llmDocType)) {
              finalResult = {
                ...(visionRes || {}),
                document_type: llmDocType,
                folder: (visionRes && visionRes.folder) || cleanFolderName(llmDocType),
                category: deriveCategory({
                  ...(visionRes || {}),
                  document_type: llmDocType,
                  folder: (visionRes && visionRes.folder) || cleanFolderName(llmDocType)
                }),
                accuracy: (visionRes && (visionRes.accuracy ?? visionRes.confidence)) || 0,
                confidence: (visionRes && visionRes.confidence) || 0,
                method: 'Vision LLM'
              };
              finalResult.processing_time_ms = Date.now() - uploadStartTs;
              finalResult.accuracy = normalizeConfidencePercent(finalResult.accuracy);
              finalResult.confidence = normalizeConfidencePercent(finalResult.confidence);
              if (!finalResult.confidence && finalResult.accuracy) {
                finalResult.confidence = finalResult.accuracy;
              }
            } else {
              console.log('Vision LLM returned unknown for', p, ' — continuing to next page');
            }
          } catch (vErr) {
            lastVisionError = vErr && (vErr.message || String(vErr));
            console.error('Vision LLM failed for', p, vErr && (vErr.message || vErr));
          }
        }

        // If we have a finalResult from either ML or Vision LLM, persist the original and return
        if (finalResult) {
          const target = createStorageTarget({ userId: req.userId, result: finalResult, filename: req.file.originalname });
          const { targetDir, targetPath } = target;
          try {
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            await safeMoveFile(originalPath, targetPath);
            const savedDoc = await persistAndNotify({
              req,
              result: finalResult,
              filePath: targetPath
            });

            // schedule cleanup of temporary images
            cleanupFiles(tempImages);
            for (const img of tempImages) {
              try { if (fs.existsSync(img)) cleanup.enqueueDelete(img); } catch (e) { console.error('enqueueDelete failed for', img, e && e.message); }
            }

            return res.json(buildUploadSuccessResponse({ savedDoc, result: finalResult }));
          } catch (e) {
            console.error('Failed to move original file to storage:', e.message || e);
            try { cleanup.enqueueMove(originalPath, targetPath); } catch (ee) { console.error('enqueueMove failed', ee && ee.message); }
          }

          // schedule cleanup of temporary images
          cleanupFiles(tempImages);
          for (const img of tempImages) {
            try { if (fs.existsSync(img)) cleanup.enqueueDelete(img); } catch (e) { console.error('enqueueDelete failed for', img, e && e.message); }
          }

          return res.status(500).json({ error: 'Failed to store processed file' });
        }
      } catch (e) {
        lastMlError = e?.response?.data || e.message || String(e);
        console.error('ML request failed for', p, e?.response?.data || e.message || e);
        // continue to next page — do not abort entire request for single-page ML error
      }
    }

    function inferIdFromFilename(fname) {
      if (!fname) return null;
      const name = String(fname);
      // Aadhaar: 12 digits (allow spaces)
      const aadhaarMatch = name.match(/(\d{4}\s?\d{4}\s?\d{4})/);
      if (aadhaarMatch) return aadhaarMatch[1].replace(/\s/g, '');
      const aad2 = name.match(/\b(\d{12})\b/);
      if (aad2) return aad2[1];
      // PAN: 5 letters + 4 digits + 1 letter
      const pan = name.match(/\b([A-Za-z]{5}[0-9]{4}[A-Za-z])\b/);
      if (pan) return pan[1].toUpperCase();
      // Passport: 8 alnum
      const pass = name.match(/\b([A-Za-z0-9]{8})\b/);
      if (pass) return pass[1].toUpperCase();
      // fallback: none
      return null;
    }

    // No page produced a confident ML/LLM result. Final fallback: move original to Other/Unknown and return Unknown.
    try {
      console.warn('Final fallback reached: no confident ML/LLM result', {
        file: originalPath,
        ext,
        pagesTried: processingPaths.length,
        mlServiceUrls: ML_SERVICE_URLS,
        lastMlError,
        lastVisionError,
      });
      const fallbackResult = {
        document_type: 'Unknown',
        category: 'Other',
        accuracy: 0,
        confidence: 0,
        method: 'Fallback',
        extracted_text: '',
        key_fields: {}
      };
      fallbackResult.processing_time_ms = Date.now() - uploadStartTs;
      const target = createStorageTarget({ userId: req.userId, result: fallbackResult, filename: req.file.originalname });
      const { targetDir, targetPath } = target;
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      try {
        await safeMoveFile(originalPath, targetPath);
        const savedDoc = await persistAndNotify({
          req,
          result: fallbackResult,
          filePath: targetPath
        });

        // cleanup temp images (immediate and schedule retries if any remain)
        cleanupFiles(tempImages);
        for (const img of tempImages) {
          try {
            if (fs.existsSync(img)) cleanup.enqueueDelete(img);
          } catch (e) {
            console.error('enqueueDelete failed for', img, e && e.message);
          }
        }

        return res.json(buildUploadSuccessResponse({ savedDoc, result: fallbackResult }));
      } catch (e) {
        console.error('Failed to move original file to storage (final fallback):', e.message || e);
        try { cleanup.enqueueMove(originalPath, targetPath); } catch (ee) { console.error('enqueueMove failed', ee && ee.message); }
      }
    } catch (e) {
      console.error('Storage move error (final fallback):', e.message || e);
    }

    // cleanup temp images (immediate and schedule retries if any remain)
    cleanupFiles(tempImages);
    for (const img of tempImages) {
      try {
        if (fs.existsSync(img)) cleanup.enqueueDelete(img);
      } catch (e) {
        console.error('enqueueDelete failed for', img, e && e.message);
      }
    }

    return res.status(500).json({ error: 'Failed to persist fallback document' });

  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    return res.status(500).json({
      error: err.message || String(err)
    });
  }
});

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  startWeeklySummaryJob();
  connectDB()
    .then(() => backfillClerkUsersToMongo())
    .then(() => syncAllExistingStorageForUsers())
    .catch((err) => console.error('MongoDB/Clerk init error:', err && (err.message || err)));
  try { cleanup.start(); } catch (e) { console.error('cleanup start failed', e && e.message); }
});
