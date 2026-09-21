import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { parse } from '../utils/validation.js';
const idSchema = z.uuid();
export function accountRoutes(database) {
  const router = Router();
  router.use(['/me', '/history', '/favorites', '/admin'], requireAuth);
  router.get('/me', async (req, res) =>
    res.json({ success: true, profile: await database.profile(req.user) }),
  );
  router.get('/history', async (req, res) => {
    const offset = parse(z.coerce.number().int().min(0).max(100000).default(0), req.query.offset);
    res.json({ success: true, ...(await database.history(req.user, offset)) });
  });
  router.get('/history/:id/audio', async (req, res) =>
    res.json({
      success: true,
      audioUrl: await database.audio(req.user, parse(idSchema, req.params.id)),
    }),
  );
  router.delete('/history/:id', async (req, res) => {
    await database.remove(req.user, parse(idSchema, req.params.id));
    res.json({ success: true });
  });
  router.get('/favorites', async (req, res) =>
    res.json({ success: true, favorites: await database.favorites(req.user) }),
  );
  router.post('/favorites', async (req, res) => {
    const { speechId } = parse(z.object({ speechId: idSchema }).strict(), req.body);
    await database.favorite(req.user, speechId);
    res.status(201).json({ success: true });
  });
  router.delete('/favorites/:id', async (req, res) => {
    await database.unfavorite(req.user, parse(idSchema, req.params.id));
    res.json({ success: true });
  });
  router.get('/admin/analytics', async (req, res) =>
    res.json({ success: true, analytics: await database.analytics(req.user) }),
  );
  return router;
}
