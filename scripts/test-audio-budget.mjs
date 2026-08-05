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
  BLOCK_ALIGN,
  BYTES_PER_SECOND,
  CHUNK_HARD_CAP_SECONDS,
  MAX_RECORDING_BYTES,
  MAX_RECORDING_SECONDS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_SECONDS,
  SAFE_CHUNK_SECONDS,
  WAV_HEADER_BYTES,
  base64CharsFor,
  chunksFromBoundaries,
  chunksWithinCap,
  describeBudget,
  planChunkBoundaries,
  planChunks,
  secondsFor,
  wavBytesFor,
  withinRecordingBudget,
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

// ── 4. The two ceilings ─────────────────────────────────────────────────────
// One request and one recording are no longer the same thing. The service
// truncates a submission past ~57 s without saying so; memory is what limits
// the recording.
check('B4.1 one request caps at the chunk cap', MAX_UPLOAD_SECONDS, CHUNK_HARD_CAP_SECONDS);
check('B4.2 which is 50 s of WAV', MAX_UPLOAD_BYTES, 50 * 32000 + WAV_HEADER_BYTES);
check(
  'B4.3 and well under 5.2 MB of Base64',
  base64CharsFor(MAX_UPLOAD_BYTES) < 5.2 * 1024 * 1024,
  true,
);
check('B4.4 exactly at the cap is allowed', withinUploadBudget(MAX_UPLOAD_BYTES), true);
check('B4.5 one byte over is not', withinUploadBudget(MAX_UPLOAD_BYTES + 1), false);
check('B4.6 one byte under is', withinUploadBudget(MAX_UPLOAD_BYTES - 1), true);
check('B4.7 an empty capture is not uploadable', withinUploadBudget(0), false);
check('B4.8 a missing size is not uploadable', withinUploadBudget(undefined), false);

check('B4.9 a recording may run to 30 minutes', MAX_RECORDING_SECONDS, 1800);
check(
  'B4.10 a two-minute dictation is no longer refused',
  withinRecordingBudget(wavBytesFor(120)),
  true,
);
check(
  'B4.11 nor is a ten-minute one',
  withinRecordingBudget(wavBytesFor(600)),
  true,
);
check(
  'B4.12 but a runaway recorder still is',
  withinRecordingBudget(MAX_RECORDING_BYTES + 1),
  false,
);
check('B4.13 an empty recording is not uploadable', withinRecordingBudget(0), false);

// ── 4b. Chunk planning ──────────────────────────────────────────────────────
// The measured cut is ~57 s: the returned transcript of a 99.6 s recording is
// byte-identical from 58 s upward. Every chunk must land clear of that.
check('B4b.1 the target is 45 s', SAFE_CHUNK_SECONDS, 45);
check('B4b.2 the cap after snapping is 50 s', CHUNK_HARD_CAP_SECONDS, 50);
check('B4b.3 both are under the measured 57 s cut', CHUNK_HARD_CAP_SECONDS < 57, true);

const shortCapture = planChunks(wavBytesFor(40));
check('B4b.4 a 40 s recording is one request', shortCapture.length, 1);
check('B4b.5 covering the whole file', shortCapture[0].start, WAV_HEADER_BYTES);
check('B4b.6 to its last byte', shortCapture[0].end, wavBytesFor(40));

check('B4b.7 exactly 45 s is still one request', planChunks(wavBytesFor(45)).length, 1);
check('B4b.8 46 s becomes two', planChunks(wavBytesFor(46)).length, 2);

// The recording the ceiling was measured from.
const measured = planChunks(wavBytesFor(99.6));
check('B4b.9 the 99.6 s recording splits into three', measured.length, 3);
check(
  'B4b.10 evenly, not into two full chunks and an offcut',
  measured.every(chunk => Math.abs(chunk.seconds - 33.2) < 0.01),
  true,
);
check('B4b.11 none of which reaches the cut', chunksWithinCap(measured), true);

