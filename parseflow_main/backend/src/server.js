require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { analyzeImageWithLLM } = require('./services/visionLLM');
const { convertPdfToImages, cleanupFiles } = require('./services/pdfService');

const app = express();
app.use(cors());

// Store uploads in backend/uploads (one level above src)
const UPLOADS_DIR = path.resolve(path.join(__dirname, '..', 'uploads'));
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const createCleanup = require('./services/cleanupService');
const cleanup = createCleanup({ uploadsDir: UPLOADS_DIR, intervalMs: 60000 });

const upload = multer({ dest: UPLOADS_DIR });

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

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file required' });
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
              document_type: llmDocType,
              folder: (visionRes && visionRes.folder) || cleanFolderName(llmDocType),
              confidence: (visionRes && visionRes.confidence) || 0,
              method: 'Vision LLM',
              ...(visionRes || {})
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

      try {
        const folder = finalPdfResult.folder || cleanFolderName(finalPdfResult.document_type);
        const storageRoot = path.resolve(path.join(__dirname, '..', '..', 'storage'));
        const targetDir = path.join(storageRoot, folder);
        const targetPath = path.join(targetDir, req.file.originalname);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        await safeMoveFile(originalPath, targetPath);
      } catch (e) {
        console.error('Failed to move PDF original file to storage:', e.message || e);
      }

      cleanupFiles(tempImages);
      for (const img of tempImages) {
        try { if (fs.existsSync(img)) cleanup.enqueueDelete(img); } catch (e) { console.error('enqueueDelete failed for', img, e && e.message); }
      }

      return res.json({ filename: req.file.originalname, result: finalPdfResult });
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
          finalResult = { document_type: predictedClass || 'Unknown', folder: cleanFolderName(predictedClass), confidence, method: 'ML' };
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
            } else {
              console.log('Vision LLM returned unknown for', p, ' — continuing to next page');
            }
          } catch (vErr) {
            console.error('Vision LLM failed for', p, vErr && (vErr.message || vErr));
          }
        }

        // If we have a finalResult from either ML or Vision LLM, persist the original and return
        if (finalResult) {
          const folder = finalResult.folder || cleanFolderName(finalResult.document_type);
          const storageRoot = path.resolve(path.join(__dirname, '..', '..', 'storage'));
          const targetDir = path.join(storageRoot, folder);
          const targetPath = path.join(targetDir, req.file.originalname);
          try {
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            await safeMoveFile(originalPath, targetPath);
          } catch (e) {
            console.error('Failed to move original file to storage:', e.message || e);
            try { cleanup.enqueueMove(originalPath, targetPath); } catch (ee) { console.error('enqueueMove failed', ee && ee.message); }
          }

          // schedule cleanup of temporary images
          cleanupFiles(tempImages);
          for (const img of tempImages) {
            try { if (fs.existsSync(img)) cleanup.enqueueDelete(img); } catch (e) { console.error('enqueueDelete failed for', img, e && e.message); }
          }

          return res.json({ filename: req.file.originalname, result: finalResult });
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
      const folder = 'Other/Unknown';
      const storageRoot = path.resolve(path.join(__dirname, '..', '..', 'storage'));
      const targetDir = path.join(storageRoot, folder);
      const targetPath = path.join(targetDir, req.file.originalname);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      try {
        await safeMoveFile(originalPath, targetPath);
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

    return res.json({
      filename: req.file.originalname,
      result: {
        document_type: 'Unknown',
        folder: 'Other/Unknown',
        confidence: 0,
        method: 'Fallback'
      }
    });

  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    return res.status(500).json({
      error: err.message || String(err)
    });
  }
});

app.listen(5000, () => {
  console.log('Backend running on port 5000');
  try { cleanup.start(); } catch (e) { console.error('cleanup start failed', e && e.message); }
});
