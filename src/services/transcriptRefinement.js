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
  // The base is the only thing that decides whether this is a continuation, so
  // an append can never happen without a snapshot to append to.
  const base = continuationBase;
  const append = base !== null;

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
  // previous state is less noisy than reporting a failure they caused. The base
  // and the finished chunks survive, because the audio is still there to retry.
  if (result?.errorKind === ERROR_KIND.CANCELLED) {
    return result;
  }

  useRecordingStore.getState().setAnuvadiniResult(result, { append, base });

  if (result.ok) {
    // Applied exactly once; a later "Add More Speech" takes a fresh snapshot.
    clearRefinementState();
    if (!keepAudio) {
      await consultationAudio.discard();
    }
  }

  return result;
}
