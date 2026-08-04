/**
 * Upload budget fixtures.
 *
 *   node scripts/test-audio-budget.mjs
 *
 * The transcription contract carries audio as Base64 inside JSON, so a long
 * dictation is an out-of-memory on an entry-level device rather than a slow
 * request. These assertions pin the arithmetic the ceiling is derived from.
 */
import {
  BYTES_PER_SECOND,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_SECONDS,
  WAV_HEADER_BYTES,
  base64CharsFor,
  describeBudget,
  secondsFor,
  wavBytesFor,
  withinUploadBudget,
} from '../src/services/audioBudget.js';
import { MAX_AUDIO_BASE64_CHARS } from '../src/services/anuvadini/transcriptionClient.js';

import { check, report } from './lib/fixture-harness.mjs';

// ── 1. Stream arithmetic ────────────────────────────────────────────────────
check('B1.1 16 kHz mono 16-bit is 32 KB/s', BYTES_PER_SECOND, 32000);
check('B1.2 a second of audio plus the header', wavBytesFor(1), 32000 + WAV_HEADER_BYTES);
check('B1.3 sixty seconds', wavBytesFor(60), 1920000 + WAV_HEADER_BYTES);
check('B1.4 header is the canonical 44 bytes', WAV_HEADER_BYTES, 44);
check('B1.5 zero duration is header only', wavBytesFor(0), WAV_HEADER_BYTES);

// ── 2. Duration recovered from a file size ──────────────────────────────────
check('B2.1 round trip at 60 s', secondsFor(wavBytesFor(60)), 60);
check('B2.2 round trip at 120 s', secondsFor(wavBytesFor(120)), 120);
check('B2.3 header alone is no audio', secondsFor(WAV_HEADER_BYTES), 0);
check('B2.4 a nonsense size is not negative', secondsFor(0), 0);

// ── 3. Base64 growth ────────────────────────────────────────────────────────
check('B3.1 three bytes become four characters', base64CharsFor(3), 4);
check('B3.2 one byte still pads to four', base64CharsFor(1), 4);
check('B3.3 four bytes need two groups', base64CharsFor(4), 8);
check('B3.4 always a multiple of four', base64CharsFor(1000) % 4, 0);
check(
  'B3.5 roughly four thirds of the bytes',
  base64CharsFor(3000000) >= 4000000,
  true,
);

// ── 4. The ceiling ──────────────────────────────────────────────────────────
check('B4.1 the cap is 120 seconds', MAX_UPLOAD_SECONDS, 120);
check('B4.2 which is ~3.84 MB of WAV', MAX_UPLOAD_BYTES, 3840000 + WAV_HEADER_BYTES);
check(
  'B4.3 and ~5.1 MB of Base64',
  base64CharsFor(MAX_UPLOAD_BYTES) < 5.2 * 1024 * 1024,
  true,
);
check('B4.4 exactly at the cap is allowed', withinUploadBudget(MAX_UPLOAD_BYTES), true);
check('B4.5 one byte over is not', withinUploadBudget(MAX_UPLOAD_BYTES + 1), false);
check('B4.6 one byte under is', withinUploadBudget(MAX_UPLOAD_BYTES - 1), true);
check('B4.7 an empty capture is not uploadable', withinUploadBudget(0), false);
check('B4.8 a missing size is not uploadable', withinUploadBudget(undefined), false);

// ── 5. The client limit tracks the budget ───────────────────────────────────
// Two independent constants would drift, and the client would start rejecting
// audio the capture layer thought was fine.
check(
  'B5.1 the client ceiling admits a capture at the budget',
  base64CharsFor(MAX_UPLOAD_BYTES) <= MAX_AUDIO_BASE64_CHARS,
  true,
);
check(
  'B5.2 and is not wildly looser than it',
  MAX_AUDIO_BASE64_CHARS <= base64CharsFor(MAX_UPLOAD_BYTES) * 1.5,
  true,
);

// ── 6. What the UI is told ──────────────────────────────────────────────────
const described = describeBudget();
check('B6.1 seconds reported', described.maxSeconds, MAX_UPLOAD_SECONDS);
check('B6.2 bytes reported', described.maxBytes, MAX_UPLOAD_BYTES);
check('B6.3 base64 length reported', described.maxBase64Chars, base64CharsFor(MAX_UPLOAD_BYTES));

// ── 7. The documented size table ────────────────────────────────────────────
const TABLE = [
  [60, 1920044, 2560060],
  [120, 3840044, 5120060],
];
for (const [seconds, bytes, chars] of TABLE) {
  check(`B7 ${seconds}s → wav bytes`, wavBytesFor(seconds), bytes);
  check(`B7 ${seconds}s → base64 chars`, base64CharsFor(wavBytesFor(seconds)), chars);
}

report();
