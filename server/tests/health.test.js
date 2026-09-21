import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
test('health endpoint responds with the specified contract', async () => {
  const r = await request(createApp()).get('/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { status: 'ok' });
});
