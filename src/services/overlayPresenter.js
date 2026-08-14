import { RECORDING_STATE } from '../constants/recordingStates.js';
import { CONSULTATION_STAGE } from '../store/useRecordingStore.js';
import { ANUVADINI_STATUS } from './consultationTranscripts.js';
import { TRANSLATION_STATUS } from './consultationTranslation.js';

export const OVERLAY_PHASE = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused',
  PROCESSING: 'processing',
  REVIEW: 'review',
  COMPLETED: 'completed',
};

const TRANSCRIPT_PREVIEW_CHARS = 320;

export function resolvePhase(state) {
  const { status, stage } = state;

  if (stage === CONSULTATION_STAGE.REPORT) {
    return OVERLAY_PHASE.COMPLETED;
  }
  if (status === RECORDING_STATE.LISTENING) {
    return OVERLAY_PHASE.RECORDING;
  }
  if (status === RECORDING_STATE.PAUSED) {
    return OVERLAY_PHASE.PAUSED;
  }
  if (status === RECORDING_STATE.PROCESSING) {
    return OVERLAY_PHASE.PROCESSING;
  }
  if (isAwaitingPipeline(state)) {
    return OVERLAY_PHASE.PROCESSING;
  }
  if (stage === CONSULTATION_STAGE.REVIEW) {
    return OVERLAY_PHASE.REVIEW;
  }
  if (status === RECORDING_STATE.SUCCESS) {
    return OVERLAY_PHASE.REVIEW;
  }
  return OVERLAY_PHASE.IDLE;
}

const PIPELINE_BEARING_STATUSES = [
  RECORDING_STATE.PROCESSING,
  RECORDING_STATE.SUCCESS,
];

function hasCompletedCapture(state) {
  return (
    PIPELINE_BEARING_STATUSES.includes(state.status) ||
    state.stage === CONSULTATION_STAGE.REVIEW
  );
}

function isAwaitingPipeline(state) {
  if (!hasCompletedCapture(state)) {
    return false;
  }
  const refining = state.anuvadini?.status === ANUVADINI_STATUS.PENDING;
  const translating = state.translation?.status === TRANSLATION_STATUS.PENDING;
  return refining || translating;
}

export function resolveDetail(state, phase) {
  if (phase !== OVERLAY_PHASE.PROCESSING) {
    return '';
  }
  if (state.translation?.status === TRANSLATION_STATUS.PENDING) {
    const { done, total } = state.translation.progress ?? { done: 0, total: 0 };
    return total > 1 ? `Translating… ${done} of ${total}` : '';
  }
  if (state.anuvadini?.status === ANUVADINI_STATUS.PENDING) {
    const { done, total } = state.refineProgress ?? { done: 0, total: 0 };
    return total > 1 ? `Refining… ${done} of ${total}` : '';
  }
  return '';
}

export function truncateTranscript(text, limit = TRANSCRIPT_PREVIEW_CHARS) {
  const value = String(text ?? '').trim();
  if (value.length <= limit) {
    return value;
  }
  return `…${value.slice(value.length - limit)}`;
}

export function toOverlaySnapshot(state, transcript = '') {
  const phase = resolvePhase(state);

  return {
    phase,
    transcript: truncateTranscript(transcript),
    partial: String(state.partialText ?? ''),
    detail: resolveDetail(state, phase),
    durationSeconds: Number(state.durationSeconds ?? 0),
    level: 0,
    canPause: phase === OVERLAY_PHASE.RECORDING || phase === OVERLAY_PHASE.PAUSED,
    canStop: phase === OVERLAY_PHASE.RECORDING || phase === OVERLAY_PHASE.PAUSED,
    canReview: phase === OVERLAY_PHASE.REVIEW || phase === OVERLAY_PHASE.COMPLETED,
  };
}
