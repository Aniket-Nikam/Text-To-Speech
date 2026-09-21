# Development record

## Phase 0 — analysis

The initial repository contained only `.git`. No application, manifests, assets,
or repository-specific instructions existed. No existing code was removed.

## Architecture and phase plan

1. npm workspaces; Vite/React/TypeScript/Tailwind client; Express health endpoint.
2. Editor validation, counts, clear, and TXT import.
3. Provider-backed language and voice selection.
4. Azure REST adapter and validated MP3 generation.
5. Native accessible audio playback, replay, and download.
6. API security, automated regression tests, and Postman contracts.
7. Supabase authentication, protected history, and favorites with RLS.
8. PDF and DOCX text extraction with resource limits.
9. Optional backend Groq enhancement with editable preview.
10. Private cloud audio, usage quotas, retention, and real admin analytics.
11. Vercel/Render manifests and deployment instructions.
12. Full build, regression tests, browser review, and security review.

External credentials are not provided. Live provider generation, cloud database,
authentication, AI, and deployment must be verified after service configuration.
Tests use explicitly injected test adapters; the shipped application never returns
mock audio or a fabricated voice catalog.

## Phase outcomes and files

| Phase | Result and verification                                                                                                                                                                                                           | Main files created or modified                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1     | Vite production build and health test passed; both dev servers ran; frontend proxy returned health JSON. Windows child-process sandbox restrictions required an elevated build/test invocation.                                   | Root/client/server manifests, client entry points and Tailwind stylesheet, server startup/app, health test, env examples |
| 2     | Editor counts, boundary/Unicode validation, clear, TXT import. Fixed incompatible string method; build and four tests passed.                                                                                                     | TextInput, FileUpload, Buttons, text utility/tests                                                                       |
| 3     | Regional catalog, language selectors, compatibility validation. Fixed rejection of malformed language query keys. Build and catalog tests passed.                                                                                 | tts service, validation utility, useVoices, VoiceSelectors, voices tests                                                 |
| 4     | Azure SSML adapter and binary MP3 endpoint. Provider errors and schema/security cases passed, 22 backend tests.                                                                                                                   | server/app.js, services/tts.js, utils/validation.js, tts tests                                                           |
| 5     | Studio assembled with settings, audio playback, replay/download, and lifecycle handling. Production build and 11 client tests passed.                                                                                             | Studio, AudioCustomization, AudioPlayer, useSpeech, stylesheet, component tests                                          |
| 6     | Exact CORS, rate limits, safe errors, Postman collection and test scripts. Build and API security regression tests passed.                                                                                                        | server middleware/app/errors, postman generator and exported collection                                                  |
| 7     | Auth, protected history, favorites, private storage service and RLS migration. Build, 24 server and 11 client tests passed. Live Supabase verification requires configuration.                                                    | database service, account/auth routes, AuthContext, Auth/History pages, ProtectedRoute, SQL migration                    |
| 8     | TXT/PDF/DOCX import with resource bounds. Fixed multipart limit that rejected valid files. Worker extraction and malformed/oversized file tests passed. Real PDF/DOCX fixtures added in final verification.                       | file routes, extraction services, FileUpload, files tests and fixtures                                                   |
| 9     | Four Groq operations, authentication/rate limits, preview/edit/apply/discard UI. Build, 28 server and 12 client tests passed.                                                                                                     | AI service/routes/tests, AiEnhancement and preview tests                                                                 |
| 10    | Atomic user quota, guest quota, synthesis capacity, private retention/orphan cleanup, real admin analytics. Build and regression tests passed.                                                                                    | usage middleware, database service, cleanup script, Admin page, SQL functions                                            |
| 11    | Hosting manifests, CI, opt-in scheduled retention, complete setup/API/verification documentation. No deployment or external accounts created.                                                                                     | vercel.json, render.yaml, .github/workflows, README, docs/API.md                                                         |
| 12    | Actual desktop/mobile browser review, extraction fixtures, hook error tests, source formatting, final build/test run. Fixed placeholder newline, slider names, upload-disconnect capacity accounting, and session error handling. | Client controls/context, server/routes/files.js, tests, docs/VERIFICATION.md                                             |

## External checks still required

Azure synthesis and pronunciation; Supabase registration, PostgreSQL migration/RLS,
storage, quotas and retention; Groq completion; Vercel/Render HTTPS deployment.
Their adapters and documentation are implemented, but injected test doubles do not
establish that a user's cloud accounts are configured correctly.
