import {
  BYTES_PER_SECOND,
  CHUNK_SNAP_WINDOW_SECONDS,
  WAV_HEADER_BYTES,
  chunksFromBoundaries,
  chunksWithinCap,
  planChunkBoundaries,
  secondsFor,
  withinRecordingBudget,
} from './audioBudget';
import * as capture from './audioCaptureService';
// Reading and deleting go through the shared-mic module: it writes the file and
// is registered in every build, whereas the capture module is debug-only.
import * as sharedMic from './sharedMicService';

/**
 * The recorded audio for one consultation.
 *
 * Patient audio, so it is created only when it is needed, read exactly once,
 * and deleted on every exit path. A build without the native module degrades to
 * "no audio" — refinement is unavailable, the consultation is not.
 */

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

let current = null;

export function currentCapturePath() {
  return current?.path ?? null;
}

export function isCapturing() {
  return !!current && !current.finished;
}

export function isSupported() {
  return capture.isAvailable();
}

/**
 * Takes ownership of a recording made by the shared-microphone module.
 *
 * That module writes the WAV itself — it has to, since it owns the only
 * AudioRecord — but the upload budget, the read and the delete stay here so
 * consultation audio has exactly one lifecycle regardless of who recorded it.
 */
export function adopt(path, bytes) {
  if (!path) {
    return null;
  }
  const size = Number(bytes ?? 0) + WAV_HEADER_BYTES;
  current = {
    path,
    finished: true,
    bytes: size,
    seconds: secondsFor(size),
    withinBudget: withinRecordingBudget(size),
  };
  return { ...current };
}

export async function begin(sessionId, source = capture.AUDIO_SOURCES.VOICE_RECOGNITION) {
  if (!capture.isAvailable()) {
    return null;
  }
  if (isCapturing()) {
    return current.path;
  }

  try {
    const started = await capture.startCapture(
      16000,
      source,
      capture.CAPTURE_SCOPE.CONSULTATION,
      sessionId,
    );
    current = { path: started?.path ?? null, finished: false, bytes: 0 };
    return current.path;
  } catch (error) {
    current = null;
    return null;
  }
}

/** A paused dictation must not keep recording the room. */
export async function pause() {
  if (!isCapturing()) {
    return false;
  }
  try {
    return await capture.pauseCapture();
  } catch {
    return false;
  }
}

export async function resume() {
  if (!isCapturing()) {
    return false;
  }
  try {
    return await capture.resumeCapture();
  } catch {
    return false;
  }
}

/**
 * Stops the recorder and reports whether what it produced can be uploaded.
 *
 * `withinBudget` is now about the whole recording rather than one request, and
 * a recording only exceeds it if the recorder ran away — half an hour. Length
 * alone no longer stops a dictation being sent, because it is sent in chunks.
 */
export async function finish() {
  if (!current || current.finished) {
    return current ? { ...current } : null;
  }

  let stats = null;
  try {
    stats = await capture.stopCapture();
  } catch {
    stats = null;
  }

  // `bytes` is the PCM payload; the header is what the file adds on top.
  const bytes = Number(stats?.bytes ?? 0) + WAV_HEADER_BYTES;
  current = {
    ...current,
    finished: true,
    bytes,
    seconds: secondsFor(bytes),
    withinBudget: withinRecordingBudget(bytes),
  };
  return { ...current };
}

/**
 * How this recording will be uploaded: one byte range per request.
 *
 * The cut points are planned arithmetically and then offered to the native
 * silence search, which moves each interior one to the nearest quiet moment so
 * a boundary does not fall mid-word. Snapping is optional — a plan that comes
 * back unreadable, unsnapped or over the cap falls back to the arithmetic one,
 * which is already inside the service's ceiling.
 */
export async function planUpload() {
  if (!current?.path || !current.finished) {
    return null;
  }
  if (!withinRecordingBudget(current.bytes)) {
    return null;
  }

  const planned = planChunkBoundaries(current.bytes);
  if (planned.length < 2) {
    return null;
  }

  const window = Math.round(CHUNK_SNAP_WINDOW_SECONDS * BYTES_PER_SECOND);
  const snapped = await sharedMic.snapChunkBoundaries(current.path, planned, window);
  const preferred = snapped ? chunksFromBoundaries(snapped) : [];

  return {
    path: current.path,
    chunks: chunksWithinCap(preferred) ? preferred : chunksFromBoundaries(planned),
  };
}

/**
 * Base64 for one chunk. Never logged and never held beyond the request — the
 * caller passes it straight to the client and lets it go.
 */
export async function readChunkForUpload(chunk) {
  if (!current?.path || !current.finished || !chunk) {
    return null;
  }

  try {
    return await sharedMic.readCaptureChunkBase64(current.path, chunk.start, chunk.end);
  } catch {
    return null;
  }
}

/** Deletes the capture. Safe to call more than once. */
export async function discard() {
  const path = current?.path;
  current = null;
  if (!path) {
    return false;
  }
  try {
    return await sharedMic.deleteCapture(path);
  } catch {
    return false;
  }
}

/** Anything an interrupted app left behind. Runs at startup. */
export async function purgeAbandoned(olderThanMs = ABANDONED_AFTER_MS) {
  try {
    return await sharedMic.purgeCaptures(olderThanMs);
  } catch {
    return 0;
  }
}