const long = planChunks(wavBytesFor(130));
check('B4b.12 130 s splits into three', long.length, 3);
check('B4b.13 each ~43.3 s, under the 45 s target', long[0].seconds <= SAFE_CHUNK_SECONDS, true);

// ── 4c. Boundaries are contiguous, disjoint, and cover the file exactly ──────
// This is the property that makes it impossible for speech to be lost or
// duplicated at a join.
for (const [label, fileBytes] of [
  ['40 s', wavBytesFor(40)],
  ['99.6 s', wavBytesFor(99.6)],
  ['130 s', wavBytesFor(130)],
  ['600 s', wavBytesFor(600)],
]) {
  const chunks = planChunks(fileBytes);
  check(`B4c ${label} starts at the header`, chunks[0].start, WAV_HEADER_BYTES);
  check(`B4c ${label} ends at the file`, chunks[chunks.length - 1].end, fileBytes);
  check(
    `B4c ${label} is contiguous`,
    chunks.every((chunk, index) => index === 0 || chunk.start === chunks[index - 1].end),
    true,
  );
  check(
    `B4c ${label} sums to the audio`,
    chunks.reduce((total, chunk) => total + chunk.bytes, 0),
    fileBytes - WAV_HEADER_BYTES,
  );
  check(
    `B4c ${label} cuts on sample boundaries`,
    chunks.every(chunk => chunk.start % BLOCK_ALIGN === 0 && chunk.end % BLOCK_ALIGN === 0),
    true,
  );
  check(`B4c ${label} stays under the cap`, chunksWithinCap(chunks), true);
  check(
    `B4c ${label} is indexed in order`,
    chunks.every((chunk, index) => chunk.index === index),
    true,
  );
}

check('B4c.x an empty file plans nothing', planChunks(WAV_HEADER_BYTES).length, 0);
check('B4c.y a missing size plans nothing', planChunks(undefined).length, 0);

// ── 4d. Snapped boundaries are held to the same rules ───────────────────────
const planned = planChunkBoundaries(wavBytesFor(99.6));
check('B4d.1 one more cut point than chunks', planned.length, 4);

// A snap moves the interior points; the edges are fixed.
const snapped = [planned[0], planned[1] - 4000, planned[2] + 6000, planned[3]];
const fromSnap = chunksFromBoundaries(snapped);
check('B4d.2 a snapped plan still has three chunks', fromSnap.length, 3);
check(
  'B4d.3 still contiguous after snapping',
  fromSnap.every((chunk, index) => index === 0 || chunk.start === fromSnap[index - 1].end),
  true,
);
check(
  'B4d.4 still covers the file exactly',
  fromSnap.reduce((total, chunk) => total + chunk.bytes, 0),
  wavBytesFor(99.6) - WAV_HEADER_BYTES,
);
check('B4d.5 and still under the cap', chunksWithinCap(fromSnap), true);

// A snap that dragged a boundary past the cut must be rejected, not used.
const overCap = chunksFromBoundaries([
  WAV_HEADER_BYTES,
  WAV_HEADER_BYTES + 55 * BYTES_PER_SECOND,
  wavBytesFor(99.6),
]);
check('B4d.6 a 55 s chunk breaks the cap', chunksWithinCap(overCap), false);
check('B4d.7 an empty plan is not usable', chunksWithinCap([]), false);
check('B4d.8 a non-array is not usable', chunksWithinCap(null), false);

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
check('B6.1 seconds reported', described.maxSeconds, MAX_RECORDING_SECONDS);
check('B6.2 bytes reported', described.maxBytes, MAX_RECORDING_BYTES);
check('B6.3 base64 length reported', described.maxBase64Chars, base64CharsFor(MAX_UPLOAD_BYTES));
check('B6.4 chunk size reported', described.chunkSeconds, SAFE_CHUNK_SECONDS);
check('B6.5 per-request bytes reported', described.maxRequestBytes, MAX_UPLOAD_BYTES);

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
