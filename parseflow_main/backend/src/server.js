require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { analyzeWithLLM } = require('./services/llmService');
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
const OCR_SERVICE_URL = 'http://127.0.0.1:8002/extract';

const CONFIDENCE_THRESHOLD = 0.80;

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file required' });
    }

    const originalPath = path.resolve(req.file.path);
    console.log('Processing file:', originalPath);

    const ext = path.extname(req.file.originalname || '').toLowerCase();

    // prepare list of image paths to run ML on (single image by default)
    let processingPaths = [originalPath];
    let tempImages = [];

    if (ext === '.pdf') {
      console.log('PDF detected → converting to images (up to 3 pages)');
      const imgs = await convertPdfToImages(originalPath, 3);
      if (imgs && imgs.length > 0) {
        processingPaths = imgs.map(p => path.resolve(p));
        tempImages = imgs.slice();
      } else {
        console.log('PDF conversion produced no images; falling back to original file');
      }
    }

    console.log('Calling ML API on', processingPaths.length, 'image(s)...');

    // STEP 1: Call ML service on up to first 3 images
    let bestMl = null;
    for (const p of processingPaths) {
      try {
        const mlResponse = await axios.post(
          ML_SERVICE_URL,
          { file_path: p },
          { timeout: 30000 }
        );
        console.log('ML Success for', p, mlResponse.data);
        const predictedClass = mlResponse.data.class || mlResponse.data['class'];
        const confidence = parseFloat(mlResponse.data.confidence || 0);
        if (!bestMl || confidence > bestMl.confidence) {
          bestMl = { predictedClass, confidence, file: p };
        }
        if (confidence >= CONFIDENCE_THRESHOLD) {
          // high confidence — use this
          console.log('ML HIGH CONFIDENCE -> RETURNING ML RESULT (from page)', p);

          // move original file into storage based on predicted category
          const folder = cleanFolderName(predictedClass);
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

          // cleanup temp images if any (try immediate cleanup, otherwise schedule background deletes)
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
              document_type: predictedClass || 'Unknown',
              folder,
              confidence,
              method: 'ML'
            }
          });
        }
      } catch (e) {
        console.error('ML request failed for', p, e?.response?.data || e.message || e);
      }
    }

    // If any ML produced a best score >= threshold we would have returned.
    // If we have a bestMl but below threshold, we'll fallback to Vision LLM.
    if (bestMl) console.log('Best ML result:', bestMl.predictedClass, bestMl.confidence);

    // helper: check if predicted class is an identity-type
    function isIdentityClass(cls) {
      if (!cls) return false;
      const s = String(cls).toLowerCase();
      return s.includes('aadhar') || s.includes('aadhaar') || s.includes('pan') || s.includes('passport') || s.includes('driving') || s.includes('license') || s.includes('licence');
    }

    function cleanFolderName(docType) {
      if (!docType) return 'Other/Unknown';
      // replace spaces and hyphens with underscore, title case words
      const t = String(docType).replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
      const parts = t.split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1));
      return (isIdentityClass(docType) ? 'Identity/' : 'Other/') + parts.join('_');
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

    // If PDF conversion failed (no images produced) and the original file is a PDF,
    // fall back to OCR + text LLM path.
    if (ext === '.pdf' && tempImages.length === 0) {
      console.log('PDF conversion failed — falling back to OCR + LLM');
      try {
        const ocrResponse = await axios.post(
          OCR_SERVICE_URL,
          { file_path: originalPath },
          { timeout: 30000 }
        );
        const extractedText = (ocrResponse.data && ocrResponse.data.text) ? String(ocrResponse.data.text).slice(0, 3000) : '';
        console.log('OCR TEXT PREVIEW:', extractedText.slice(0, 200));
        const llmResult = await analyzeWithLLM(extractedText || '');

        // move original file into storage based on LLM category/folder if provided
        try {
          const folder = (llmResult && llmResult.folder) ? llmResult.folder : cleanFolderName(llmResult && llmResult.document_type);
          const storageRoot = path.resolve(path.join(__dirname, '..', '..', 'storage'));
          const targetDir = path.join(storageRoot, folder);
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          const targetPath = path.join(targetDir, req.file.originalname);
          try {
            fs.renameSync(originalPath, targetPath);
          } catch (e) {
            console.error('Failed to move original file to storage (renameSync):', e.message || e);
            try { cleanup.enqueueMove(originalPath, targetPath); } catch (ee) { console.error('enqueueMove failed', ee && ee.message); }
          }
        } catch (e) {
          console.error('Storage move error:', e.message || e);
        }

        return res.json({
          filename: req.file.originalname,
          result: {
            ...(llmResult || {}),
            method: 'OCR + LLM'
          }
        });
      } catch (e) {
        console.error('OCR fallback failed:', e?.response?.data || e.message || e);
        // continue to Vision LLM below as last resort
      }
    }

    console.log('ML LOW CONFIDENCE -> USING VISION LLM on first page');

    // STEP 3: Vision LLM (multimodal) — use first processing path (first page)
    const visionInput = processingPaths[0] || originalPath;
    const llmResult = await analyzeImageWithLLM(visionInput);

    // move original file into storage based on LLM category/folder if provided
    try {
      const folder = (llmResult && llmResult.folder) ? llmResult.folder : cleanFolderName(llmResult && llmResult.document_type);
      const storageRoot = path.resolve(path.join(__dirname, '..', '..', 'storage'));
      const targetDir = path.join(storageRoot, folder);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, req.file.originalname);
      try {
        await safeMoveFile(originalPath, targetPath);
      } catch (e) {
        console.error('Failed to move original file to storage:', e.message || e);
        try { cleanup.enqueueMove(originalPath, targetPath); } catch (ee) { console.error('enqueueMove failed', ee && ee.message); }
      }
    } catch (e) {
      console.error('Storage move error:', e.message || e);
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
        ...(llmResult || {}),
        method: 'Vision LLM'
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
