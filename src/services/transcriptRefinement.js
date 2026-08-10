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

let inFlight = null;
let activePass = null;
let uploaded = emptyProgress();

function resetUploaded(path = null, plan = '') {
  uploaded = emptyProgress(path, plan);
}

export function isRefining() {
  return inFlight !== null;
}

export function hasPendingContinuation() {
  return activePass !== null;
}
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
  const passIndex = activePass ?? beginPass();

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

  if (audioBase64 || !resumable(uploaded, plan.path, plan.chunks)) {
    resetUploaded(plan.path, planSignature(plan.chunks));
  }

  cancelRefinement();
  const controller = new AbortController();
  inFlight = controller;

  store.setAnuvadiniPending();
  store.setRefineProgress({ done: 0, total: plan.chunks.length });

  const token = getAnuvadiniToken();

  const { superseded, result, progress } = await uploadChunks({
    chunks: plan.chunks,
    progress: uploaded,
    readChunk: chunk =>
      audioBase64 ?? consultationAudio.readChunkForUpload(chunk),
    send: payload =>
      transcribe({
        audioBase64: payload,
        language,
        token,
        signal: controller.signal,
      }),
    stillCurrent: () => inFlight === controller,
    onProgress: counts => {
      if (inFlight === controller) {
        useRecordingStore.getState().setRefineProgress(counts);
      }
    },
  });

  if (superseded) {
    return result;
  }

  inFlight = null;
  uploaded = progress;

  if (result?.errorKind === ERROR_KIND.CANCELLED) {
    return result;
  }

  useRecordingStore.getState().setAnuvadiniResult(result, { passIndex });

  if (result.ok) {
    clearRefinementState();
    if (!keepAudio) {
      await consultationAudio.discard();
    }
  }

  return result;
}
