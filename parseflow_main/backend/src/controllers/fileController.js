const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const File = require('../models/File');
const User = require('../models/User');

async function getUserObjectId(req) {
  const rawUserId = req.user?.id || req.userId;
  if (!rawUserId) {
    return null;
  }

  if (mongoose.isValidObjectId(rawUserId)) {
    return new mongoose.Types.ObjectId(rawUserId);
  }

  const existing = await User.findOne({ clerkId: String(rawUserId) }).select({ _id: 1 }).lean();
  if (existing && existing._id) {
    return new mongoose.Types.ObjectId(existing._id);
  }

  const created = await User.create({
    clerkId: String(rawUserId),
    email: req.userEmail || null,
    name: null,
  });

  return new mongoose.Types.ObjectId(created._id);
}

function uploadBufferToCloudinary({ buffer, folder, originalname, mimetype }) {
  const publicId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise((resolve, reject) => {
    const uploadOpts = {
      folder,
      public_id: publicId,
      use_filename: false,
      unique_filename: false,
      overwrite: false,
    };

    // Determine resource type from original filename/mimetype
    const ext = (originalname && require('path').extname(originalname).toLowerCase()) || '';
    const isPdf = ext === '.pdf' || String(mimetype || '').toLowerCase() === 'application/pdf';
    uploadOpts.resource_type = isPdf ? 'raw' : 'image';

    const stream = cloudinary.uploader.upload_stream(
      uploadOpts,
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

async function uploadFile(req, res) {
  try {
    const userObjectId = await getUserObjectId(req);
    if (!userObjectId) {
      return res.status(401).json({ error: 'Invalid authenticated user id' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'file is required' });
    }

    const cloudinaryResult = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      folder: `users/${String(userObjectId)}`,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    const saved = await File.create({
      userId: userObjectId,
      fileName: req.file.originalname,
      fileUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
    });

    return res.status(201).json({
      success: true,
      url: saved.fileUrl,
      publicId: saved.publicId,
      file: {
        _id: saved._id,
        userId: saved.userId,
        fileName: saved.fileName,
        fileUrl: saved.fileUrl,
        publicId: saved.publicId,
        createdAt: saved.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to upload file',
    });
  }
}

async function fetchFiles(req, res) {
  try {
    const userObjectId = await getUserObjectId(req);
    if (!userObjectId) {
      return res.status(401).json({ error: 'Invalid authenticated user id' });
    }

    const files = await File.find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(files);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to fetch files',
    });
  }
}

async function deleteFile(req, res) {
  try {
    const userObjectId = await getUserObjectId(req);
    if (!userObjectId) {
      return res.status(401).json({ error: 'Invalid authenticated user id' });
    }

    const id = String(req.params.id || '');
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid file id' });
    }

    const file = await File.findOne({ _id: id, userId: userObjectId });
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await cloudinary.uploader.destroy(file.publicId, { resource_type: 'auto' });
    await File.deleteOne({ _id: file._id, userId: userObjectId });

    return res.json({ success: true, deletedId: String(file._id) });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to delete file',
    });
  }
}

module.exports = {
  uploadFile,
  fetchFiles,
  deleteFile,
};
