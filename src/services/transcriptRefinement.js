import { transcribe } from './anuvadini/transcriptionClient';
import {
  emptyProgress,
  planSignature,
  resumable,
  uploadChunks,
} from './anuvadini/chunkedUpload';
import { ERROR_KIND } from './anuvadini/proxyContract';
import { DEFAULT_LANGUAGE } from './anuvadini/language';
import * as consultationAudio from './consultationAudio';
import { nextPassIndex } from './consultationTranscripts';
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
 * Which recording pass the in-flight result belongs to.
 *
 * Claimed when the pass starts recording and held until its result is applied,
 * so a Retry lands under the same number and REPLACES its entry rather than
 * appending a second copy. Null means "whatever comes next", which is the safe
 * default: an unnumbered result extends the transcript instead of replacing it.
 */
let activePass = null;

/**
 * Chunks of the current recording that have already transcribed.
 *
 * A long dictation is several requests, and a failure on the third must not
 * throw away the first two: Retry re-sends only what is still missing. Keyed by
 * the recording's path so a new recording can never inherit another's text.
 */
let uploaded = emptyProgress();

function resetUploaded(path = null, plan = '') {
  uploaded = emptyProgress(path, plan);
}

export function isRefining() {
  return inFlight !== null;
}

/** True while a pass is waiting for a result it has not yet applied. */
export function hasPendingContinuation() {
  return activePass !== null;
}

/**
 * Claims the pass number a recording that is starting now will land under.
 *
 * Called for every pass, not only continuations: the number is what makes Retry
 * replace rather than duplicate, and pass 1 can be retried too.
 */
export function beginPass() {
  activePass = nextPassIndex(useRecordingStore.getState().anuvadini);
  return activePass;
}

export function activePassIndex() {
  return activePass;
}

export function clearContinuation() {
  activePass = null;
}

/** Both pieces of per-recording state, dropped together when a pass is done. */
export function clearRefinementState() {
  clearContinuation();
  resetUploaded();
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
  // Claimed at Stop if the pass never claimed one, so a result can never be
  // applied without a number — an unnumbered one would silently replace the
  // whole transcript instead of extending it.
  const passIndex = activePass ?? beginPass();

  // An explicitly supplied payload is one request by definition; a recording is
  // however many the service's ceiling requires.
  const plan = audioBase64
    ? { path: null, chunks: [{ index: 0, start: 0, end: 0 }] }
    : await consultationAudio.planUpload();

  if (!plan?.chunks?.length) {
    const kind = consultationAudio.currentCapturePath()
      ? ERROR_KIND.AUDIO_TOO_LARGE
      : ERROR_KIND.NO_AUDIO;
    store.setAnuvadiniResult({ ok: false, errorKind: kind });
    return { ok: false, errorKind: kind };
  }

  // A supplied payload is always its own attempt; a recording resumes only
  // while it is still being cut at the same points.
  if (audioBase64 || !resumable(uploaded, plan.path, plan.chunks)) {
    resetUploaded(plan.path, planSignature(plan.chunks));
  }

  cancelRefinement();
  const controller = new AbortController();
  inFlight = controller;

  store.setAnuvadiniPending();

  const token = getAnuvadiniToken();

  const { superseded, result, progress } = await uploadChunks({
    chunks: plan.chunks,
    progress: uploaded,
    readChunk: chunk => audioBase64 ?? consultationAudio.readChunkForUpload(chunk),
    send: payload =>
      transcribe({ audioBase64: payload, language, token, signal: controller.signal }),
    stillCurrent: () => inFlight === controller,
  });

  // A newer pass took over while a request was in the air; it owns the store,
  // and its own progress, so nothing from this attempt is carried over.
  if (superseded) {
    return result;
  }

  inFlight = null;
  uploaded = progress;

  // A cancelled request means the doctor moved on; leaving the card in its
  // previous state is less noisy than reporting a failure they caused. The pass
  // number and the finished chunks survive, because the audio is still there to
  // retry.
  if (result?.errorKind === ERROR_KIND.CANCELLED) {
    return result;
  }

  useRecordingStore.getState().setAnuvadiniResult(result, { passIndex });

  if (result.ok) {
    // Applied exactly once; the next recording claims the next number.
    clearRefinementState();
    if (!keepAudio) {
      await consultationAudio.discard();
    }
  }

  return result;
}
