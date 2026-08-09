/**
 * Chunked upload fixtures.
 *
 *   node scripts/test-chunked-upload.mjs
 *
 * Anuvadini processes roughly the first 57 seconds of any submission and
 * silently discards the rest — measured against one 99.6 s recording, whose
 * returned transcript is byte-identical from 58 s upward while the audio past
 * that point transcribes perfectly on its own. A long dictation therefore goes
 * up as several requests, and these assertions are about the two ways that can
 * corrupt a medical record: speech arriving out of order, and speech arriving
 * twice or not at all.
 */
import { ERROR_KIND } from '../src/services/anuvadini/proxyContract.js';
import {
  emptyProgress,
  joinChunks,
  planSignature,
  resumable,
  uploadChunks,
} from '../src/services/anuvadini/chunkedUpload.js';
import {
  chunksFromBoundaries,
  planChunkBoundaries,
  planChunks,
  wavBytesFor,
} from '../src/services/audioBudget.js';

import { check, report } from './lib/fixture-harness.mjs';

const CHUNKS = planChunks(wavBytesFor(99.6));

/** Answers with the chunk's own text, recording what it was asked for. */
const service = (byIndex, { failAt = null, failWith = ERROR_KIND.NETWORK } = {}) => {
  const sent = [];
  const send = async (payload, chunk) => {
    sent.push(chunk.index);
    if (chunk.index === failAt) {
      return { ok: false, text: '', errorKind: failWith };
    }
    return { ok: true, text: byIndex[chunk.index], errorKind: null };
  };
  send.sent = sent;
  return send;
};

const reader = () => {
  const read = [];
  const readChunk = async chunk => {
    read.push(chunk.index);
    return `audio-${chunk.index}`;
  };
  readChunk.read = read;
  return readChunk;
};

const TEXTS = ['first part.', 'second part.', 'third part.'];

// ── 1. The whole dictation, in order ────────────────────────────────────────
{
  const send = service(TEXTS);
  const readChunk = reader();
  const { result, superseded, progress } = await uploadChunks({
    chunks: CHUNKS,
    progress: emptyProgress('/rec.wav'),
    readChunk,
    send,
  });

  check('C1.1 three chunks planned', CHUNKS.length, 3);
  check('C1.2 all three sent', send.sent, [0, 1, 2]);
  check('C1.3 sequentially, in recording order', readChunk.read, [0, 1, 2]);
  check('C1.4 the pass succeeds', result.ok, true);
  check('C1.5 joined in order', result.text, 'first part. second part. third part.');
  check('C1.6 not superseded', superseded, false);
  check('C1.7 progress keeps the path', progress.path, '/rec.wav');
}

// ── 2. A single-chunk recording behaves exactly as before ───────────────────
{
  const one = planChunks(wavBytesFor(40));
  const send = service(['only part.']);
  const { result } = await uploadChunks({
    chunks: one,
    progress: emptyProgress('/short.wav'),
    readChunk: reader(),
    send,
  });

  check('C2.1 one chunk for a 40 s recording', one.length, 1);
  check('C2.2 one request', send.sent, [0]);
  check('C2.3 the text is passed through untouched', result.text, 'only part.');
  check('C2.4 and it succeeded', result.ok, true);
}

// ── 3. A mid-pass failure loses nothing that already arrived ────────────────
let afterFailure = null;
{
  const send = service(TEXTS, { failAt: 2 });
  const { result, progress } = await uploadChunks({
    chunks: CHUNKS,
    progress: emptyProgress('/rec.wav'),
    readChunk: reader(),
    send,
  });
  afterFailure = progress;

  check('C3.1 it stopped at the failing chunk', send.sent, [0, 1, 2]);
  check('C3.2 the pass failed', result.ok, false);
  check('C3.3 reporting the transport error, not a generic one', result.errorKind, ERROR_KIND.NETWORK);
  check('C3.4 the first two texts survived', progress.texts.slice(0, 2), TEXTS.slice(0, 2));
  check('C3.5 the third did not', progress.texts[2], undefined);
  // A partial transcript must never be applied: half a consultation presented
  // as a whole one is worse than none.
  check('C3.6 no partial text is returned', result.text, '');
}

