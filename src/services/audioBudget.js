/**
 * What a captured consultation costs to upload, and how it is split.
 *
 * The transcription contract carries the audio as a Base64 string inside JSON,
 * which is a third larger than the bytes and lands in memory as UTF-16 on top
 * of that. On an entry-level device a long dictation is an out-of-memory rather
 * than a slow request, so the ceiling is arithmetic rather than a guess.
 *
 * There are two different ceilings here and conflating them is what truncated
 * long dictations:
 *
 *   - how much audio one REQUEST may carry, which the service imposes;
 *   - how much audio one RECORDING may hold, which only memory imposes.
 *
 * A recording longer than a request is split into chunks, so the second ceiling
 * no longer has to equal the first.
 */

export const SAMPLE_RATE_HZ = 16000;
export const BITS_PER_SAMPLE = 16;
export const CHANNELS = 1;

/** Canonical PCM WAV header. */
export const WAV_HEADER_BYTES = 44;

/** 16-bit mono: a sample is two bytes, so every cut must land on an even one. */
export const BLOCK_ALIGN = (BITS_PER_SAMPLE * CHANNELS) / 8;

export const BYTES_PER_SECOND = (SAMPLE_RATE_HZ * BITS_PER_SAMPLE * CHANNELS) / 8;

/**
 * The measured ceiling, and the margin under it.
 *
 * Anuvadini processes roughly the first 57 seconds of any submission and
 * silently discards the rest: measured against one 99.6 s recording, the
 * returned transcript is byte-identical from 58 s upward, while the audio past
 * that point transcribes perfectly when sent on its own. HTTP 200, no error,
 * no truncation marker — a partial answer is indistinguishable from a whole one,
 * so nothing downstream can detect it. Staying under the cut is the only defence.
 *
 * 45 s leaves 12 s of margin. That covers a boundary drifting to a silent point
 * and a server-side limit that moves without notice, and costs no extra requests
 * for a typical dictation: 120 s is three chunks whether the target is 45 or 50.
 */
export const SAFE_CHUNK_SECONDS = 45;

/** No chunk may exceed this once its boundary has snapped to silence. */
export const CHUNK_HARD_CAP_SECONDS = 50;

/** How far a boundary may move to find a quiet point. */
export const CHUNK_SNAP_WINDOW_SECONDS = 1.5;

/** The most one request may carry. Chunks are built to stay well under it. */
export const MAX_UPLOAD_SECONDS = CHUNK_HARD_CAP_SECONDS;

export const MAX_UPLOAD_BYTES = wavBytesFor(MAX_UPLOAD_SECONDS);

/**
 * The most one recording may hold.
 *
 * This is a memory guard, not a service limit — no single request carries the
 * whole file any more. Half an hour of continuous dictation is far beyond any
 * real consultation, so a recording that reaches it is a stuck recorder rather
 * than a doctor still talking.
 */
export const MAX_RECORDING_SECONDS = 30 * 60;

export const MAX_RECORDING_BYTES = wavBytesFor(MAX_RECORDING_SECONDS);

export function wavBytesFor(seconds) {
  const audio = Math.max(0, Math.round(seconds * BYTES_PER_SECOND));
  return audio + WAV_HEADER_BYTES;
}

export function secondsFor(bytes) {
  const audio = Math.max(0, (bytes || 0) - WAV_HEADER_BYTES);
  return audio / BYTES_PER_SECOND;
}

/** Base64 is 4 characters per 3 bytes, padded up to a multiple of four. */
export function base64CharsFor(bytes) {
  return Math.ceil((bytes || 0) / 3) * 4;
}

/** Whether one chunk fits in one request. */
export function withinUploadBudget(bytes) {
  return (bytes || 0) > 0 && bytes <= MAX_UPLOAD_BYTES;
}

/** Whether a whole recording can be handled at all. */
export function withinRecordingBudget(bytes) {
  return (bytes || 0) > 0 && bytes <= MAX_RECORDING_BYTES;
}

const alignDown = bytes => bytes - (bytes % BLOCK_ALIGN);

/**
 * Splits a recording into as few requests as will each stay under the ceiling.
 *
 * The audio is divided EVENLY rather than into full chunks plus a remainder: a
 * 99.6 s recording becomes three 33 s chunks, not two 45 s chunks and a 9.6 s
 * offcut. Even division keeps every chunk further under the service cut, and a
 * short trailing fragment is the case most likely to transcribe badly.
 *
 * Offsets are absolute positions in the source file, so a chunk is a byte range
 * that can be read directly. Ranges are contiguous and disjoint and together
 * cover the file exactly, which is what makes it impossible for speech to be
 * lost or duplicated at a boundary.
 */
export function planChunks(fileBytes) {
  return chunksFromBoundaries(planChunkBoundaries(fileBytes));
}

/**
 * The cut points alone, for handing to the native silence search.
 *
 * Always length `count + 1`, first at the end of the header and last at the end
 * of the file. Those two are fixed; only the interior ones may move.
 */
export function planChunkBoundaries(fileBytes) {
  const audio = Math.max(0, (fileBytes || 0) - WAV_HEADER_BYTES);
  if (audio < BLOCK_ALIGN) {
    return [];
  }

  const count = Math.max(1, Math.ceil(audio / (SAFE_CHUNK_SECONDS * BYTES_PER_SECOND)));
  const boundaries = [];
  for (let index = 0; index <= count; index += 1) {
    boundaries.push(WAV_HEADER_BYTES + alignDown(Math.round((audio * index) / count)));
  }
  // The last one is the file, exactly — never a rounded approximation of it.
  boundaries[count] = WAV_HEADER_BYTES + alignDown(audio);
  return boundaries;
}

/**
 * Turns cut points into chunks, dropping any that a snap collapsed to nothing.
 *
 * Used for both the planned boundaries and the ones the native silence search
 * returns, so a snapped plan is validated by exactly the same rules.
 */
export function chunksFromBoundaries(boundaries) {
  const points = Array.isArray(boundaries) ? boundaries : [];
  const chunks = [];

  for (let index = 0; index + 1 < points.length; index += 1) {
    const start = alignDown(Math.max(WAV_HEADER_BYTES, Math.round(points[index])));
    const end = alignDown(Math.max(start, Math.round(points[index + 1])));
    if (end - start < BLOCK_ALIGN) {
      continue;
    }
    chunks.push({
      index: chunks.length,
      start,
      end,
      bytes: end - start,
      seconds: (end - start) / BYTES_PER_SECOND,
    });
  }

  return chunks;
}

/** A snapped plan that broke the cap is not used; the unsnapped one is. */
export function chunksWithinCap(chunks) {
  return (
    Array.isArray(chunks) &&
    chunks.length > 0 &&
    chunks.every(chunk => chunk.seconds <= CHUNK_HARD_CAP_SECONDS)
  );
}

/** For the message shown when a dictation cannot be refined. */
export function describeBudget() {
  return {
    maxSeconds: MAX_RECORDING_SECONDS,
    maxBytes: MAX_RECORDING_BYTES,
    chunkSeconds: SAFE_CHUNK_SECONDS,
    maxRequestBytes: MAX_UPLOAD_BYTES,
    maxBase64Chars: base64CharsFor(MAX_UPLOAD_BYTES),
  };
}
