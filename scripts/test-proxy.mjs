/**
 * Transcription proxy fixtures.
 *
 *   node scripts/test-proxy.mjs
 *
 * The proxy exists so the Anuvadini credential is never on a phone. Most of
 * these assertions are therefore negative: the key must not appear in any
 * response, the audio must not appear in any error, and a malformed or oversized
 * request must be refused before it costs an upstream call.
 */
import { handleVoiceToText, MAX_BODY_BYTES, REQUEST_ERROR } from '../server/index.mjs';
import { UPSTREAM_ERROR, readConfig, transcribe } from '../server/anuvadini.mjs';

import { check, report } from './lib/fixture-harness.mjs';

const KEY = 'test-key-do-not-log';
const CONFIG = { url: 'https://upstream.test/api/voice-to-text', key: KEY };
const AUDIO = 'UklGRiQAAABXQVZF';

const fakeFetch = (status, body, { throws = null } = {}) => {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    if (throws) {
      throw throws;
    }
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => {
        if (body === 'INVALID') {
          throw new Error('Unexpected token');
        }
        return body;
      },
    };
  };
  impl.calls = calls;
  return impl;
};

const call = (body, fetchImpl) =>
  handleVoiceToText(body, { config: CONFIG, fetchImpl });

const REQUEST = { audio_buffer: AUDIO, audio_language: 'en-IN' };

// ── 1. Field translation ────────────────────────────────────────────────────
const ok = fakeFetch(200, { transcription: '  Patient name is Nisha Verma.  ' });
const success = await call(REQUEST, ok);

check('P1.1 success status', success.status, 200);
check('P1.2 success envelope', success.body.success, true);
check('P1.3 transcript trimmed', success.body.transcription, 'Patient name is Nisha Verma.');

const sent = JSON.parse(ok.calls[0].init.body);
check('P1.4 audio_buffer → audioBuffer', sent.audioBuffer, AUDIO);
check('P1.5 audio_language → audioLanguage', sent.audioLanguage, 'en-IN');
check('P1.6 no other fields forwarded', Object.keys(sent).sort(), [
  'audioBuffer',
  'audioLanguage',
]);
check('P1.7 posted to the configured upstream', ok.calls[0].url, CONFIG.url);
check('P1.8 method is POST', ok.calls[0].init.method, 'POST');

// ── 2. The credential ───────────────────────────────────────────────────────
check(
  'P2.1 bearer attached upstream',
  ok.calls[0].init.headers.Authorization,
  `Bearer ${KEY}`,
);
check(
  'P2.2 the key never reaches the client on success',
  JSON.stringify(success.body).includes(KEY),
  false,
);

// Every failure envelope is checked for the key as well — an error path is the
// easiest place for a secret to escape.
const failures = [
  ['P2.3 unauthorized', fakeFetch(401, {}), UPSTREAM_ERROR.UNAUTHORIZED, 502],
  ['P2.4 forbidden', fakeFetch(403, {}), UPSTREAM_ERROR.UNAUTHORIZED, 502],
  ['P2.5 rate limited', fakeFetch(429, {}), UPSTREAM_ERROR.RATE_LIMITED, 429],
  ['P2.6 upstream 500', fakeFetch(500, {}), UPSTREAM_ERROR.UPSTREAM_ERROR, 502],
  ['P2.7 unparseable body', fakeFetch(200, 'INVALID'), UPSTREAM_ERROR.MALFORMED, 502],
  ['P2.8 missing transcription', fakeFetch(200, {}), UPSTREAM_ERROR.MALFORMED, 502],
  ['P2.9 empty transcription', fakeFetch(200, { transcription: '   ' }), UPSTREAM_ERROR.EMPTY_TRANSCRIPTION, 422],
  [
    'P2.10 network failure',
    fakeFetch(0, null, { throws: new Error('ECONNREFUSED') }),
    UPSTREAM_ERROR.NETWORK,
    502,
  ],
];

