const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, index: true },
  filename: { type: String, required: true },
  mimeType: { type: String, default: null },
  sizeBytes: { type: Number, default: 0 },
  storagePath: { type: String, required: true },
  storageFolder: { type: String, required: true },
  documentType: { type: String, default: 'Unknown' },
  category: { type: String, default: 'Other' },
  confidence: { type: Number, default: 0 },
  method: { type: String, default: 'Unknown' },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Document', documentSchema);