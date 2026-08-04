import { transcribe } from './anuvadini/transcriptionClient';
import { ERROR_KIND } from './anuvadini/proxyContract';
import { DEFAULT_LANGUAGE } from './anuvadini/language';
import * as consultationAudio from './consultationAudio';
import useRecordingStore from '../store/useRecordingStore';

/**
 * Runs the alternative transcription for the current consultation.
 *
 * Never throws and never touches the native transcript: the worst outcome is a
 * failed status the doctor can retry from. The recording is deleted once a
 * result has been recorded, so patient audio does not outlive the decision it
 * was captured for.
 */

let inFlight = null;
/**
 * "Add More Speech" captures only the new audio, while the native transcript
 * keeps growing across passes. Appending is what keeps the two transcripts
 * describing the same consultation; a Retry of the same pass must not.
 */
let appendNext = false;

export function isRefining() {
  return inFlight !== null;
}

export function cancelRefinement() {
  inFlight?.abort();
  inFlight = null;
}

export async function refineTranscript({
  audioBase64 = null,
  language = DEFAULT_LANGUAGE,
  keepAudio = false,
  append = appendNext,
} = {}) {
  appendNext = append;
  const store = useRecordingStore.getState();
  const existing = append ? store.anuvadini?.text ?? '' : '';
  const payload = audioBase64 ?? (await consultationAudio.readForUpload());

  if (!payload) {
    const kind = consultationAudio.currentCapturePath()
      ? ERROR_KIND.AUDIO_TOO_LARGE
      : ERROR_KIND.NO_AUDIO;
    store.setAnuvadiniResult({ ok: false, errorKind: kind });
    return { ok: false, errorKind: kind };
  }

  cancelRefinement();
  const controller = new AbortController();
  inFlight = controller;

  store.setAnuvadiniPending();

  const result = await transcribe({
    audioBase64: payload,
    language,
    signal: controller.signal,
  });

  if (inFlight !== controller) {
    return result;
  }
  inFlight = null;

  // A cancelled request means the doctor moved on; leaving the card in its
  // previous state is less noisy than reporting a failure they caused.
  if (result.errorKind === ERROR_KIND.CANCELLED) {
    return result;
  }

  useRecordingStore.getState().setAnuvadiniResult(
    result.ok && existing
      ? { ...result, text: `${existing} ${result.text}`.trim() }
      : result,
  );

  // The audio has done its job once a transcript exists. A failure keeps it so
  // Retry has something to send.
  if (result.ok && !keepAudio) {
    await consultationAudio.discard();
  }

  return result;
}
