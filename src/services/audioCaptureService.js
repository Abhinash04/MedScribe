let nativeModule;
let resolved = false;

function audioCapture() {
  if (!resolved) {
    resolved = true;
    try {
      nativeModule = require('../specs/NativeAudioCapture').default;
    } catch {
      nativeModule = null;
    }
  }
  return nativeModule;
}

export function isAvailable() {
  return !!audioCapture();
}

export async function isCaptureSupported() {
  const module = audioCapture();
  if (!module) {
    return false;
  }
  return module.isCaptureSupported();
}

export const AUDIO_SOURCES = {
  MIC: 'mic',
  VOICE_RECOGNITION: 'voiceRecognition',
  VOICE_COMMUNICATION: 'voiceCommunication',
  CAMCORDER: 'camcorder',
};

export const CAPTURE_SCOPE = {
  SPIKE: 'spike',
  CONSULTATION: 'consultation',
};

const SUPPORTED_SOURCES = new Set(Object.values(AUDIO_SOURCES));

export async function startCapture(
  sampleRateHz = 16000,
  source = AUDIO_SOURCES.MIC,
  scope = CAPTURE_SCOPE.SPIKE,
  name = '',
) {
  const module = audioCapture();
  if (!module) {
    throw new Error(
      'AudioCapture module is not in this build. Rebuild natively.',
    );
  }
  if (!SUPPORTED_SOURCES.has(source)) {
    throw new Error(`Unknown audio source: ${source}`);
  }
  return module.startCapture(sampleRateHz, source, scope, name);
}

export async function pauseCapture() {
  const module = audioCapture();
  if (!module) {
    return false;
  }
  return module.pauseCapture();
}

export async function resumeCapture() {
  const module = audioCapture();
  if (!module) {
    return false;
  }
  return module.resumeCapture();
}

export async function stopCapture() {
  const module = audioCapture();
  if (!module) {
    throw new Error('AudioCapture module is not in this build.');
  }
  return module.stopCapture();
}

export async function getStats() {
  const module = audioCapture();
  if (!module) {
    return null;
  }
  return module.getStats();
}

export async function readCaptureBase64(path, maxBytes) {
  const module = audioCapture();
  if (!module) {
    throw new Error('AudioCapture module is not in this build.');
  }
  return module.readCaptureBase64(path, maxBytes);
}

export async function deleteCapture(path) {
  const module = audioCapture();
  if (!module || !path) {
    return false;
  }
  return module.deleteCapture(path);
}

export async function purgeCaptures(olderThanMs) {
  const module = audioCapture();
  if (!module) {
    return 0;
  }
  return module.purgeCaptures(olderThanMs);
}
