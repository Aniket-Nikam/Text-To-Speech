import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { createAi } from '../services/ai.js';
test('AI requires auth, validates inputs and returns transformed text', async () => {
  const app = createApp({
    database: { configured: true, authenticate: async () => ({ id: 'test-user' }) },
    ai: { configured: true, enhance: async (_action, text) => text + ' edited' },
  });
  assert.equal((await request(app).post('/api/ai/grammar').send({ text: 'hi' })).status, 401);
  assert.equal(
    (
      await request(app)
        .post('/api/ai/grammar')
        .set('Authorization', 'Bearer test')
        .send({ text: ' ' })
    ).status,
    400,
  );
  const r = await request(app)
    .post('/api/ai/grammar')
    .set('Authorization', 'Bearer test')
    .send({ text: 'hello' });
  assert.equal(r.body.text, 'hello edited');
});
test('AI adapter handles missing key, upstream failure, truncated and invalid responses', async () => {
  await assert.rejects(() => createAi({}).enhance('rewrite', 'Hello'), { status: 503 });
  for (const response of [
    new Response('no', { status: 429 }),
    Response.json({ choices: [] }),
    Response.json({ choices: [{ message: { content: 'hello' }, finish_reason: 'length' }] }),
  ])
    await assert.rejects(
      () => createAi({ GROQ_API_KEY: 'test' }, async () => response).enhance('grammar', 'Hello'),
      { status: 503 },
    );
});
