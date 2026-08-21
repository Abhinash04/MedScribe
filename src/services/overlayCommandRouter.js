import { RECORDING_STATE } from '../constants/recordingStates.js';
import { CONSULTATION_STAGE } from '../store/useRecordingStore.js';
import { PLAY_MODE, planPlayAction } from './consultationLauncher.js';

export const OVERLAY_ACTION = {
  PLAY: 'play',
  PAUSE: 'pause',
  STOP: 'stop',
  HOME: 'home',
  REVIEW: 'review',
  DISMISS: 'dismiss',
};

export const OVERLAY_REJECTION = {
  UNKNOWN_ACTION: 'unknown_action',
  NOT_RECORDING: 'not_recording',
  NOT_PAUSED: 'not_paused',
  ALREADY_RUNNING: 'already_running',
  MIC_DENIED: 'mic_denied',
  SESSION_IN_PROGRESS: 'session_in_progress',
  BUSY: 'busy',
};

const ACTIVE_STATUSES = [RECORDING_STATE.LISTENING, RECORDING_STATE.PAUSED];

const reject = reason => ({ method: null, reason });
const invoke = method => ({ method, reason: null });

export function resolveCommand({
  action,
  status,
  stage,
  micGranted = false,
  sharedMicSupported = false,
  hasForeignActiveSession = false,
} = {}) {
  switch (action) {
    case OVERLAY_ACTION.HOME:
      return invoke('openHome');

    case OVERLAY_ACTION.REVIEW:
      return invoke('openReview');

    case OVERLAY_ACTION.DISMISS:
      return invoke('dismissBubble');

    case OVERLAY_ACTION.PLAY: {
      if (status === RECORDING_STATE.PAUSED) {
        return invoke('resumeSession');
      }
      if (status === RECORDING_STATE.LISTENING) {
        return reject(OVERLAY_REJECTION.ALREADY_RUNNING);
      }
      if (status === RECORDING_STATE.PROCESSING) {
        return reject(OVERLAY_REJECTION.BUSY);
      }
      if (
        stage === CONSULTATION_STAGE.REPORT ||
        stage === CONSULTATION_STAGE.REVIEW
      ) {
        return reject(OVERLAY_REJECTION.SESSION_IN_PROGRESS);
      }

      const plan = planPlayAction({
        micGranted,
        sharedMicSupported,
        hasUnfinishedSession: hasForeignActiveSession,
      });

      if (plan.mode === PLAY_MODE.OPEN_APP) {
        return { method: 'openRecording', reason: plan.cause };
      }
      return invoke('startSession');
    }

    case OVERLAY_ACTION.PAUSE: {
      if (status !== RECORDING_STATE.LISTENING) {
        return reject(OVERLAY_REJECTION.NOT_RECORDING);
      }
      return invoke('pauseSession');
    }

    case OVERLAY_ACTION.STOP: {
      if (!ACTIVE_STATUSES.includes(status)) {
        return reject(OVERLAY_REJECTION.NOT_RECORDING);
      }
      return invoke('stopSession');
    }

    default:
      return reject(OVERLAY_REJECTION.UNKNOWN_ACTION);
  }
}
