# MedScribe STT proxy

Attaches the Anuvadini credential to a transcription request so the mobile app
never holds it. Dependency-free — `node:http` and the built-in `fetch`, nothing
installed.

**Why it exists.** The app currently calls Anuvadini directly with a Bearer
token compiled into the APK. Build-time injection keeps that token out of Git;
it does **not** make it secret inside a shipped artifact, where it can be
extracted, and rotating it means rebuilding for every installed device.
Deploying this proxy removes the credential from the device entirely. It is the
project's highest-priority piece of remaining work, and it needs no feature-code
change — see [Deploying](#deploying).

## Configuration

`server/.env`, copied from `.env.example`. Never commit the real key.

| Variable | Required | Default | Purpose |
| :-- | :-- | :-- | :-- |
| `VOICE_TO_TEXT_API_URL` | yes | — | Anuvadini endpoint |
| `VOICE_TO_TEXT_API_KEY` | yes | — | Bearer token. **The only place it exists once deployed.** |
| `TEXT_TO_SPEECH_API_URL` | no | `https://anuvadini-services.aicte-india.org/api/text-to-speech` | Text-to-speech endpoint |
| `PRAVAH_TRANSLATE_URL` | no | `https://pravahai.aicte-india.org/api/translatebulk` | Translation endpoint |
| `PRAVAH_API_KEY` | for `/translate` | — | Pravah API key (`apk_…`). A different host from Anuvadini, so a different credential. |
| `PORT` | no | `8787` | Listen port |

With a variable missing the proxy still starts and answers `/health`, but the
affected route returns `503 not_configured` — a misconfiguration is reported,
never silently treated as an upstream failure.

**This file is the fastest way to swap a credential.** It is read at process
start, so a new key needs only a proxy restart: no Gradle rebuild, no reinstall,
no code edit. A dev build with no key baked into `android/local.properties`
routes translation through this proxy automatically, because
`TRANSLATION_TRANSPORT` is `AUTO`.

## Run locally

```bash
cp server/.env.example server/.env     # then put the real key in it
npm run proxy                          # node --env-file=server/.env server/index.mjs
```

Expose it to a connected device:

```bash
adb reverse tcp:8787 tcp:8787
```

Then point the app at it — set `TRANSCRIPTION_TRANSPORT` to `'proxy'` in
[`src/config/endpoints.js`](../src/config/endpoints.js). That constant is
declared, never inferred from whichever URL happens to be set: in `direct` mode
the proxy URL is ignored entirely, even in a debug build.

Check it is up:

```bash
curl http://localhost:8787/health
```

## Contract

```
POST /voice-to-text
{ "audio_buffer": "<base64 wav>", "audio_language": "en-IN" }

200 { "success": true,  "transcription": "..." }
4xx { "success": false, "error": "missing_audio" | ... }
5xx { "success": false, "error": "unauthorized" | ... }

POST /translate
{ "items": [ { "text": "बुखार है।", "to": "en" }, ... ] }

200 { "success": true,  "results": [ { "translations": [ { "text": "..." } ] }, ... ] }
4xx { "success": false, "error": "missing_items" | ... }
5xx { "success": false, "error": "unauthorized" | ... }

GET /health -> { "success": true, "service": "medscribe-stt-proxy" }
```

`/translate` wraps the items in an object while Pravah itself takes a bare
array. The success response is shaped so the app's `readTranslations` reads it
with **one branch** and no proxy special-casing — `scripts/test-proxy-translate.mjs`
asserts the round trip rather than trusting it.

The results array is **positional**: `results[i]` is the translation of
`items[i]`. A count mismatch from upstream is rejected as `count_mismatch`
rather than padded, because silently misaligning translations would produce a
plausible but wrong medical report.

Upstream it sends `{ "audioBuffer", "audioLanguage" }` with
`Authorization: Bearer <VOICE_TO_TEXT_API_KEY>` and a 60 s timeout.

**The snake_case/camelCase split is deliberate.** The device speaks the proxy's
own contract; the proxy speaks Anuvadini's. An upstream field rename is then a
change here and not an app release.

### Errors

Every failure is one of these kinds — the client switches on the string, so
none of them may be reworded without updating
[`proxyContract.js`](../src/services/anuvadini/proxyContract.js).

| Status | `error` | Cause |
| --: | :-- | :-- |
| 400 | `invalid_json` | Body was not JSON |
| 400 | `missing_audio` | `audio_buffer` absent or empty |
| 400 | `missing_language` | `audio_language` or an item's `to` absent or empty |
| 400 | `missing_items` | `/translate` body has no non-empty `items` array |
| 400 | `missing_text` | An item's `text` is absent, blank or not a string |
| 404 | `not_found` | Path other than a known route or `/health` |
| 405 | `method_not_allowed` | A known route with a method other than POST |
| 413 | `too_large` | Body over 8 MB, over 25 items, or over 12 000 characters |
| 422 | `empty_transcription` · `empty_translation` | Upstream returned success with no text |
| 422 | `unsupported_language` | Upstream rejected the language code |
| 429 | `rate_limited` · `quota_exceeded` | Upstream rate limit, or the key's translation quota is spent |
| 502 | `unauthorized` | Upstream rejected the token |
| 502 | `bad_request` | Upstream rejected the body the **proxy** built |
| 502 | `count_mismatch` | Upstream returned a different number of translations than were sent |
| 502 | `upstream_error` · `network` · `malformed` | Upstream failed, unreachable, or answered unparseably |
| 503 | `not_configured` | The route's URL or API key is missing |
| 504 | `timeout` | Upstream exceeded 60 s |

`unauthorized` is **502, not 401** — on purpose. The client's credential is not
what was rejected; the proxy's was. Returning 401 would tell a device to
re-authenticate over something it cannot see or fix.

`quota_exceeded` is the deliberate exception: it is passed through as a real
**429**, because the app maps that status back to its own `QUOTA_EXCEEDED` kind
and latches translation off for the rest of the session. Folding it into 502
would leave the proxy path silently never latching.

## What it will not do

- Return, log or echo the credential — including in an error.
- Log the Base64 audio or the transcript. The log line is status, request size
  and timing; a consultation never reaches the console.
- Buffer a body over 8 MB, and it refuses an oversized `Content-Length` *before*
  reading. One request carries at most a 45 s chunk
  (`SAFE_CHUNK_SECONDS` in [`audioBudget.js`](../src/services/audioBudget.js)),
  so that is ample headroom.
- Retry. Transcription is expensive and not known to be idempotent, so a repeat
  is the doctor's explicit choice, made in the app. The app's own retry re-sends
  only the chunks that have not yet succeeded.

## Tests

```bash
npm run test:proxy      # 77 assertions, plain Node, no framework
```

`createProxyServer` and `handleVoiceToText` are both exported so the suite
drives the handler without opening a socket. It covers field translation, every
error mapping above, the guards that must fire *before* any upstream call, and —
the load-bearing ones — that the credential appears in no result, no error and
no log line.

## Deploying

Three steps, no feature code:

1. Host this directory behind **HTTPS** with `VOICE_TO_TEXT_API_URL` and
   `VOICE_TO_TEXT_API_KEY` in the environment. It is a plain Node process with
   no dependencies and no build step: `node server/index.mjs`.
2. Point `MEDSCRIBE_PROXY_BASE_URL` at it and set `TRANSCRIPTION_TRANSPORT` to
   `TRANSPORT.PROXY` in [`src/config/endpoints.js`](../src/config/endpoints.js).
3. Drop `ANUVADINI_STT_TOKEN` from `android/local.properties` and rebuild. The
   token is gone from the device.

HTTPS is not optional: the request body is a recording of a consultation.

Rotating the key afterwards is an environment change on one host, not a rebuild
and redistribution to every phone — which is the whole point of the exercise.
