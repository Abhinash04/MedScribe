import { isTranscriptionProxyConfigured } from './endpoints';

/**
 * Two recognizer clients cannot share a microphone: measured on device, the
 * system recognizer returned NO_MATCH on every utterance across all four audio
 * sources while an AudioRecord was open.
 *
 * The shared-microphone module solves it the other way round — we own the only
 * AudioRecord and hand the recognizer a pipe via EXTRA_AUDIO_SOURCE. Measured
 * on the Oppo A059: 88% word recall against a 75% recognizer-only baseline,
 * partials from 3.0 s, one clean segmented finalisation, and an audible WAV
 * from the same stream.
 *
 * Classic per-utterance recognition over the same pipe never finalises — it
 * streams partials and then times out with zero results — so segmented session
 * mode is the only viable shape.
 */
export const CONCURRENT_CAPTURE_VERIFIED = true;

/** Capture is pointless without somewhere to send the audio. */
export function isCaptureEnabled() {
  return CONCURRENT_CAPTURE_VERIFIED && isTranscriptionProxyConfigured();
}
