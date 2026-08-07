export const CAPTURE_OUTCOME = {
  DISCARD: 'discard',
  NO_AUDIO: 'no_audio',
  TOO_LARGE: 'too_large',
  REFINE: 'refine',
};

/**
 * What Stop should do with the recording a pass produced.
 *
 * Extracted from the session manager so it can be asserted without a device.
 * The case that matters is NO_AUDIO: this used to be an untaken `if` branch, so
 * a pass whose recording never reached the uploader returned in silence. The
 * card kept the PREVIOUS pass's result at status READY, which is
 * indistinguishable from a successful transcription — an "Add More Speech" that
 * lost its audio looked exactly like one that worked, with the new speech simply
 * missing from the AI transcript and nothing to retry.
 *
 * Every path now produces an outcome, so no pass can end without a verdict.
 */
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
