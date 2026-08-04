import { getAnuvadiniToken } from '../services/appConfigService';
import { resolveTransport, TRANSPORT } from './endpoints';

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

/**
 * Capture is deliberately NOT gated on having a transcription endpoint.
 *
 * It used to be, and a release build without a URL therefore lost the shared
 * microphone silently — giving up the better recognition path as well as the
 * recording. Only the upload depends on an endpoint; when there is none, the
 * recording is discarded at the end of the consultation rather than kept.
 */
export function isCaptureEnabled() {
  return CONCURRENT_CAPTURE_VERIFIED;
}

/** Whether the alternative transcription has anywhere to send audio. */
export function isTranscriptionAvailable() {
  return resolveTransport(getAnuvadiniToken()) !== TRANSPORT.NONE;
}
