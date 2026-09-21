import { writeFileSync } from 'node:fs';
const valid = {
  text: 'Hello, welcome to LabMentix.',
  language: '{{language}}',
  voice: '{{voice}}',
  speed: 1,
  pitch: 0,
  volume: 1,
};
function item(name, method, path, body, status = 200, extra = {}) {
  return {
    name,
    request: {
      method,
      header: [
        { key: 'Content-Type', value: extra.contentType || 'application/json' },
        ...(extra.auth ? [{ key: 'Authorization', value: 'Bearer {{token}}' }] : []),
      ],
      url: '{{baseUrl}}' + path,
      ...(body !== undefined
        ? {
            body: {
              mode: 'raw',
              raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2),
              options: { raw: { language: 'json' } },
            },
          }
        : {}),
    },
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            `pm.test('Expected status ${status}', () => pm.response.to.have.status(${status}));`,
            ...(status >= 400
              ? [
                  "pm.test('Consistent error contract', () => { const b = pm.response.json(); pm.expect(b.success).to.eql(false); pm.expect(b.error.code).to.be.a('string'); pm.expect(b.error.message).to.be.a('string'); });",
                ]
              : []),
            ...(extra.tests || []),
          ],
        },
      },
    ],
  };
}
const core = [
  item('Health', 'GET', '/api/health'),
  item('Configuration', 'GET', '/api/config'),
  item('Voices — choose a real default', 'GET', '/api/voices', undefined, 200, {
    tests: [
      "const voices = pm.response.json().voices; const voice = voices.find(v => v.language === 'en-US') || voices[0]; if (voice) { pm.collectionVariables.set('voice', voice.id); pm.collectionVariables.set('language', voice.language); }",
    ],
  }),
  item('Filter English voices', 'GET', '/api/voices?language=en-US'),
  item('Generate MP3', 'POST', '/api/tts', valid, 200, {
    tests: [
      "pm.test('MP3 response', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('audio/mpeg'));",
    ],
  }),
];
const invalid = [
  ...Object.entries({
    empty: { text: '' },
    whitespace: { text: '  ' },
    long: { text: 'a'.repeat(5001) },
    language: { language: 'xx-XX' },
    voice: { voice: 'missing' },
    mismatch: { language: 'hi-IN', voice: 'en-US-JennyNeural' },
    speed: { speed: 3 },
    pitch: { pitch: 60 },
    volume: { volume: 2 },
  }).map(([key, value]) => item('Reject ' + key, 'POST', '/api/tts', { ...valid, ...value }, 400)),
  item('Malformed JSON', 'POST', '/api/tts', '{"text":', 400),
  item('Incorrect Content-Type', 'POST', '/api/tts', 'hello', 415, { contentType: 'text/plain' }),
  item('Unauthorized history', 'GET', '/api/history', undefined, 401),
];
const protectedItems = [
  item('Own profile', 'GET', '/api/me', undefined, 200, { auth: true }),
  item('Save generation', 'POST', '/api/tts', { ...valid, save: true }, 200, {
    auth: true,
    tests: [
      "const id = pm.response.headers.get('X-History-Id'); if (id) pm.collectionVariables.set('historyId', id);",
    ],
  }),
  item('History', 'GET', '/api/history?offset=0', undefined, 200, { auth: true }),
  item('Replay URL', 'GET', '/api/history/{{historyId}}/audio', undefined, 200, { auth: true }),
  item('Favorite speech', 'POST', '/api/favorites', { speechId: '{{historyId}}' }, 201, {
    auth: true,
  }),
  item('Favorites', 'GET', '/api/favorites', undefined, 200, { auth: true }),
  item('Remove favorite', 'DELETE', '/api/favorites/{{historyId}}', undefined, 200, { auth: true }),
  item('Delete speech', 'DELETE', '/api/history/{{historyId}}', undefined, 200, { auth: true }),
];
const ai = ['summarize', 'grammar', 'rewrite', 'conversational'].map((action) =>
  item(
    action,
    'POST',
    '/api/ai/' + action,
    { text: 'Clear writing makes ideas easier to understand.' },
    200,
    { auth: true },
  ),
);
const manual = [
  item('Provider unavailable — run with empty Azure key', 'POST', '/api/tts', valid, 503),
  item('Rate limit — run repeatedly or RATE_LIMIT_MAX=1', 'GET', '/api/voices', undefined, 429),
  item('Admin analytics — admin token required', 'GET', '/api/admin/analytics', undefined, 200, {
    auth: true,
  }),
];
const upload = item(
  'Extract document — choose a local TXT, PDF, or DOCX file',
  'POST',
  '/api/files/extract',
  undefined,
);
upload.request.header = [];
upload.request.body = {
  mode: 'formdata',
  formdata: [{ key: 'file', type: 'file', src: '{{filePath}}' }],
};
writeFileSync(
  new URL('./TTS-API.postman_collection.json', import.meta.url),
  JSON.stringify(
    {
      info: {
        name: 'LabMentix TTS API',
        description:
          'Run Core then Validation with a configured Azure provider. Protected requests require a Supabase access token. AI requires Groq and auth. Run Manual scenarios separately; they intentionally depend on server configuration. Collection runner delay: 3200ms to respect default rate limits. No real credentials are included.',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      variable: [
        { key: 'baseUrl', value: 'http://127.0.0.1:3001' },
        { key: 'token', value: '' },
        { key: 'language', value: 'en-US' },
        { key: 'voice', value: 'en-US-JennyNeural' },
        { key: 'historyId', value: '' },
        { key: 'filePath', value: '' },
      ],
      item: [
        { name: 'Core', item: core },
        { name: 'Validation', item: invalid },
        { name: 'Authenticated history and favorites', item: protectedItems },
        { name: 'AI enhancement', item: ai },
        { name: 'File extraction — select a local file first', item: [upload] },
        { name: 'Manual scenarios', item: manual },
      ],
    },
    null,
    2,
  ),
);
