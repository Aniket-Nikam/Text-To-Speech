import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { parse, textSchema } from '../utils/validation.js';
export function aiRoutes(service) {
  const router = Router();
  router.use(
    '/ai',
    requireAuth,
    rateLimit({
      windowMs: 3600000,
      limit: 20,
      keyGenerator: (req) => req.user.id,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json({
          success: false,
          error: {
            code: 'AI_RATE_LIMITED',
            message: 'You have used your 20 text enhancements for this hour. Please try later.',
          },
        }),
    }),
  );
  router.post('/ai/:action', async (req, res) => {
    const { text } = parse(z.object({ text: textSchema }).strict(), req.body);
    res.json({ success: true, text: await service.enhance(req.params.action, text) });
  });
  return router;
}
