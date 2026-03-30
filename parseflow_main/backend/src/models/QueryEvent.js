const mongoose = require('mongoose');

const queryEventSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  source: { type: String, required: true, enum: ['DocBot', 'GuideBot'] },
  createdAt: { type: Date, default: Date.now }
});

queryEventSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('QueryEvent', queryEventSchema);
