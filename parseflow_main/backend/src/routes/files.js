const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/fileUpload');
const { uploadFile, fetchFiles, deleteFile } = require('../controllers/fileController');

const router = express.Router();

// Keep legacy direct-cloudinary upload route, but avoid colliding with main /upload ML pipeline.
router.post('/upload-cloudinary', authMiddleware, (req, res, next) => {
	upload.single('file')(req, res, (err) => {
		if (!err) {
			next();
			return;
		}
		return res.status(400).json({ error: err.message || 'Invalid upload request' });
	});
}, uploadFile);
router.get('/files', authMiddleware, fetchFiles);
router.delete('/files/:id', authMiddleware, deleteFile);

module.exports = router;