// ── 4. Retry re-sends only what is missing ──────────────────────────────────
{
  const send = service(TEXTS);
  const readChunk = reader();
  const { result } = await uploadChunks({
    chunks: CHUNKS,
    progress: afterFailure,
    readChunk,
    send,
  });

  check('C4.1 only the failed chunk is sent again', send.sent, [2]);
  check('C4.2 and only its audio is read again', readChunk.read, [2]);
  check('C4.3 the retry completes the pass', result.ok, true);
  check(
    'C4.4 with the whole dictation, in the original order',
    result.text,
    'first part. second part. third part.',
  );
}

// ── 5. A failure on the FIRST chunk keeps nothing ───────────────────────────
{
  const send = service(TEXTS, { failAt: 0, failWith: ERROR_KIND.TIMEOUT });
  const { result, progress } = await uploadChunks({
    chunks: CHUNKS,
    progress: emptyProgress('/rec.wav'),
    readChunk: reader(),
    send,
  });

  check('C5.1 later chunks are not attempted', send.sent, [0]);
  check('C5.2 the pass failed', result.ok, false);
  check('C5.3 with the timeout it saw', result.errorKind, ERROR_KIND.TIMEOUT);
  check('C5.4 nothing was kept', progress.texts.filter(Boolean).length, 0);
}

// ── 6. Unreadable audio fails the pass rather than sending nothing ──────────
{
  const send = service(TEXTS);
  const { result } = await uploadChunks({
    chunks: CHUNKS,
    progress: emptyProgress('/rec.wav'),
    readChunk: async chunk => (chunk.index === 1 ? null : `audio-${chunk.index}`),
    send,
  });

  check('C6.1 the readable chunk was still sent', send.sent, [0]);
  check('C6.2 the pass failed', result.ok, false);
  check('C6.3 as missing audio', result.errorKind, ERROR_KIND.NO_AUDIO);
}

// ── 7. A superseded pass applies nothing ────────────────────────────────────
// A newer attempt owns the transcript; an older one landing afterwards must not
// overwrite it with staler text.
{
  const send = service(TEXTS);
  let live = true;
  const { superseded, result } = await uploadChunks({
    chunks: CHUNKS,
    progress: emptyProgress('/rec.wav'),
    readChunk: reader(),
    send: async (payload, chunk) => {
      const answer = await send(payload, chunk);
      live = false;
      return answer;
    },
    stillCurrent: () => live,
  });

  check('C7.1 it stopped after the first request', send.sent, [0]);
  check('C7.2 and reported itself superseded', superseded, true);
  check('C7.3 returning what it saw, unjoined', result.ok, true);
}

// ── 8. Cancellation is carried out, not swallowed ───────────────────────────
{
  const send = service(TEXTS, { failAt: 1, failWith: ERROR_KIND.CANCELLED });
  const { result, progress } = await uploadChunks({
    chunks: CHUNKS,
    progress: emptyProgress('/rec.wav'),
    readChunk: reader(),
    send,
  });

  check('C8.1 the cancellation is reported', result.errorKind, ERROR_KIND.CANCELLED);
  check('C8.2 and the first chunk is still retryable', progress.texts[0], TEXTS[0]);
}

// ── 9. Joining ──────────────────────────────────────────────────────────────
check('C9.1 joins by index, not arrival', joinChunks(CHUNKS, TEXTS), TEXTS.join(' '));
check(
  'C9.2 a chunk the service heard nothing in is skipped, not padded',
  joinChunks(CHUNKS, ['a.', '   ', 'c.']),
  'a. c.',
);
check('C9.3 missing text is skipped', joinChunks(CHUNKS, ['a.', undefined, 'c.']), 'a. c.');
check('C9.4 nothing at all joins to nothing', joinChunks(CHUNKS, []), '');
check(
  'C9.5 the join never introduces a double space',
  joinChunks(CHUNKS, [' a. ', ' b. ', ' c. ']).includes('  '),
  false,
);

