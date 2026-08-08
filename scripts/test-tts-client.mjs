/**
 * Speech synthesis client fixtures.
 *
 *   node scripts/test-tts-client.mjs
 *
 * Mirrors `test-anuvadini-client.mjs`, because `speechClient` mirrors
 * `transcriptionClient`. The same three properties are load-bearing:
 *
 *   NEVER THROWS   a prompt that cannot be spoken must leave the consultation
 *                  untouched. Every failure is a returned `errorKind`.
 *   NO CREDENTIAL  the token appears in no result and no error.
 *   NO PATIENT DATA the request carries the prompt and nothing else.
 */
import { synthesize, MAX_SPEECH_CHARS } from '../src/services/anuvadini/speechClient.js';
import { ERROR_KIND } from '../src/services/anuvadini/proxyContract.js';
import {
  buildDirectSpeechRequestBody,
  buildSpeechRequestBody,
  readAudio,
  voiceFor,
} from '../src/services/anuvadini/speechContract.js';

import { check, report } from './lib/fixture-harness.mjs';

const TOKEN = 'tts-key-do-not-log';
const AUDIO = 'UklGRiQAAABXQVZF';
const TEXT = 'The patient name is still missing. Please provide this mandatory detail.';

const fake = (status, body, { throws = null } = {}) => {
  const calls = [];
  const impl = async args => {
    calls.push(args);
    if (throws) {
      throw throws;
    }
    return { status, body };
  };
  impl.calls = calls;
  return impl;
};

const speak = (transport, extra = {}) =>
  synthesize({ text: TEXT, language: 'en', token: TOKEN, transport, ...extra });

// ── 1. The happy path, direct ───────────────────────────────────────────────
{
  const transport = fake(200, { audio: AUDIO });
  const result = await speak(transport);

  check('T1.1 ok', result.ok, true);
  check('T1.2 audio returned', result.audioBase64, AUDIO);
  check('T1.3 no error kind on success', result.errorKind, null);
  check('T1.4 one request', transport.calls.length, 1);

  const sent = transport.calls[0];
  check('T1.5 posts to the Anuvadini endpoint', sent.url.endsWith('/api/text-to-speech'), true);
  check('T1.6 bearer attached in direct mode', sent.headers.Authorization, `Bearer ${TOKEN}`);
  check('T1.7 direct body is camelCase', Object.keys(sent.body).sort(), [
    'gender',
    'lang',
    'languageVoice',
    'text',
  ]);
  check('T1.8 language normalized to en-IN', sent.body.lang, 'en-IN');
  check('T1.9 the voice is sent', sent.body.languageVoice, 'en-IN-PrabhatNeural');
  check('T1.10 the prompt is sent verbatim', sent.body.text, TEXT);
}

// ── 2. Every response shape the service has been seen to use ────────────────
for (const [label, body] of [
  ['audio', { audio: AUDIO }],
  ['audio_url', { audio_url: AUDIO }],
  ['audioFile', { audioFile: AUDIO }],
  ['data.audio', { data: { audio: AUDIO } }],
  ['success envelope', { success: true, audio: AUDIO }],
]) {
  const result = await speak(fake(200, body));
  check(`T2 "${label}" is read as audio`, result.audioBase64, AUDIO);
}

check(
  'T2.6a a blank key still finds a later real one',
  readAudio({ audio: '   ', audioFile: AUDIO }).audioBase64,
  AUDIO,
);
check(
  'T2.6 a data URI is stripped to its payload',
  readAudio({ audio: `data:audio/wav;base64,${AUDIO}` }).audioBase64,
  AUDIO,
);

// ── 3. Failure paths — none may throw ───────────────────────────────────────
const failures = [
  ['T3.1 upstream 500', fake(500, {}), ERROR_KIND.SERVER_ERROR],
  ['T3.2 upstream 400', fake(400, {}), ERROR_KIND.CLIENT_ERROR],
  ['T3.3 unauthorized', fake(401, {}), ERROR_KIND.CLIENT_ERROR],
  ['T3.4 no body', fake(200, null), ERROR_KIND.MALFORMED],
  ['T3.5 no audio key', fake(200, { message: 'ok' }), ERROR_KIND.MALFORMED],
  ['T3.6 success false', fake(200, { success: false }), ERROR_KIND.SERVER_ERROR],
  ['T3.7 whitespace-only audio', fake(200, { audio: '   ' }), ERROR_KIND.EMPTY_SPEECH],
  ['T3.8 network', fake(0, null, { throws: new Error('ECONNREFUSED') }), ERROR_KIND.NETWORK],
  ['T3.9 timeout', fake(0, null, { throws: new Error('timeout') }), ERROR_KIND.TIMEOUT],
];

