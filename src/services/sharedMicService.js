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
