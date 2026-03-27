require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createClerkClient } = require('@clerk/backend');
const { connectDB } = require('./config/db');
const User = require('./models/User');
const Document = require('./models/Document');
const { authMiddleware } = require('./middleware/authMiddleware');
const { analyzeImageWithLLM } = require('./services/visionLLM');
const { convertPdfToImages, cleanupFiles } = require('./services/pdfService');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/files', express.static(path.resolve(path.join(__dirname, '..', '..', 'storage'))));
const STORAGE_ROOT = path.resolve(path.join(__dirname, '..', '..', 'storage'));

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

const ML_SERVICE_URL = 'http://127.0.0.1:8001/predict';

const CONFIDENCE_THRESHOLD = 0.80;

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

function deriveCategory(result) {
  if (result && result.category) return String(result.category);
  if (!result || !result.folder) return 'Other';
  const folder = String(result.folder);
  return folder.includes('/') ? folder.split('/')[0] : 'Other';
}

function deriveDocType(result) {
  const raw = (result && result.document_type) || 'Unknown';
  return String(raw).trim() || 'Unknown';
}

function createStorageTarget({ userId, result, filename }) {
  const category = deriveCategory(result) || 'Other';
  const docType = deriveDocType(result).replace(/\s+/g, '_');
  const targetDir = path.resolve(path.join(__dirname, '..', '..', 'storage', userId, category, docType));
  const targetPath = path.join(targetDir, filename);
  return { category, docType, targetDir, targetPath };
}

function makeFileUrl(filePathAbs) {
  const relative = path.relative(STORAGE_ROOT, filePathAbs).split(path.sep).join('/');
  return `/files/${relative}`;
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
  const confidence = normalizeConfidencePercent(result && result.confidence);
  return Document.create({
    userId: req.userId,
    filename: req.file.originalname,
    filePath,
    document_type: deriveDocType(result),
    category,
    confidence,
    method: (result && result.method) || 'Unknown',
    metadata: (result && result.key_fields) || {},
    storage: {
      category,
      docType,
      filePath,
      fileUrl
    },
    classification: {
      document_type: deriveDocType(result),
      category,
      confidence,
      method: (result && result.method) || 'Unknown'
    }
  });
}

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

app.get('/api/documents', authMiddleware, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
    const docs = await Document.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const hydrated = docs.map((doc) => ({
      ...doc,
      confidence: normalizeConfidencePercent(doc.confidence),
      classification: {
        ...(doc.classification || {}),
        confidence: normalizeConfidencePercent(doc.classification && doc.classification.confidence)
      },
      fileUrl: makeFileUrl(doc.filePath)
    }));

    return res.json({ documents: hydrated });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch documents' });
  }
});

app.get('/documents', authMiddleware, async (req, res) => {
  try {
    const docs = await Document.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    const hydrated = docs.map((doc) => ({
      ...doc,
      confidence: normalizeConfidencePercent(doc.confidence),
      classification: {
        ...(doc.classification || {}),
        confidence: normalizeConfidencePercent(doc.classification && doc.classification.confidence)
      },
      fileUrl: makeFileUrl(doc.filePath)
    }));

    return res.json(hydrated);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch documents' });
  }
});

app.post('/api/sync-storage', authMiddleware, async (req, res) => {
  try {
    const result = await syncStorageForUser(req.userId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Storage sync failed' });
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
          console.error('Vision LLM failed for PDF page', p, vErr && (vErr.message || vErr));
        }
      }

      const finalPdfResult = pdfVisionResult || lastVisionUnknown || {
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
        method: 'Vision LLM'
      };
      finalPdfResult.confidence = normalizeConfidencePercent(finalPdfResult.confidence);

      try {
        const target = createStorageTarget({ userId: req.userId, result: finalPdfResult, filename: req.file.originalname });
        const { targetDir, targetPath } = target;
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        await safeMoveFile(originalPath, targetPath);
        const savedDoc = await persistDocumentForUser({
          req,
          result: finalPdfResult,
          filePath: targetPath
        });

        cleanupFiles(tempImages);
        for (const img of tempImages) {
          try { if (fs.existsSync(img)) cleanup.enqueueDelete(img); } catch (e) { console.error('enqueueDelete failed for', img, e && e.message); }
        }

        return res.json({ success: true, document: { ...savedDoc.toObject(), fileUrl: makeFileUrl(savedDoc.filePath) }, result: finalPdfResult });
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
    for (const p of processingPaths) {
      try {
        // ML analysis
        const mlResponse = await axios.post(
          ML_SERVICE_URL,
          { file_path: p },
          { timeout: 30000 }
        );
        console.log('ML Success for', p, mlResponse.data);
        const predictedClass = mlResponse.data.class || mlResponse.data['class'];
        const confidence = parseFloat(mlResponse.data.confidence || 0);

        if (confidence >= CONFIDENCE_THRESHOLD) {
          // Good ML result — accept and return
          console.log('ML HIGH CONFIDENCE -> RETURNING ML Result for', p);
          finalResult = {
            document_type: predictedClass || 'Unknown',
            folder: cleanFolderName(predictedClass),
            confidence: normalizeConfidencePercent(confidence),
            method: 'ML'
          };
        } else {
          // ML low confidence — try Vision LLM for this page
          console.log('ML low confidence (', confidence, ') — invoking Vision LLM on', p);
          try {
            const visionRes = await analyzeImageWithLLM(p);
            console.log('Vision LLM result for', p, visionRes);
            // decide whether vision result is meaningful
            const llmDocType = getDocTypeFromVisionResult(visionRes);
            if (!isUnknownDocType(llmDocType)) {
              finalResult = { document_type: llmDocType, folder: (visionRes.folder || cleanFolderName(llmDocType)), confidence: (visionRes.confidence || 0), method: 'Vision LLM' };
              finalResult.confidence = normalizeConfidencePercent(finalResult.confidence);
            } else {
              console.log('Vision LLM returned unknown for', p, ' — continuing to next page');
            }
          } catch (vErr) {
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
            const savedDoc = await persistDocumentForUser({
              req,
              result: finalResult,
              filePath: targetPath
            });

            // schedule cleanup of temporary images
            cleanupFiles(tempImages);
            for (const img of tempImages) {
              try { if (fs.existsSync(img)) cleanup.enqueueDelete(img); } catch (e) { console.error('enqueueDelete failed for', img, e && e.message); }
            }

            return res.json({ success: true, document: { ...savedDoc.toObject(), fileUrl: makeFileUrl(savedDoc.filePath) }, result: finalResult });
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
      const fallbackResult = {
        document_type: 'Unknown',
        category: 'Other',
        confidence: 0,
        method: 'Fallback'
      };
      const target = createStorageTarget({ userId: req.userId, result: fallbackResult, filename: req.file.originalname });
      const { targetDir, targetPath } = target;
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      try {
        await safeMoveFile(originalPath, targetPath);
        const savedDoc = await persistDocumentForUser({
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

        return res.json({ success: true, document: { ...savedDoc.toObject(), fileUrl: makeFileUrl(savedDoc.filePath) }, result: fallbackResult });
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

app.listen(5000, () => {
  console.log('Backend running on port 5000');
  connectDB()
    .then(() => backfillClerkUsersToMongo())
    .then(() => syncAllExistingStorageForUsers())
    .catch((err) => console.error('MongoDB/Clerk init error:', err && (err.message || err)));
  try { cleanup.start(); } catch (e) { console.error('cleanup start failed', e && e.message); }
});
