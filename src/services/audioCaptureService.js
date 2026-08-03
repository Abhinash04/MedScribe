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

const SUPPORTED_SOURCES = new Set(Object.values(AUDIO_SOURCES));

export async function startCapture(sampleRateHz = 16000, source = AUDIO_SOURCES.MIC) {
  const module = audioCapture();
  if (!module) {
    throw new Error('AudioCapture module is not in this build. Rebuild natively.');
  }
  // The native side falls back to MIC for anything it does not recognise, which
  // would silently invalidate a spike phase measuring a different source.
  if (!SUPPORTED_SOURCES.has(source)) {
    throw new Error(`Unknown audio source: ${source}`);
  }
  return module.startCapture(sampleRateHz, source);
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
