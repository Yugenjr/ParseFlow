const path = require('path');
const fs = require('fs');

async function convertPdfToImages(pdfPath, maxPages = 3) {
  const dir = path.dirname(pdfPath);
  const baseName = path.basename(pdfPath, path.extname(pdfPath));
  const results = [];

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = require('@napi-rs/canvas');

    const data = new Uint8Array(await fs.promises.readFile(pdfPath));
    const loadingTask = pdfjs.getDocument({ data, disableWorker: true });
    const pdfDoc = await loadingTask.promise;
    const pageCount = Math.min(maxPages, pdfDoc.numPages || 0);

    for (let p = 1; p <= pageCount; p++) {
      try {
        const page = await pdfDoc.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });

        const width = Math.max(1, Math.ceil(viewport.width));
        const height = Math.max(1, Math.ceil(viewport.height));
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');

        await page.render({ canvasContext: context, viewport }).promise;

        const imagePath = path.resolve(dir, `${baseName}_page_${p}.jpg`);
        const jpgBuffer = canvas.toBuffer('image/jpeg');
        await fs.promises.writeFile(imagePath, jpgBuffer);
        results.push(imagePath);
      } catch (err) {
        console.error('PDF conversion error on page', p, err && (err.message || err));
        break;
      }
    }
  } catch (err) {
    console.error('PDF conversion setup failed:', err && (err.message || err));
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
