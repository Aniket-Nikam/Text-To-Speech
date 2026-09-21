# Verification and release checklist

Final local result: **production build passed; 33 backend tests and 14 frontend
tests passed (47 total)**. Dependencies installed with zero reported vulnerabilities.
These results establish the local implementation checks, not live cloud readiness.

## Automated checks

`npm run check` runs TypeScript, Vite production build, all Supertest API tests,
and Vitest component/hook tests. The backend tests use explicit injected adapters
to cover provider contracts without spending API quota. Real TXT/PDF/DOCX fixture
files pass through the actual extraction worker.

Coverage includes the health contract, live-catalog filtering, invalid/empty/long
input, exact character boundary, multilingual text, mismatch/style validation,
SSML escaping, binary response, provider failure/invalid audio, CORS, malformed
JSON, MIME/size errors, rate limits, authentication enforcement, user identity
propagation, non-admin rejection, AI input/upstream errors, preview/apply semantics,
counts, import, reset, playback bindings, downloads, request duplication, and
network/invalid-response handling.

The native browser audio implementation is not emulated by jsdom. Component tests
verify the controls, source, download attribute, replay binding, and error feedback.
Actual generated MP3 playback must be checked with a configured Azure account.

## Browser review performed locally

- Desktop and 390px mobile studio layout inspected; no horizontal overflow on
  mobile (document width and scroll width matched).
- Sample insertion updated to 31 words / 183 characters; Clear returned to zero.
- Unconfigured-provider state displayed truthful guidance and disabled generation.
- Fixed literal newline in placeholder and explicitly labeled settings sliders.
- Browser console review found no JavaScript errors or warnings.

## Required live checks after configuration

1. Verify `/api/health`, `/api/config`, and `/api/voices` on the actual backend.
2. Confirm English, Hindi, Marathi, Gujarati, Spanish, French, and German are
   returned by the regional provider. Verify voice changes with each language.
3. Generate your own short text. Play, pause, seek, change playback volume, replay,
   download the MP3, and open the downloaded file outside the app.
4. Test speed/pitch/volume and one style that the provider advertises. Test long
   passages conservatively; Azure REST has a maximum synthesis duration.
5. Register two distinct accounts and confirm email. Save a speech in account A.
   Verify account B cannot read its history, create a favorite for it, obtain its
   signed audio URL, or delete it by substituting account A's speech UUID.
6. Run the RLS checks in `supabase/tests/rls.sql` against a disposable configured
   project. Verify users cannot promote their own role or bypass daily quotas.
7. Verify favorites survive refresh, saved settings/text are correct, pagination
   works beyond 20 entries, and logout protects History.
8. Generate with saving enabled while simulating a storage failure in a test
   environment; verify the successful MP3 still downloads with a save warning.
9. Run cleanup with an old test record; verify its audio path becomes null and its
   text remains available. Verify orphan retention behavior as documented.
10. Run each Groq action. Edit the preview, discard it, and apply it; verify the
    source text never changes automatically.
11. Assign an admin role from trusted SQL. Verify analytics reflect actual logged
    generations and an ordinary user's token receives 403.
12. Run the Postman folders with their documented prerequisites and runner delay.
    Use the manual folder only for matching failure scenarios.
13. On Vercel test direct visits/refreshes to `/history` and `/login`; verify HTTPS,
    deployed CORS, Supabase redirect URLs, Render cold-start recovery, and no
    private secrets in downloaded JS or Git history.

Do not describe these live checks as completed until performed. No live credentials
or public hosting accounts were supplied during implementation.
