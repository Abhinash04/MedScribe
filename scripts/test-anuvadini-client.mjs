/**
 * Transcription client fixtures.
 *
 *   node scripts/test-anuvadini-client.mjs
 *
 * The client talks to the MedScribe proxy, never to Anuvadini directly, so
 * these assertions are about our own contract. The negative cases carry the
 * weight: a refinement that fails must leave the consultation untouched, and no
 * failure path may ever echo the audio back into an error.
 */
import {
  ANUVADINI_STT_URL,
  TRANSCRIPTION_TRANSPORT,
  TRANSPORT,
  resolveTransport,
} from '../src/config/endpoints.js';
import {
  ERROR_KIND,
  buildDirectRequestBody,
  buildRequestBody,
  readTranscription,
} from '../src/services/anuvadini/proxyContract.js';
import {
  isSupportedLanguage,
  normalizeAnuvadiniLanguage,
} from '../src/services/anuvadini/language.js';
import {
  MAX_AUDIO_BASE64_CHARS,
  transcribe,
} from '../src/services/anuvadini/transcriptionClient.js';

import { check, report } from './lib/fixture-harness.mjs';

const URL = 'https://proxy.test/voice-to-text';
const AUDIO = 'QUJDREVGRw==';
const TOKEN = 'test-token-must-not-leak';

const transportReturning = (status, body) => {
  const calls = [];
  const transport = async request => {
    calls.push(request);
    return { status, body };
  };
  transport.calls = calls;
  return transport;
};

const transportThrowing = error => {
  const calls = [];
  const transport = async request => {
    calls.push(request);
    throw error;
  };
  transport.calls = calls;
  return transport;
};

// The shipped transport is `direct`, so every shared case carries a token —
// without one the client correctly refuses before sending anything.
const run = (transport, overrides = {}) =>
  transcribe({
    audioBase64: AUDIO,
    language: 'en',
    url: URL,
    token: TOKEN,
    transport,
    ...overrides,
  });

// ── 1. Language normalization ───────────────────────────────────────────────
check('A1.1 en → en-IN', normalizeAnuvadiniLanguage('en'), 'en-IN');
check('A1.2 already tagged', normalizeAnuvadiniLanguage('en-IN'), 'en-IN');
check('A1.3 case insensitive', normalizeAnuvadiniLanguage('EN'), 'en-IN');
check('A1.4 hindi', normalizeAnuvadiniLanguage('hi'), 'hi-IN');
check('A1.5 default when absent', normalizeAnuvadiniLanguage(), 'en-IN');
// An unknown code is rejected rather than blindly suffixed with -IN.
check('A1.6 unknown code rejected', normalizeAnuvadiniLanguage('xx'), null);
check('A1.7 supported check', isSupportedLanguage('ta'), true);
check('A1.8 unsupported check', isSupportedLanguage('xx'), false);

// ── 2. Request assembly ─────────────────────────────────────────────────────
// Our proxy contract.
check('A2.1 exact proxy fields', Object.keys(buildRequestBody('abc', 'en-IN')).sort(), [
  'audio_buffer',
  'audio_language',
]);
check('A2.2 audio goes in audio_buffer', buildRequestBody('abc', 'en-IN').audio_buffer, 'abc');
check(
  'A2.3 language goes in audio_language',
  buildRequestBody('abc', 'en-IN').audio_language,
  'en-IN',
);

// Anuvadini's own contract, used when the app calls it directly.
check(
  'A2.4 exact direct fields',
  Object.keys(buildDirectRequestBody('abc', 'en-IN')).sort(),
  ['audioBuffer', 'audioLanguage'],
);
check(
  'A2.5 direct audio field',
  buildDirectRequestBody('abc', 'en-IN').audioBuffer,
  'abc',
);
check(
  'A2.6 direct language field',
  buildDirectRequestBody('abc', 'en-IN').audioLanguage,
  'en-IN',
);

const sent = transportReturning(200, { transcription: 'Hello' });
await run(sent);
check('A2.7 posts to the configured url', sent.calls[0].url, URL);
check('A2.8 body carries the normalized language', sent.calls[0].body.audioLanguage, 'en-IN');
check('A2.9 body carries the audio verbatim', sent.calls[0].body.audioBuffer, AUDIO);
check('A2.10 no extra fields on the wire', Object.keys(sent.calls[0].body).sort(), [
  'audioBuffer',
  'audioLanguage',
]);
check(
  'A2.11 direct mode attaches the bearer header',
  sent.calls[0].headers?.Authorization,
  `Bearer ${TOKEN}`,
);

// The declared transport decides; a populated proxy URL cannot pull a direct
// build off the upstream, which is what made the last device test confusing.
check('A2.12 shipped transport is direct', TRANSCRIPTION_TRANSPORT, TRANSPORT.DIRECT);
check('A2.13 direct resolves with a token', resolveTransport(TOKEN), TRANSPORT.DIRECT);
check('A2.14 direct without a token is unusable', resolveTransport(''), TRANSPORT.NONE);
check(
  'A2.15 the upstream url is Anuvadini',
  ANUVADINI_STT_URL,
  'https://anuvadini-services.aicte-india.org/api/voice-to-text',
);

// ── 3. Success ──────────────────────────────────────────────────────────────
const ok = await run(transportReturning(200, { success: true, transcription: '  Hello  ' }));
check('A3.1 ok', ok.ok, true);
check('A3.2 transcript trimmed', ok.text, 'Hello');
check('A3.3 no error kind on success', ok.errorKind, null);

