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
import * as sharedMic from './sharedMicService';
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
export async function begin(
  sessionId,
  source = capture.AUDIO_SOURCES.VOICE_RECOGNITION,
) {
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
  const snapped = await sharedMic.snapChunkBoundaries(
    current.path,
    planned,
    window,
  );
  const preferred = snapped ? chunksFromBoundaries(snapped) : [];
  return {
    path: current.path,
    chunks: chunksWithinCap(preferred)
      ? preferred
      : chunksFromBoundaries(planned),
  };
}
export async function readChunkForUpload(chunk) {
  if (!current?.path || !current.finished || !chunk) {
    return null;
  }

  try {
    return await sharedMic.readCaptureChunkBase64(
      current.path,
      chunk.start,
      chunk.end,
    );
  } catch {
    return null;
  }
}
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
export async function purgeAbandoned(olderThanMs = ABANDONED_AFTER_MS) {
  try {
    return await sharedMic.purgeCaptures(olderThanMs);
  } catch {
    return 0;
  }
}
