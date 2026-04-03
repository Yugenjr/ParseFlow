const path = require('path');
const fs = require('fs');

// CRITICAL: Load canvas FIRST and set up all globals BEFORE any pdfjs usage
const canvasModule = require('@napi-rs/canvas');

// Set up ALL canvas globals synchronously
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = canvasModule.DOMMatrix;
  console.log('[pdfService] ✓ DOMMatrix set to globalThis');
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = canvasModule.ImageData;
  console.log('[pdfService] ✓ ImageData set to globalThis');
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = canvasModule.Path2D;
  console.log('[pdfService] ✓ Path2D set to globalThis');
}
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  globalThis.OffscreenCanvas = class OffscreenCanvas {
    constructor(width, height) {
      return canvasModule.createCanvas(width, height);
    }
  };
  console.log('[pdfService] ✓ OffscreenCanvas set to globalThis');
}

// Pre-load pdfjs-dist at module init so it sees our globals
let pdfjs = null;
let pdfjsLoadError = null;

(async () => {
  try {
    console.log('[pdfService] Starting pdfjs-dist import...');
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    console.log('[pdfService] ✓ pdfjs-dist imported successfully');
  } catch (err) {
    pdfjsLoadError = err;
    console.error('[pdfService] ✗ Failed to import pdfjs-dist:', err.message);
  }
})();

// Helper to get pdfjs, waiting briefly if still loading
async function getPdfjs() {
  // If already loaded, return immediately
  if (pdfjs) return pdfjs;
  
  // If there was an error, throw it
  if (pdfjsLoadError) throw pdfjsLoadError;
  
  // If not yet loaded, wait a bit for the async init
  for (let i = 0; i < 100; i++) {
    await new Promise(r => setTimeout(r, 50));
    if (pdfjs) return pdfjs;
    if (pdfjsLoadError) throw pdfjsLoadError;
  }
  
  // Fallback: try to import again
  console.warn('[pdfService] Module init import still pending, importing now...');
  return await import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function convertPdfToImages(pdfPath, maxPages = 3) {
  const dir = path.dirname(pdfPath);
  const baseName = path.basename(pdfPath, path.extname(pdfPath));
  const results = [];

  try {
    console.log(`[pdfService] convertPdfToImages start: ${pdfPath}`);
    console.log(`[pdfService] Available globals: DOMMatrix=${typeof globalThis.DOMMatrix}, ImageData=${typeof globalThis.ImageData}, Path2D=${typeof globalThis.Path2D}`);
    
    const pdfModule = await getPdfjs();
    const { createCanvas } = canvasModule;

    const data = new Uint8Array(await fs.promises.readFile(pdfPath));
    console.log('[pdfService] Read PDF file:', pdfPath);
    
    // pdfModule.getDocument is the entry point
    const loadingTask = pdfModule.getDocument({ data, disableWorker: true });
    const pdfDoc = await loadingTask.promise;
    console.log('[pdfService] PDF loaded, pages:', pdfDoc.numPages);
    
    const pageCount = Math.min(maxPages, pdfDoc.numPages || 0);

    for (let p = 1; p <= pageCount; p++) {
      try {
        const page = await pdfDoc.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });

        const width = Math.max(1, Math.ceil(viewport.width));
        const height = Math.max(1, Math.ceil(viewport.height));
        console.log(`[pdfService] Page ${p}: creating ${width}x${height} canvas`);
        
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');

        await page.render({ canvasContext: context, viewport }).promise;

        // Save as PNG instead of JPEG - more stable with canvas rendering
        // PNG preserves quality and is better for Vision LLM processing
        const imagePath = path.resolve(dir, `${baseName}_page_${p}.png`);
        
        // Try explicit PNG encoding with high quality
        let pngBuffer;
        try {
          // @napi-rs/canvas typically uses PNG as default format
          pngBuffer = canvas.toBuffer('image/png');
          if (!pngBuffer || pngBuffer.length === 0) {
            console.warn(`[pdfService] Page ${p} toBuffer('image/png') returned empty, trying default`);
            pngBuffer = canvas.toBuffer();
          }
        } catch (bufErr) {
          console.error(`[pdfService] toBuffer failed for page ${p}:`, bufErr.message);
          pngBuffer = canvas.toBuffer();
        }
        
        console.log(`[pdfService] Page ${p} buffer size: ${pngBuffer.length} bytes, magic: ${pngBuffer.slice(0, 4).toString('hex')}`);
        
        await fs.promises.writeFile(imagePath, pngBuffer);
        results.push(imagePath);
        console.log(`[pdfService] Saved page ${p} PNG to:`, imagePath);
        
      } catch (err) {
        console.error('PDF conversion error on page', p, err && (err.message || err));
        break;
      }
    }
    console.log('[pdfService] Successfully converted', results.length, 'pages');
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
