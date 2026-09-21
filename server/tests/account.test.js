import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { ApiError } from '../utils/errors.js';
const user = { id: 'user-a' };
const database = {
  configured: true,
  authenticate: async (token) => {
    if (token !== 'valid') throw new ApiError(401, 'INVALID_SESSION', 'Sign in again.');
    return user;
  },
  profile: async () => ({ role: 'user' }),
  history: async (u) => ({ items: [{ user_id: u.id }], total: 1 }),
  audio: async () => {
    throw new ApiError(404, 'SPEECH_NOT_FOUND', 'Not found.');
  },
  analytics: async () => {
    throw new ApiError(403, 'ADMIN_REQUIRED', 'Admin only.');
  },
};
test('protected routes require authentication and reject forged tokens', async () => {
  const app = createApp({ database });
  for (const path of ['/api/history', '/api/favorites', '/api/me', '/api/admin/analytics'])
    assert.equal((await request(app).get(path)).status, 401);
  assert.equal(
    (await request(app).get('/api/history').set('Authorization', 'Bearer forged')).status,
    401,
  );
});
test('history receives verified identity, other ownership is inaccessible', async () => {
  const app = createApp({ database });
  const r = await request(app)
    .get('/api/history?user_id=user-b')
    .set('Authorization', 'Bearer valid');
  assert.equal(r.status, 200);
  assert.equal(r.body.items[0].user_id, 'user-a');
  assert.equal(
    (
      await request(app)
        .get('/api/history/123e4567-e89b-42d3-a456-426614174000/audio')
        .set('Authorization', 'Bearer valid')
    ).status,
    404,
  );
  assert.equal(
    (await request(app).get('/api/admin/analytics').set('Authorization', 'Bearer valid')).status,
    403,
  );
});
