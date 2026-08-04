import {
  MAX_UPLOAD_BYTES,
  WAV_HEADER_BYTES,
  secondsFor,
  withinUploadBudget,
} from './audioBudget';
import * as capture from './audioCaptureService';

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
    withinBudget: withinUploadBudget(size),
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
 * `withinBudget` is false for a dictation longer than the ceiling: the audio
 * still exists and is still deleted normally, it simply is not sent.
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
    withinBudget: withinUploadBudget(bytes),
  };
  return { ...current };
}

/**
 * Base64 for the upload. Never logged and never held beyond the request — the
 * caller passes it straight to the client and lets it go.
 */
export async function readForUpload() {
  if (!current?.path || !current.finished) {
    return null;
  }
  if (current.bytes && !withinUploadBudget(current.bytes)) {
    return null;
  }

  try {
    return await capture.readCaptureBase64(current.path, MAX_UPLOAD_BYTES);
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
    return await capture.deleteCapture(path);
  } catch {
    return false;
  }
}

/** Anything an interrupted app left behind. Runs at startup. */
export async function purgeAbandoned(olderThanMs = ABANDONED_AFTER_MS) {
  try {
    return await capture.purgeCaptures(olderThanMs);
  } catch {
    return 0;
  }
}
