let nativeModule;
let resolved = false;

function sharedMic() {
  if (!resolved) {
    resolved = true;
    try {
      nativeModule = require('../specs/NativeSharedMic').default;
    } catch {
      nativeModule = null;
    }
  }
  return nativeModule;
}

/**
 * Isolation layer over the shared-microphone module.
 *
 * Nothing above this file knows that one AudioRecord is feeding both the
 * recognizer and the recording, exactly as `speechService` hides the vendor
 * recognizer. Every call degrades rather than throws when the module is absent,
 * so a build without it simply reports "unsupported".
 */

export function isAvailable() {
  return !!sharedMic();
}

export async function isSupported() {
  const module = sharedMic();
  if (!module) {
    return false;
  }
  try {
    return await module.isSupported();
  } catch {
    return false;
  }
}

export async function start(
  sampleRateHz = 16000,
  name = '',
  language = 'en-IN',
  useSegmented = true,
) {
  const module = sharedMic();
  if (!module) {
    throw new Error('SharedMic module is not in this build. Rebuild natively.');
  }
  return module.start(sampleRateHz, name, language, useSegmented);
}

export async function pause() {
  const module = sharedMic();
  return module ? module.pause() : false;
}

export async function resume() {
  const module = sharedMic();
  return module ? module.resume() : false;
}

export async function stop() {
  const module = sharedMic();
  if (!module) {
    return null;
  }
  return module.stop();
}

export async function getState() {
  const module = sharedMic();
  if (!module) {
    return null;
  }
  try {
    return await module.getState();
  } catch {
    return null;
  }
}

/**
 * Recording files.
 *
 * Served by this module, not the capture spike, because the spike is only
 * registered in debug builds — a release APK has to be able to read and delete
 * the consultation it just recorded.
 */
export async function readCaptureBase64(path, maxBytes) {
  const module = sharedMic();
  if (!module) {
    throw new Error('SharedMic module is not in this build.');
  }
  return module.readCaptureBase64(path, maxBytes);
}

export async function readCaptureChunkBase64(path, from, to) {
  const module = sharedMic();
  if (!module) {
    throw new Error('SharedMic module is not in this build.');
  }
  return module.readCaptureChunkBase64(path, from, to);
}

/**
 * Snapping is an improvement, not a requirement: a build without the module, or
 * a file the search cannot read, falls back to the planned cut points, which are
 * already inside the ceiling.
 */
export async function snapChunkBoundaries(path, boundaries, windowBytes) {
  const module = sharedMic();
  if (!module || !path || !Array.isArray(boundaries) || boundaries.length < 2) {
    return null;
  }
  try {
    const snapped = await module.snapChunkBoundaries(path, boundaries, windowBytes);
    return Array.isArray(snapped) && snapped.length === boundaries.length ? snapped : null;
  } catch {
    return null;
  }
}

export async function deleteCapture(path) {
  const module = sharedMic();
  if (!module || !path) {
    return false;
  }
  return module.deleteCapture(path);
}

export async function purgeCaptures(olderThanMs) {
  const module = sharedMic();
  if (!module) {
    return 0;
  }
  return module.purgeCaptures(olderThanMs);
}