// ── 4. Responses that are not usable transcripts ────────────────────────────
const cases = [
  ['A4.1 empty transcription', 200, { success: true, transcription: '   ' }, ERROR_KIND.EMPTY_TRANSCRIPTION],
  ['A4.2 missing transcription', 200, { success: true }, ERROR_KIND.MALFORMED],
  ['A4.3 success false', 200, { success: false }, ERROR_KIND.SERVER_ERROR],
  ['A4.4 unparseable body', 200, null, ERROR_KIND.MALFORMED],
  ['A4.5 not an object', 200, 'plain text', ERROR_KIND.MALFORMED],
  ['A4.6 client error', 400, { detail: 'bad' }, ERROR_KIND.CLIENT_ERROR],
  ['A4.7 unauthorized', 401, { detail: 'no' }, ERROR_KIND.CLIENT_ERROR],
  ['A4.8 payload too large', 413, { detail: 'big' }, ERROR_KIND.CLIENT_ERROR],
  ['A4.9 server error', 500, { detail: 'boom' }, ERROR_KIND.SERVER_ERROR],
  ['A4.10 gateway timeout', 504, {}, ERROR_KIND.SERVER_ERROR],
];
for (const [label, status, body, kind] of cases) {
  const result = await run(transportReturning(status, body));
  check(`${label} → not ok`, result.ok, false);
  check(`${label} → ${kind}`, result.errorKind, kind);
  check(`${label} → no text`, result.text, '');
}

// ── 5. Transport failures ───────────────────────────────────────────────────
const network = await run(transportThrowing(new Error('Network request failed')));
check('A5.1 network failure', network.errorKind, ERROR_KIND.NETWORK);

const timedOut = await run(transportThrowing(new Error('timeout of 75000ms exceeded')));
check('A5.2 timeout', timedOut.errorKind, ERROR_KIND.TIMEOUT);

const controller = new AbortController();
controller.abort();
const cancelled = await run(transportThrowing(new Error('Aborted')), {
  signal: controller.signal,
});
check('A5.3 cancellation is distinct from timeout', cancelled.errorKind, ERROR_KIND.CANCELLED);

// ── 6. Guards before anything is sent ───────────────────────────────────────
const noAudio = transportReturning(200, { success: true, transcription: 'x' });
const missing = await transcribe({ audioBase64: '', language: 'en', url: URL, transport: noAudio });
check('A6.1 no audio → rejected', missing.errorKind, ERROR_KIND.NO_AUDIO);
check('A6.2 no audio → nothing sent', noAudio.calls.length, 0);

const badLanguage = transportReturning(200, { success: true, transcription: 'x' });
const unsupported = await transcribe({
  audioBase64: AUDIO,
  language: 'xx',
  url: URL,
  transport: badLanguage,
});
check('A6.3 unsupported language → rejected', unsupported.errorKind, ERROR_KIND.UNSUPPORTED_LANGUAGE);
check('A6.4 unsupported language → nothing sent', badLanguage.calls.length, 0);

const oversized = transportReturning(200, { success: true, transcription: 'x' });
const tooBig = await transcribe({
  audioBase64: 'a'.repeat(MAX_AUDIO_BASE64_CHARS + 1),
  language: 'en',
  url: URL,
  transport: oversized,
});
check('A6.5 oversized audio → rejected', tooBig.errorKind, ERROR_KIND.AUDIO_TOO_LARGE);
check('A6.6 oversized audio → nothing sent', oversized.calls.length, 0);

const unconfigured = transportReturning(200, { success: true, transcription: 'x' });
const noProxy = await transcribe({
  audioBase64: AUDIO,
  language: 'en',
  transport: unconfigured,
});
check('A6.7 no proxy configured → rejected', noProxy.errorKind, ERROR_KIND.NOT_CONFIGURED);
check('A6.8 no proxy configured → nothing sent', unconfigured.calls.length, 0);

// ── 7. No automatic retry, and nothing leaks ────────────────────────────────
const once = transportReturning(500, { detail: 'boom' });
await run(once);
check('A7.1 a failed request is not retried automatically', once.calls.length, 1);
await run(once);
check('A7.2 a manual retry sends exactly one more', once.calls.length, 2);

const leaked = await run(transportThrowing(new Error(`failed sending ${AUDIO}`)));
check(
  'A7.3 audio never appears in the returned result',
  JSON.stringify(leaked).includes(AUDIO),
  false,
);
check(
  'A7.4 the result carries no credential field',
  Object.keys(leaked).sort(),
  ['errorKind', 'ok', 'text'],
);

// The credential must not ride back to the caller on ANY path — an error
// envelope is the easiest place for a secret to escape unnoticed.
for (const [label, impl] of [
  ['success', transportReturning(200, { transcription: 'ok' })],
  ['server error', transportReturning(500, { detail: 'boom' })],
  ['unauthorized', transportReturning(401, { detail: 'no' })],
  ['thrown', transportThrowing(new Error(`bad request with ${TOKEN}`))],
]) {
  const result = await run(impl);
  check(`A7.5 token absent from the ${label} result`, JSON.stringify(result).includes(TOKEN), false);
}

// ── 8. Reader in isolation ──────────────────────────────────────────────────
check('A8.1 reads transcription', readTranscription({ transcription: 'A' }), { ok: true, text: 'A' });
check('A8.2 rejects undefined', readTranscription(undefined).ok, false);
check('A8.3 rejects a numeric transcription', readTranscription({ transcription: 5 }).ok, false);

report();
