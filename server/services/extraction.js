import { Worker } from 'node:worker_threads';
import { ApiError } from '../utils/errors.js';
export function extractText(buffer, extension) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./extract-worker.js', import.meta.url), {
      workerData: { buffer, extension },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 },
    });
    let settled = false;
    const finish = (error, text) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      error ? reject(error) : resolve(text);
    };
    const timer = setTimeout(
      () =>
        finish(
          new ApiError(
            400,
            'EXTRACTION_TIMEOUT',
            'This file took too long to read. Choose a simpler document.',
          ),
        ),
      15000,
    );
    worker.once('message', (result) =>
      result.error
        ? finish(new ApiError(400, 'EXTRACTION_FAILED', result.error))
        : finish(null, result.text),
    );
    worker.once('error', () =>
      finish(
        new ApiError(
          400,
          'EXTRACTION_FAILED',
          'This file could not be read safely. Choose a smaller or simpler document.',
        ),
      ),
    );
    worker.once('exit', () => {
      if (!settled)
        finish(new ApiError(400, 'EXTRACTION_FAILED', 'The document reader stopped unexpectedly.'));
    });
  });
}
