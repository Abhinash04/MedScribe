# MedScribe STT proxy

Attaches the Anuvadini credential to a transcription request so the mobile app
never holds it. Dependency-free — Node 18+ only.

## Run

```bash
cp server/.env.example server/.env     # then put the real key in it
npm run proxy
```

Expose it to a connected device:

```bash
adb reverse tcp:8787 tcp:8787
```

The debug build of the app points at `http://localhost:8787`, which the reverse
tunnel maps to this process. Release builds do not — they require an HTTPS
deployment, which is a hosting step, not a code change.

## Contract

```
POST /voice-to-text
{ "audio_buffer": "<base64 wav>", "audio_language": "en-IN" }

200 { "success": true,  "transcription": "..." }
4xx { "success": false, "error": "missing_audio" | "too_large" | ... }
5xx { "success": false, "error": "unauthorized" | "timeout" | "upstream_error" | ... }

GET /health -> { "success": true, "service": "medscribe-stt-proxy" }
```

Upstream it sends `{ "audioBuffer", "audioLanguage" }` with
`Authorization: Bearer <VOICE_TO_TEXT_API_KEY>` and a 60 s timeout.

## What it will not do

- Return, log or echo the credential — including in an error.
- Log the Base64 audio or the transcript. The log line is status, request size
  and timing; a consultation never reaches the console.
- Buffer a body over 8 MB, which is the 120 s capture ceiling plus headroom.
- Retry. Transcription is expensive and not known to be idempotent, so a repeat
  is the doctor's explicit choice, made in the app.
