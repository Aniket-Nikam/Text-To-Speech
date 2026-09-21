import { parentPort, workerData } from 'node:worker_threads';
import mammoth from 'mammoth';
import yauzl from 'yauzl';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
async function validateZip(buffer) {
  await new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (err, zip) => {
      if (err) return reject(err);
      let total = 0,
        count = 0,
        document = false;
      zip.on('error', reject);
      zip.on('entry', (entry) => {
        total += entry.uncompressedSize;
        count++;
        if (entry.fileName === 'word/document.xml') document = true;
        if (total > 20 * 1024 * 1024 || count > 1000 || entry.generalPurposeBitFlag & 1) {
          zip.close();
          return reject(Error('This DOCX is too complex or encrypted.'));
        }
        zip.readEntry();
      });
      zip.on('end', () =>
        document ? resolve() : reject(Error('This file is not a valid DOCX document.')),
      );
      zip.readEntry();
    });
  });
}
async function extract() {
  const buffer = Buffer.from(workerData.buffer);
  if (workerData.extension === '.txt')
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  if (workerData.extension === '.docx') {
    await validateZip(buffer);
    return (await mammoth.extractRawText({ buffer }, { externalFileAccess: false })).value;
  }
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fontPath =
    join(
      dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json'))),
      'standard_fonts',
    ).replaceAll('\\', '/') + '/';
  const task = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl: fontPath,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 50) throw Error('Choose a PDF with 50 pages or fewer.');
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text +=
        content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join('') + '\n';
      if (text.length > 5000)
        throw Error('The extracted text exceeds 5,000 characters. Choose a shorter document.');
      page.cleanup();
    }
    return text;
  } finally {
    await task.destroy();
  }
}
try {
  const text = (await extract()).trim();
  if (!text) throw Error('No text was found. Scanned PDFs need OCR before import.');
  if (text.length > 5000)
    throw Error('The extracted text exceeds 5,000 characters. Choose a shorter document.');
  parentPort.postMessage({ text });
} catch (e) {
  parentPort.postMessage({
    error:
      e.name === 'PasswordException'
        ? 'Password-protected PDFs are not supported.'
        : e.message || 'Could not extract text from this file.',
  });
}
