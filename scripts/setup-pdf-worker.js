import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
const pdfWorkerPath = path.join(pdfjsDistPath, 'build', 'pdf.worker.mjs');

// Create public directory if it doesn't exist
if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public', { recursive: true });
}

fs.cpSync(pdfWorkerPath, './public/pdf.worker.mjs', { recursive: true });
