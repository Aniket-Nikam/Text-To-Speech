# REST API

Base URL: the Express origin. Successful JSON responses use `success: true`, except
the exact health contract. TTS returns **binary `audio/mpeg`**, not JSON/base64.
Mutation bodies must be JSON unless explicitly multipart. All data endpoints are
`Cache-Control: no-store`. Authentication uses `Authorization: Bearer <access_token>`.

| Method | Path                         | Auth     | Result                                                                 |
| ------ | ---------------------------- | -------- | ---------------------------------------------------------------------- |
| GET    | `/api/health`                | No       | `{ "status": "ok" }`                                                   |
| GET    | `/api/config`                | No       | `tts`, `auth`, `ai`, `maxCharacters` capability flags                  |
| GET    | `/api/voices?language=en-US` | No       | `{success, voices:[{id,name,language,localeName,gender,type,styles}]}` |
| POST   | `/api/tts`                   | Optional | MP3 bytes; optional `X-History-Id` or `X-Save-Warning` header          |
| POST   | `/api/files/extract`         | No       | Multipart `file`; `{success,text}`                                     |
| GET    | `/api/me`                    | Yes      | Own `profile`                                                          |
| GET    | `/api/history?offset=0`      | Yes      | `items`, `total`; 20 items, newest first                               |
| GET    | `/api/history/:id/audio`     | Yes      | `{success,audioUrl}`; private signed URL valid for 300 seconds         |
| DELETE | `/api/history/:id`           | Yes      | Removes owned audio, history, and cascading favorite                   |
| GET    | `/api/favorites`             | Yes      | `{success,favorites:[{speech_id,created_at}]}`                         |
| POST   | `/api/favorites`             | Yes      | `{speechId:UUID}`; idempotent favorite, HTTP 201                       |
| DELETE | `/api/favorites/:id`         | Yes      | Removes favorite for speech UUID                                       |
| POST   | `/api/ai/summarize`          | Yes      | `{text}` → `{success,text}`                                            |
| POST   | `/api/ai/grammar`            | Yes      | Same                                                                   |
| POST   | `/api/ai/rewrite`            | Yes      | Same                                                                   |
| POST   | `/api/ai/conversational`     | Yes      | Same                                                                   |
| GET    | `/api/admin/analytics`       | Admin    | `{success,analytics}` from actual PostgreSQL aggregates                |

## Generate speech

```json
{
  "text": "Hello, welcome to the speech studio.",
  "language": "en-US",
  "voice": "en-US-JennyNeural",
  "speed": 1,
  "pitch": 0,
  "volume": 1,
  "style": "",
  "save": false
}
```

Choose a real voice from `/api/voices`; the example is not a guaranteed regional
catalog entry. Required: text, language, voice. Defaults: speed 1, pitch 0, volume
1, empty style, save false. Unknown fields are rejected. `save:true` requires
authentication. Text limit: 5,000 UTF-16 code units, non-whitespace. Speed 0.5–2,
pitch −50–50%, volume 0–1; styles must be present in the voice metadata.

Success: HTTP 200, `Content-Type: audio/mpeg`,
`Content-Disposition: attachment; filename="labmentix-speech.mp3"`.
Browser clients create a Blob URL for playback/download. They must check the
Content-Type instead of interpreting an error page as audio. Saving failure does
not discard a successful generation: read `X-Save-Warning` and offer download.

## Error contract and status codes

```json
{
  "success": false,
  "error": {
    "code": "VOICE_LANGUAGE_MISMATCH",
    "message": "Choose a voice that matches the selected language."
  }
}
```

- 400: invalid fields, mismatched voice, invalid upload, malformed JSON.
- 401: missing/expired/invalid authentication.
- 403: disallowed browser origin or missing admin role.
- 404: route, speech, or retained audio not found; cross-user lookup also uses 404.
- 413: JSON body or file exceeds the allowed size.
- 415: incorrect mutation Content-Type.
- 429: rate limit, daily quota, or worker-capacity limit; inspect rate limit headers.
- 500: unexpected server error, without internal stack/message disclosure.
- 503: provider credentials missing, upstream quota/network/auth failure, invalid
  upstream response, or database/storage unavailable.

Health reports that the web process is alive; it deliberately does not claim that
Azure or Supabase are reachable. `/api/config` reports configured capabilities, not
live upstream health. `/api/voices` is the first real speech-provider health check.

## File import

Use one multipart field named `file`. TXT must be UTF-8; accepted extension/MIME
pairs are TXT/text-plain, PDF/application-pdf, DOCX/Office document MIME. The TXT
octet-stream MIME fallback is accepted, but content is still validated. Maximum
5 MB, extracted 5,000 characters, PDF 50 pages, DOCX total expansion 20 MB and
1,000 entries. Encrypted or malformed files fail; the server never generates speech
automatically after extraction.

## Authentication outside the app

Use Supabase's email/password token endpoint to obtain an access token for Postman:
`POST <SUPABASE_URL>/auth/v1/token?grant_type=password`, public key in `apikey`,
JSON `{ "email": "your account", "password": "your password" }`.
Use the returned `access_token` only in a local Postman variable, never in an
exported collection. Registration/login are owned by Supabase Auth rather than a
duplicate Express password database.
