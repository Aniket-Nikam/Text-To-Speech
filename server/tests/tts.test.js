import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { buildSsml, createTtsProvider } from '../services/tts.js';
const provider = {
  configured: true,
  listVoices: async () => [
    { id: 'en-US-JennyNeural', language: 'en-US', styles: [] },
    { id: 'hi-IN-SwaraNeural', language: 'hi-IN', styles: [] },
  ],
  synthesize: async () => Buffer.from('ID3-test-only-audio'),
};
const valid = { text: 'Hello', language: 'en-US', voice: 'en-US-JennyNeural' };
test('saving requires authentication before contacting the provider', async () => {
  const r = await request(createApp())
    .post('/api/tts')
    .send({ ...valid, save: true });
  assert.equal(r.status, 401);
});
test('saved generation returns an ID, and storage failure preserves audio with warning', async () => {
  const database = {
    configured: true,
    authenticate: async () => ({ id: 'user' }),
    reserve: async () => {},
    logUsage: async () => {},
    save: async () => 'saved-id',
  };
  let r = await request(createApp({ provider, database }))
    .post('/api/tts')
    .set('Authorization', 'Bearer test')
    .send({ ...valid, save: true });
  assert.equal(r.status, 200);
  assert.equal(r.headers['x-history-id'], 'saved-id');
  database.save = async () => {
    throw Error('database down');
  };
  r = await request(createApp({ provider, database }))
    .post('/api/tts')
    .set('Authorization', 'Bearer test')
    .send({ ...valid, save: true });
  assert.equal(r.status, 200);
  assert.match(r.headers['x-save-warning'], /saving failed/);
  assert.match(r.headers['content-type'], /audio\/mpeg/);
});
test('rejects audio approaching the upstream duration cap', async () => {
  const p = createTtsProvider(
    { TTS_API_KEY: 'test', TTS_REGION: 'eastus' },
    async () => new Response(Buffer.alloc(3480000)),
  );
  await assert.rejects(() => p.synthesize(valid), { code: 'AUDIO_TOO_LONG' });
});
test('valid generation sends binary audio with a download filename', async () => {
  const r = await request(createApp({ provider })).post('/api/tts').send(valid);
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /audio\/mpeg/);
  assert.match(r.headers['content-disposition'], /\.mp3/);
});
for (const [name, patch] of Object.entries({
  empty: { text: '' },
  whitespace: { text: ' \n ' },
  long: { text: 'a'.repeat(5001) },
  language: { language: 'xx' },
  voice: { voice: 'nope' },
  mismatch: { language: 'hi-IN' },
  speed: { speed: 3 },
  pitch: { pitch: -51 },
  volume: { volume: 2 },
  controls: { text: 'hi\0' },
  unknown: { admin: true },
  style: { style: 'fake' },
}))
  test(`rejects ${name}`, async () => {
    const r = await request(createApp({ provider }))
      .post('/api/tts')
      .send({ ...valid, ...patch });
    assert.equal(r.status, 400);
    assert.equal(r.body.success, false);
  });
test('maximum length accepted', async () => {
  assert.equal(
    (
      await request(createApp({ provider }))
        .post('/api/tts')
        .send({ ...valid, text: 'a'.repeat(5000) })
    ).status,
    200,
  );
});
test('malformed JSON, content type, CORS and missing routes', async () => {
  const app = createApp({ provider });
  assert.equal((await request(app).post('/api/tts').type('json').send('{')).status, 400);
  assert.equal((await request(app).post('/api/tts').type('text').send('hello')).status, 415);
  assert.equal(
    (await request(app).get('/api/voices').set('Origin', 'https://evil.example')).status,
    403,
  );
  assert.equal((await request(app).get('/api/nope')).status, 404);
});
test('rate limit returns 429', async () => {
  const app = createApp({ provider, env: { RATE_LIMIT_MAX: '1' } });
  await request(app).get('/api/voices');
  const r = await request(app).get('/api/voices');
  assert.equal(r.status, 429);
  assert.equal(r.body.error.code, 'RATE_LIMITED');
});
test('SSML escapes user text and attributes', () => {
  const xml = buildSsml({
    ...valid,
    text: '<voice> & "hello"',
    speed: 0.5,
    pitch: -5,
    volume: 0.8,
  });
  assert.ok(xml.includes('&lt;voice&gt; &amp; &quot;hello&quot;'));
  assert.ok(xml.includes('rate="-50%"'));
  assert.ok(xml.includes('volume="80"'));
});
test('provider failure and non-audio response produce 503', async () => {
  for (const response of [new Response('no', { status: 401 }), new Response('this is not mp3')]) {
    const p = createTtsProvider(
      { TTS_API_KEY: 'test', TTS_REGION: 'eastus' },
      async () => response,
    );
    await assert.rejects(() => p.synthesize(valid), { status: 503 });
  }
});
