const { v2: cloudinary } = require('cloudinary');

const required = ['CLOUD_NAME', 'API_KEY', 'API_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.warn(`Cloudinary is not fully configured. Missing: ${missing.join(', ')}`);
}

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true,
});

module.exports = cloudinary;
