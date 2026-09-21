import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { createTtsProvider } from '../services/tts.js';
import { validateVoice } from '../utils/validation.js';
const voices = [
  { id: 'english', language: 'en-US', styles: [] },
  { id: 'hindi', language: 'hi-IN', styles: [] },
];
test('voice API filters actual provider data', async () => {
  const app = createApp({ provider: { configured: true, listVoices: async () => voices } });
  const r = await request(app).get('/api/voices?language=hi-IN');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.voices, [voices[1]]);
  assert.equal((await request(app).get('/api/voices?language[]=en-US')).status, 400);
});
test('voice compatibility rejects wrong language and style', () => {
  assert.throws(() => validateVoice({ language: 'hi-IN', voice: 'english' }, voices), {
    code: 'VOICE_LANGUAGE_MISMATCH',
  });
  assert.throws(
    () => validateVoice({ language: 'en-US', voice: 'english', style: 'cheerful' }, voices),
    { code: 'INVALID_STYLE' },
  );
});
test('unconfigured provider reports 503, never a fake catalog', async () => {
  const r = await request(createApp({ provider: createTtsProvider({}) })).get('/api/voices');
  assert.equal(r.status, 503);
  assert.equal(r.body.error.code, 'TTS_NOT_CONFIGURED');
});
