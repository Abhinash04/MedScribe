import { ERROR_KIND } from './anuvadini/proxyContract.js';

export const CAPTURE_OUTCOME = {
  DISCARD: 'discard',
  NO_AUDIO: 'no_audio',
  TOO_LARGE: 'too_large',
  REFINE: 'refine',
};

export function decideCaptureOutcome({
  path = null,
  withinBudget = false,
  transcriptionAvailable = false,
} = {}) {
  if (!transcriptionAvailable) {
    return CAPTURE_OUTCOME.DISCARD;
  }
  if (!path) {
    return CAPTURE_OUTCOME.NO_AUDIO;
  }
  if (!withinBudget) {
    return CAPTURE_OUTCOME.TOO_LARGE;
  }
  return CAPTURE_OUTCOME.REFINE;
}

const NOT_RETRYABLE = new Set([
  ERROR_KIND.NO_AUDIO,
  ERROR_KIND.NOT_CONFIGURED,
  ERROR_KIND.AUDIO_TOO_LARGE,
]);

export function isRetryableFailure(errorKind) {
  return !!errorKind && !NOT_RETRYABLE.has(errorKind);
}
