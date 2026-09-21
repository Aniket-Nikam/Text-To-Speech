import { ApiError } from '../utils/errors.js';
export function optionalAuth(database) {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header) return next();
    if (!header.startsWith('Bearer ') || header.length > 8192)
      throw new ApiError(401, 'INVALID_SESSION', 'Please sign in again.');
    if (!database.configured)
      throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Account services are not configured.');
    req.user = await database.authenticate(header.slice(7));
    next();
  };
}
export function requireAuth(req, _res, next) {
  if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to access your saved speech.');
  next();
}
