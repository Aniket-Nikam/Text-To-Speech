import { Router } from 'express';
import multer from 'multer';
import { extname } from 'node:path';
import { ApiError } from '../utils/errors.js';
import { parse, textSchema } from '../utils/validation.js';
import { extractText } from '../services/extraction.js';
const types = {
  '.txt': ['text/plain', 'application/octet-stream'],
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};
export function fileRoutes() {
  const router = Router();
  let active = 0;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
    fileFilter(_req, file, cb) {
      if (!types[extname(file.originalname).toLowerCase()]?.includes(file.mimetype))
        return cb(
          new ApiError(
            400,
            'UNSUPPORTED_FILE',
            'Choose a TXT, PDF, or DOCX file with the matching file type.',
          ),
        );
      cb(null, true);
    },
  }).single('file');
  router.post('/files/extract', (req, res, next) => {
    if (active >= 2)
      return next(
        new ApiError(
          429,
          'EXTRACTION_BUSY',
          'The document reader is busy. Please try again shortly.',
        ),
      );
    active++;
    let released = false;
    let parsing = false;
    const release = () => {
      if (!released) {
        released = true;
        active--;
      }
    };
    res.once('close', () => {
      if (!parsing) release();
    });
    upload(req, res, async (err) => {
      try {
        if (req.aborted) return;
        parsing = true;
        if (err)
          throw err instanceof ApiError
            ? err
            : new ApiError(
                err.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
                'INVALID_UPLOAD',
                err.code === 'LIMIT_FILE_SIZE'
                  ? 'Choose a file smaller than 5 MB.'
                  : 'Upload exactly one file using the file field.',
              );
        if (!req.file) throw new ApiError(400, 'FILE_REQUIRED', 'Choose a file to import.');
        const extension = extname(req.file.originalname).toLowerCase(),
          buffer = req.file.buffer;
        if (extension === '.pdf' && buffer.subarray(0, 5).toString() !== '%PDF-')
          throw new ApiError(400, 'INVALID_FILE', 'This file is not a valid PDF.');
        if (extension === '.docx' && buffer.subarray(0, 4).toString('hex') !== '504b0304')
          throw new ApiError(400, 'INVALID_FILE', 'This file is not a valid DOCX.');
        const text = parse(textSchema, await extractText(buffer, extension));
        res.json({ success: true, text });
      } catch (error) {
        next(error);
      } finally {
        release();
      }
    });
  });
  return router;
}
