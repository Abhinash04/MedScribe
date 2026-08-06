import { ERROR_KIND } from './proxyContract.js';

/**
 * One recording, several requests, one transcript.
 *
 * Anuvadini processes roughly the first 57 seconds of any submission and
 * silently discards the rest — measured, with a 200 and no marker of any kind,
 * so a truncated answer is indistinguishable from a whole one. A dictation
 * longer than that has to arrive as several shorter submissions.
 *
 * Everything here is injected: what to read, what to send, and whether this
 * attempt is still the current one. That keeps the ordering and resume rules —
 * the parts that can silently corrupt a medical record by duplicating or
 * dropping speech — verifiable without a device, a store or a network.
 */

/**
 * `plan` identifies the exact cut points the texts belong to.
 *
 * Resuming is only safe while the boundaries are the ones the finished chunks
 * were cut at. The plan is deterministic — the same file yields the same cuts —
 * but the silence search is allowed to fail and fall back to the arithmetic
 * plan, which would shift a boundary by up to a second under the same index.
 * Reusing text across that would drop or duplicate the speech at the join, so
 * the plan is compared rather than assumed.
 */
export function emptyProgress(path = null, plan = '') {
  return { path, plan, texts: [] };
}

export function planSignature(chunks) {
  return (chunks ?? []).map(chunk => `${chunk.start}-${chunk.end}`).join(',');
}

/** Whether finished chunks may be carried into this attempt. */
export function resumable(progress, path, chunks) {
  return progress?.path === path && progress?.plan === planSignature(chunks);
}

/**
 * Sends the chunks that have not yet succeeded, in order.
 *
 * Requests are sequential rather than parallel: order is the whole point, and
 * an endpoint whose rate limits we do not know is not one to fan out against.
 * Text that already arrived is never re-sent, so a dictation that failed on its
 * third chunk costs one request to retry, not three.
 */
export async function uploadChunks({
  chunks,
  progress = emptyProgress(),
  readChunk,
  send,
  stillCurrent = () => true,
}) {
  const texts = (progress.texts ?? []).slice();
  let last = null;

  for (const chunk of chunks) {
    if (typeof texts[chunk.index] === 'string') {
      continue;
    }

    const payload = await readChunk(chunk);
    if (!payload) {
      last = { ok: false, text: '', errorKind: ERROR_KIND.NO_AUDIO };
      break;
    }

    last = await send(payload, chunk);

    // A newer attempt started while this request was in the air. It owns the
    // transcript now, so this one reports what it saw and applies nothing.
    if (!stillCurrent()) {
      return { superseded: true, result: last, progress: { ...progress, texts } };
    }

    if (!last?.ok) {
      break;
    }
    texts[chunk.index] = last.text;
  }

  const carried = { ...progress, texts };
  const complete = chunks.every(chunk => typeof texts[chunk.index] === 'string');

  if (!complete) {
    return {
      superseded: false,
      progress: carried,
      result: last ?? { ok: false, text: '', errorKind: ERROR_KIND.NO_AUDIO },
    };
  }

  return {
    superseded: false,
    progress: carried,
    result: { ok: true, errorKind: null, text: joinChunks(chunks, texts) },
  };
}

/**
 * The pieces back into one transcript, in recording order.
 *
 * By chunk index rather than by arrival, which is what stops a resumed retry
 * from reordering the dictation, and separated by a space because the cuts fall
 * in the silence between words rather than inside one.
 */
export function joinChunks(chunks, texts) {
  return chunks
    .map(chunk => String(texts?.[chunk.index] ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
