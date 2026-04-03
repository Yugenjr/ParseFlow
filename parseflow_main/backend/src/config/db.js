const mongoose = require('mongoose');

let hasConnected = false;

async function connectDB() {
  if (hasConnected) return;

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn('MONGO_URI not set. MongoDB features are disabled until configured.');
    return;
  }

  await mongoose.connect(mongoUri, { dbName: 'parseflow' });

  try {
    const User = require('../models/User');
    await User.createCollection();
    const Document = require('../models/Document');
    await Document.createCollection();
    const File = require('../models/File');
    await File.createCollection();
  } catch (err) {
    // Ignore "already exists" and continue startup.
    if (!String(err && err.message).toLowerCase().includes('already exists')) {
      throw err;
    }
  }

  hasConnected = true;
  console.log('MongoDB connected (db=parseflow)');
}

module.exports = { connectDB };