for (const [label, transport, kind] of failures) {
  let result;
  let threw = false;
  try {
    result = await speak(transport);
  } catch {
    threw = true;
  }
  check(`${label} does not throw`, threw, false);
  check(`${label} → ${kind}`, result.errorKind, kind);
  check(`${label} → not ok`, result.ok, false);
  check(`${label} → no audio`, result.audioBase64, '');
  check(
    `${label} → the token is not in the result`,
    JSON.stringify(result).includes(TOKEN),
    false,
  );
}

// ── 4. Refused before any request ───────────────────────────────────────────
const guards = [
  ['T4.1 empty text', { text: '' }, ERROR_KIND.NO_TEXT],
  ['T4.2 whitespace text', { text: '   ' }, ERROR_KIND.NO_TEXT],
  ['T4.3 null text', { text: null }, ERROR_KIND.NO_TEXT],
  ['T4.4 over the char cap', { text: 'x'.repeat(MAX_SPEECH_CHARS + 1) }, ERROR_KIND.NO_TEXT],
  ['T4.5 unsupported language', { language: 'fr' }, ERROR_KIND.UNSUPPORTED_LANGUAGE],
  ['T4.6 no token in direct mode', { token: '' }, ERROR_KIND.NOT_CONFIGURED],
];

for (const [label, override, kind] of guards) {
  const transport = fake(200, { audio: AUDIO });
  const result = await synthesize({
    text: TEXT,
    language: 'en',
    token: TOKEN,
    transport,
    ...override,
  });
  check(`${label} → ${kind}`, result.errorKind, kind);
  check(`${label} → nothing sent`, transport.calls.length, 0);
}

// ── 5. Cancellation is distinguishable from a timeout ───────────────────────
{
  const controller = new AbortController();
  controller.abort();
  // A transport that WOULD succeed, so the assertion is that it is never
  // reached rather than that it happened to throw.
  const transport = fake(200, { audio: AUDIO });
  const result = await speak(transport, { signal: controller.signal });
  check('T5.1 an aborted signal reads as cancelled', result.errorKind, ERROR_KIND.CANCELLED);
  check('T5.2 and the request is never sent', transport.calls.length, 0);
}

// A link where base64 was expected. Decoding it yields noise that reaches the
// player, so it is refused rather than forwarded.
for (const value of ['https://cdn.example.com/a.wav', 'http://x/y.wav']) {
  const result = await speak(fake(200, { audio_url: value }));
  check(`T3.10 "${value}" is refused`, result.errorKind, ERROR_KIND.MALFORMED);
  check(`T3.10 "${value}" yields no audio`, result.audioBase64, '');
}
check(
  'T3.11 a data URI is still accepted',
  readAudio({ audio_url: `data:audio/wav;base64,${AUDIO}` }).audioBase64,
  AUDIO,
);

// ── 6. The proxy shape ──────────────────────────────────────────────────────
// Direct mode speaks Anuvadini's contract, proxy mode speaks ours. Asserted on
// the builders directly, since the transport is chosen by a declared constant.
{
  const config = voiceFor('en-IN');
  check('T6.1 en-IN has a voice', config.voice, 'en-IN-PrabhatNeural');
  check('T6.2 an unexercised language has none', voiceFor('fr-FR'), null);

  check('T6.3 proxy body is snake_case', Object.keys(buildSpeechRequestBody(TEXT, 'en-IN', config)).sort(), [
    'gender',
    'lang',
    'language_voice',
    'text',
  ]);
  check('T6.4 direct body is camelCase', Object.keys(buildDirectSpeechRequestBody(TEXT, 'en-IN', config)).sort(), [
    'gender',
    'lang',
    'languageVoice',
    'text',
  ]);
  check(
    'T6.5 neither body carries anything but the prompt and its voice',
    JSON.stringify(buildSpeechRequestBody(TEXT, 'en-IN', config)).includes(TOKEN),
    false,
  );
}

report();