for (const [label, impl, kind, status] of failures) {
  const result = await call(REQUEST, impl);
  check(`${label} → ${kind}`, result.body.error, kind);
  check(`${label} → status ${status}`, result.status, status);
  check(`${label} → not success`, result.body.success, false);
  check(`${label} → no key leaked`, JSON.stringify(result.body).includes(KEY), false);
  check(`${label} → no audio echoed`, JSON.stringify(result.body).includes(AUDIO), false);
}

// ── 3. Rejected before any upstream call ────────────────────────────────────
const guards = [
  ['P3.1 missing audio', { audio_language: 'en-IN' }, REQUEST_ERROR.MISSING_AUDIO],
  ['P3.2 empty audio', { audio_buffer: '', audio_language: 'en-IN' }, REQUEST_ERROR.MISSING_AUDIO],
  ['P3.3 audio not a string', { audio_buffer: 42, audio_language: 'en-IN' }, REQUEST_ERROR.MISSING_AUDIO],
  ['P3.4 missing language', { audio_buffer: AUDIO }, REQUEST_ERROR.MISSING_LANGUAGE],
  ['P3.5 empty language', { audio_buffer: AUDIO, audio_language: '' }, REQUEST_ERROR.MISSING_LANGUAGE],
  ['P3.6 empty body', {}, REQUEST_ERROR.MISSING_AUDIO],
];

for (const [label, body, kind] of guards) {
  const impl = fakeFetch(200, { transcription: 'x' });
  const result = await call(body, impl);
  check(`${label} → ${kind}`, result.body.error, kind);
  check(`${label} → 400`, result.status, 400);
  check(`${label} → upstream untouched`, impl.calls.length, 0);
}

// ── 4. Timeout ──────────────────────────────────────────────────────────────
const hang = async (url, init) => {
  await new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
};
const timedOut = await handleVoiceToText(REQUEST, {
  config: CONFIG,
  fetchImpl: hang,
  timeoutMs: 30,
});
check('P4.1 timeout maps to 504', timedOut.status, 504);
check('P4.2 timeout kind', timedOut.body.error, UPSTREAM_ERROR.TIMEOUT);

// ── 5. Not configured ───────────────────────────────────────────────────────
const unconfigured = fakeFetch(200, { transcription: 'x' });
const noKey = await handleVoiceToText(REQUEST, {
  config: { url: CONFIG.url, key: '' },
  fetchImpl: unconfigured,
});
check('P5.1 missing key → not_configured', noKey.body.error, UPSTREAM_ERROR.NOT_CONFIGURED);
check('P5.2 missing key → 503', noKey.status, 503);
check('P5.3 nothing sent without a key', unconfigured.calls.length, 0);

const noUrl = await transcribe(
  { audioBuffer: AUDIO, audioLanguage: 'en-IN' },
  { config: { url: '', key: KEY }, fetchImpl: fakeFetch(200, {}) },
);
check('P5.4 missing url → not_configured', noUrl.error, UPSTREAM_ERROR.NOT_CONFIGURED);

// Synthesis shares the credential and defaults to the published endpoint, so a
// deployment that only sets the two transcription variables still speaks.
check('P5.5 config reads the documented variables', readConfig({
  VOICE_TO_TEXT_API_URL: 'u',
  VOICE_TO_TEXT_API_KEY: 'k',
}), {
  url: 'u',
  key: 'k',
  ttsUrl: 'https://anuvadini-services.aicte-india.org/api/text-to-speech',
});

check('P5.6 the speech endpoint is overridable', readConfig({
  VOICE_TO_TEXT_API_URL: 'u',
  VOICE_TO_TEXT_API_KEY: 'k',
  TEXT_TO_SPEECH_API_URL: 'tts',
}).ttsUrl, 'tts');

// ── 6. The body cap matches the capture ceiling ─────────────────────────────
const { MAX_UPLOAD_BYTES } = await import('../src/services/audioBudget.js');
const { base64CharsFor } = await import('../src/services/audioBudget.js');
check(
  'P6.1 the cap admits a capture at the client ceiling',
  base64CharsFor(MAX_UPLOAD_BYTES) < MAX_BODY_BYTES,
  true,
);
check('P6.2 the cap is 8 MB', MAX_BODY_BYTES, 8 * 1024 * 1024);

report();
