const { fromPath } = require('pdf2pic');
const path = require('path');
const fs = require('fs');

async function convertPdfToImages(pdfPath, maxPages = 3) {
  const dir = path.dirname(pdfPath);
  const baseName = path.basename(pdfPath, path.extname(pdfPath));

  const options = {
    density: 100,
    saveFilename: baseName + '_page',
    savePath: dir,
    format: 'jpg',
    width: 1024,
    height: 1024
  };

  const convert = fromPath(pdfPath, options);
  const results = [];

  for (let p = 1; p <= maxPages; p++) {
    try {
      const page = await convert(p);
      if (page && page.path) results.push(page.path);
    } catch (err) {
      // log error and stop if page doesn't exist or conversion fails for this page
      console.error('PDF conversion error on page', p, err && (err.message || err));
      break;
    }
  }

  return results;
}

function cleanupFiles(paths = []) {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {
      // ignore cleanup errors
    }
  }
}

module.exports = { convertPdfToImages, cleanupFiles };
