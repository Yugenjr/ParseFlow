require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { analyzeWithLLM } = require('./services/llmService');

const app = express();
app.use(cors());

// Store uploads in backend/uploads (one level above src)
const UPLOADS_DIR = path.resolve(path.join(__dirname, '..', 'uploads'));
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOADS_DIR });

const ML_SERVICE_URL = 'http://127.0.0.1:8001/predict';
const OCR_SERVICE_URL = 'http://127.0.0.1:8002/extract';

const CONFIDENCE_THRESHOLD = 0.80;

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file required' });
    }

    const filePath = path.resolve(req.file.path);

    console.log('Processing file:', filePath);
    console.log('Calling ML API...');

    // STEP 1: Call ML service
    const mlResponse = await axios.post(
      ML_SERVICE_URL,
      { file_path: filePath },
      { timeout: 30000 }
    );

    console.log('ML Success:', mlResponse.data);

    const predictedClass = mlResponse.data.class || mlResponse.data['class'];
    const confidence = parseFloat(mlResponse.data.confidence || 0);

    console.log('ML Prediction:', predictedClass, 'Confidence:', confidence);

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

    // STEP 2: Decision
    if (confidence >= CONFIDENCE_THRESHOLD) {
      console.log('ML HIGH CONFIDENCE -> RETURNING ML RESULT');
      // attempt to infer document name from filename (e.g., Aadhaar/PAN patterns)
      const inferred = inferIdFromFilename(req.file.originalname) || inferIdFromFilename(path.basename(filePath));
      const document_name = inferred || String(predictedClass || 'Unknown');
      const folder = cleanFolderName(predictedClass);

      return res.json({
        filename: req.file.originalname,
        result: {
          document_name: document_name,
          document_type: predictedClass || 'Unknown',
          folder: folder,
          confidence,
          method: 'ML'
        }
      });
    }

    console.log('ML LOW CONFIDENCE -> SWITCHING TO OCR + LLM');

    // STEP 3: OCR
    const ocrResponse = await axios.post(
      OCR_SERVICE_URL,
      { file_path: filePath },
      { timeout: 30000 }
    );

    const extractedText = (ocrResponse.data && ocrResponse.data.text) ? String(ocrResponse.data.text).slice(0, 3000) : '';

    console.log('OCR TEXT PREVIEW:', extractedText.slice(0, 200));

    // STEP 4: LLM Analysis
    const llmResult = await analyzeWithLLM(extractedText || '');

    // For OCR+LLM path: prefer to return only document_type, but include document_name if LLM found an id
    const docType = llmResult && llmResult.document_type ? llmResult.document_type : 'Unknown';
    let document_name = null;
    try {
      if (llmResult && llmResult.key_fields && llmResult.key_fields.id_number) {
        document_name = llmResult.key_fields.id_number;
      } else if (llmResult && llmResult.key_fields && llmResult.key_fields.name) {
        document_name = llmResult.key_fields.name;
      }
    } catch (e) {
      document_name = null;
    }

    const resp = {
      filename: req.file.originalname,
      result: {
        document_type: docType,
        method: 'OCR + LLM'
      }
    };
    if (document_name) resp.result.document_name = document_name;

    return res.json(resp);

  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    return res.status(500).json({
      error: err.message || String(err)
    });
  }
});

app.listen(5000, () => {
  console.log('Backend running on port 5000');
});
