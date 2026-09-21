import { rateLimit } from 'express-rate-limit';
// In-memory guest quota is suitable for one server instance. Use a shared store
// before scaling replicas. Signed-in quotas are atomic in PostgreSQL.
export function guestQuota(env) {
  return rateLimit({
    windowMs: 86400000,
    limit: Number(env.DAILY_GENERATION_LIMIT) || 50,
    skip: (req) => !!req.user,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: {
          code: 'DAILY_LIMIT',
          message: 'You have reached the guest generation limit. Please try again tomorrow.',
        },
      }),
  });
}
export function synthesisCapacity() {
  let active = 0;
  return async (_req, res, next) => {
    if (active >= 4)
      return res.status(429).json({
        success: false,
        error: {
          code: 'SERVER_BUSY',
          message: 'All speech workers are busy. Please try again shortly.',
        },
      });
    active++;
    let released = false;
    res.locals.releaseSynthesis = () => {
      if (!released) {
        released = true;
        active--;
      }
    };
    next();
  };
}
