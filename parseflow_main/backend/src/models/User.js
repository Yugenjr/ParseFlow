const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, default: null },
  name: { type: String, default: null },
  googleDrive: {
    connected: { type: Boolean, default: false },
    access_token: { type: String, default: null },
    refresh_token: { type: String, default: null },
    token_expiry_date: { type: Number, default: null }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);