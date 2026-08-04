import { transcribe } from './anuvadini/transcriptionClient';
import { ERROR_KIND } from './anuvadini/proxyContract';
import { DEFAULT_LANGUAGE } from './anuvadini/language';
import * as consultationAudio from './consultationAudio';
import { continuationBaseFrom } from './consultationTranscripts';
import { getAnuvadiniToken } from './appConfigService';
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
 * The snapshot an in-progress continuation appends to, and the fact that one is
 * in progress at all.
 *
 * Owned by the continuation RECORDING, not by an individual request: a failed
 * attempt keeps it so Retry replays against the same starting point, and only
 * success or teardown clears it. That is what stops a retry from appending the
 * same speech twice.
 */
let continuationBase = null;

export function isRefining() {
  return inFlight !== null;
}

/** True while a continuation is waiting for a result it has not yet applied. */
export function hasPendingContinuation() {
  return continuationBase !== null;
}

/**
 * Called when "Add More Speech" begins recording, so the snapshot reflects the
 * draft as the doctor left it — including any manual corrections.
 */
export function beginContinuation() {
  const { anuvadini } = useRecordingStore.getState();
  continuationBase = continuationBaseFrom(anuvadini);
  return continuationBase;
}

export function clearContinuation() {
  continuationBase = null;
}

export function cancelRefinement() {
  inFlight?.abort();
  inFlight = null;
}

export async function refineTranscript({
  audioBase64 = null,
  language = DEFAULT_LANGUAGE,
  keepAudio = false,
} = {}) {
  const store = useRecordingStore.getState();
  // The base is the only thing that decides whether this is a continuation, so
  // an append can never happen without a snapshot to append to.
  const base = continuationBase;
  const append = base !== null;
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
    token: getAnuvadiniToken(),
    signal: controller.signal,
  });

  if (inFlight !== controller) {
    return result;
  }
  inFlight = null;

  // A cancelled request means the doctor moved on; leaving the card in its
  // previous state is less noisy than reporting a failure they caused. The base
  // survives, because the same audio is still there to retry.
  if (result.errorKind === ERROR_KIND.CANCELLED) {
    return result;
  }

  useRecordingStore.getState().setAnuvadiniResult(result, { append, base });

  if (result.ok) {
    // Applied exactly once; a later "Add More Speech" takes a fresh snapshot.
    clearContinuation();
    if (!keepAudio) {
      await consultationAudio.discard();
    }
  }

  return result;
}
