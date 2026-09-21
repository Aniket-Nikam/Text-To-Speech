import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { readFileSync } from 'node:fs';
for (const [extension, type, expected] of [
  ['pdf', 'application/pdf', 'Hello PDF world'],
  [
    'docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Hello DOCX world',
  ],
])
  test(`extracts real ${extension.toUpperCase()} document`, async () => {
    const r = await request(createApp())
      .post('/api/files/extract')
      .attach('file', readFileSync(new URL(`./fixtures/sample.${extension}`, import.meta.url)), {
        filename: `sample.${extension}`,
        contentType: type,
      });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.text, new RegExp(expected));
  });
test('TXT extraction returns editable text', async () => {
  const r = await request(createApp())
    .post('/api/files/extract')
    .attach('file', Buffer.from('Hello world'), {
      filename: 'hello.txt',
      contentType: 'text/plain',
    });
  assert.equal(r.status, 200);
  assert.equal(r.body.text, 'Hello world');
});
test('rejects empty, oversized, unsupported and spoofed uploads', async () => {
  const app = createApp();
  for (const [buffer, filename, type, status] of [
    [Buffer.from(''), 'empty.txt', 'text/plain', 400],
    [Buffer.alloc(5 * 1024 * 1024 + 1), 'large.txt', 'text/plain', 413],
    [Buffer.from('hello'), 'bad.exe', 'application/octet-stream', 400],
    [Buffer.from('not PDF'), 'fake.pdf', 'application/pdf', 400],
    [
      Buffer.from('not DOCX'),
      'fake.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      400,
    ],
  ]) {
    const r = await request(app)
      .post('/api/files/extract')
      .attach('file', buffer, { filename, contentType: type });
    assert.equal(r.status, status, filename);
  }
});
