const fs = require('fs');
const cloudinary = require('../config/cloudinary');

/**
 * Upload a file to Cloudinary from a file path
 * @param {string} filePath - Absolute path to the file
 * @param {string} folder - Folder path in Cloudinary (e.g. 'users/userId/category/docType')
 * @param {string} originalFilename - Original filename
 * @returns {Promise<{secure_url: string, public_id: string}>} Cloudinary upload result
 */
async function uploadFileToCloudinary({ filePath, folder, originalFilename }) {
  console.log('=== Cloudinary Upload Started ===');
  console.log('File path:', filePath);
  console.log('Folder:', folder);
  console.log('Original filename:', originalFilename);

  // Check if Cloudinary is configured
  if (!process.env.CLOUD_NAME || !process.env.API_KEY || !process.env.API_SECRET) {
    console.warn('⚠️ Cloudinary not fully configured. CLOUD_NAME:', !!process.env.CLOUD_NAME, 'API_KEY:', !!process.env.API_KEY, 'API_SECRET:', !!process.env.API_SECRET);
    return null;
  }

  console.log('✓ Cloudinary credentials found');

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return reject(new Error(`File not found: ${filePath}`));
    }

    console.log('✓ File exists, size:', fs.statSync(filePath).size, 'bytes');

    const publicId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const fileExtension = require('path').extname(originalFilename).toLowerCase();
    const isPdf = fileExtension === '.pdf';

    console.log('File extension:', fileExtension, 'Is PDF:', isPdf);
    console.log('Public ID:', publicId);

    const uploadOpts = {
      folder,
      public_id: publicId,
      use_filename: false,
      unique_filename: false,
      overwrite: false,
    };

    // For PDFs, upload as 'raw' so Cloudinary preserves the original PDF asset
    if (isPdf) {
      uploadOpts.resource_type = 'raw';
    } else {
      uploadOpts.resource_type = 'image';
    }

    const stream = cloudinary.uploader.upload_stream(
      uploadOpts,
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error.message || error);
          reject(error);
          return;
        }
        console.log('✓ Cloudinary upload succeeded');
        console.log('Secure URL:', result.secure_url);
        console.log('Public ID:', result.public_id);
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          url: result.url,
        });
      }
    );

    // Stream the file to Cloudinary
    console.log('Starting file stream to Cloudinary...');
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (err) => {
      console.error('❌ File stream error:', err.message);
      reject(new Error(`Failed to read file: ${err.message}`));
    });

    fileStream.on('end', () => {
      console.log('✓ File stream completed');
    });

    fileStream.pipe(stream);
  });
}

module.exports = { uploadFileToCloudinary };
