const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// Store uploads in backend/uploads (one level above src)
const UPLOADS_DIR = path.resolve(path.join(__dirname, '..', 'uploads'));
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOADS_DIR });

const ML_SERVICE_URL = 'http://127.0.0.1:8001/predict';

const CONFIDENCE_THRESHOLD = 0.85;

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file required' });
    }

    const filePath = path.resolve(req.file.path);

    console.log('Processing file:', filePath);
    console.log('Calling ML API...');

    // Call ML service
    const mlResponse = await axios.post(
      ML_SERVICE_URL,
      { file_path: filePath },
      { timeout: 30000 }
    );

    console.log('ML Success:', mlResponse.data);

    const predictedClass = mlResponse.data.class || mlResponse.data['class'];
    const confidence = parseFloat(mlResponse.data.confidence || 0);

    console.log('ML Prediction:', predictedClass, 'Confidence:', confidence);

    // ALWAYS return ML result (no OCR fallback)
    return res.json({
      filename: req.file.originalname,
      result: {
        document_type: predictedClass || 'Unknown',
        confidence: confidence,
        method: 'ML-ONLY'
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
});
