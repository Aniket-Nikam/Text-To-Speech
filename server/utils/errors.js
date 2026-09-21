export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500,
    code = err.code || 'INTERNAL_ERROR',
    message = err.message;
  if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request contains malformed JSON.';
  }
  if (err.type === 'entity.too.large') {
    status = 413;
    code = 'REQUEST_TOO_LARGE';
    message = 'This request is too large.';
  }
  if (!(err instanceof ApiError) && !err.type) {
    status = 500;
    code = 'INTERNAL_ERROR';
    message = 'Something went wrong. Please try again.';
  }
  if (status >= 500)
    console.error(
      JSON.stringify({ event: 'request_failed', method: req.method, path: req.path, code, status }),
    );
  res.status(status).json({ success: false, error: { code, message } });
}