// ── 10. Re-running a finished pass costs nothing ────────────────────────────
{
  const send = service(TEXTS);
  const { result } = await uploadChunks({
    chunks: CHUNKS,
    progress: { path: '/rec.wav', texts: TEXTS.slice() },
    readChunk: reader(),
    send,
  });

  check('C10.1 no request is made', send.sent, []);
  check('C10.2 and the transcript is still whole', result.text, TEXTS.join(' '));
  check('C10.3 reported as a success', result.ok, true);
}

// ── 11. Resuming is only safe against the same cut points ───────────────────
// The plan is deterministic, but the native silence search is allowed to fail
// and fall back to the arithmetic plan — which shifts a boundary by up to a
// second under the same index. Carrying text across that would drop or
// duplicate the speech at the join.
{
  const finished = { path: '/rec.wav', plan: planSignature(CHUNKS), texts: TEXTS.slice() };

  check('C11.1 the same recording and the same cuts resume', resumable(finished, '/rec.wav', CHUNKS), true);
  check(
    'C11.2 a different recording does not',
    resumable(finished, '/other.wav', CHUNKS),
    false,
  );

  const planned = planChunkBoundaries(wavBytesFor(99.6));
  const shifted = chunksFromBoundaries([planned[0], planned[1] - 32000, planned[2], planned[3]]);
  check(
    'C11.3 nor do boundaries that moved under the same indexes',
    resumable(finished, '/rec.wav', shifted),
    false,
  );
  check('C11.4 fresh progress never resumes', resumable(emptyProgress(), '/rec.wav', CHUNKS), false);
  check(
    'C11.5 and a completed pass carries its plan forward',
    (
      await uploadChunks({
        chunks: CHUNKS,
        progress: emptyProgress('/rec.wav', planSignature(CHUNKS)),
        readChunk: reader(),
        send: service(TEXTS),
      })
    ).progress.plan,
    planSignature(CHUNKS),
  );
}

// ── 12. What the doctor is told while they wait ─────────────────────────────
//
// The refining overlay used to state only that something was happening. On a
// long consultation that is a blank wait of unknown length, which is the one
// thing a doctor with a patient in front of them cannot judge. These pin the
// counts the overlay renders.
{
  const seen = [];
  await uploadChunks({
    chunks: CHUNKS,
    readChunk: reader(),
    send: service(TEXTS),
    onProgress: counts => seen.push(`${counts.done}/${counts.total}`),
  });

  check('C12.1 opens at nothing done', seen[0], `0/${CHUNKS.length}`);
  check('C12.2 counts up once per chunk', seen, ['0/3', '1/3', '2/3', '3/3']);

  const failed = [];
  await uploadChunks({
    chunks: CHUNKS,
    readChunk: reader(),
    send: service(TEXTS, { failAt: 1 }),
    onProgress: counts => failed.push(counts.done),
  });
  check('C12.3 a failed chunk does not advance the count', failed, [0, 1]);

  // The resumed case is why this is counted rather than incremented: chunk 0
  // is already in hand, so reporting zero would walk the count backwards.
  const resumed = [];
  await uploadChunks({
    chunks: CHUNKS,
    progress: { ...emptyProgress('/rec.wav', planSignature(CHUNKS)), texts: [TEXTS[0]] },
    readChunk: reader(),
    send: service(TEXTS),
    onProgress: counts => resumed.push(counts.done),
  });
  check('C12.4 a resumed upload opens at what it already has', resumed[0], 1);
  check('C12.5 and still finishes at the total', resumed[resumed.length - 1], CHUNKS.length);

  check(
    'C12.6 omitting the callback changes nothing',
    (
      await uploadChunks({ chunks: CHUNKS, readChunk: reader(), send: service(TEXTS) })
    ).result.text,
    joinChunks(CHUNKS, TEXTS),
  );
}

report();
