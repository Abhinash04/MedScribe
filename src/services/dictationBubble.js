import { RECORDING_STATE } from '../constants/recordingStates';
import useRecordingStore, {
  selectFullTranscript,
} from '../store/useRecordingStore';
import dictationSessionManager from './dictationSessionManager';
import * as overlay from './dictationOverlayService';
import * as sharedMic from './sharedMicService';
import { checkMicPermission, isGranted } from './permissionService';
import { getActiveSession } from './sessionPersistenceService';
import {
  OVERLAY_ACTION,
  OVERLAY_REJECTION,
  resolveCommand,
} from './overlayCommandRouter';
import { OPEN_APP_CAUSE, RECORDING_ROUTE } from './consultationLauncher';
import {
  OVERLAY_PHASE,
  resolvePhase,
  toOverlaySnapshot,
} from './overlayPresenter';
import { requestReportHandoff } from './overlayHandoff';
import {
  isBubbleSessionActive,
  setBubbleSessionActive,
} from './dictationBubbleSession';

let commandSubscription = null;
let storeSubscription = null;
let micGranted = false;
let sharedMicSupported = false;
let foreignSessionId = null;

const REASON_MESSAGES = {
  [OVERLAY_REJECTION.ALREADY_RUNNING]: 'Already recording',
  [OVERLAY_REJECTION.BUSY]: 'Finishing the last dictation',
  [OVERLAY_REJECTION.NOT_RECORDING]: 'Nothing to stop yet',
  [OVERLAY_REJECTION.NOT_PAUSED]: 'Recording is not paused',
  [OVERLAY_REJECTION.MIC_DENIED]: 'Microphone access needed',
  [OVERLAY_REJECTION.SESSION_IN_PROGRESS]: 'Finish the current consultation first',
  [OPEN_APP_CAUSE.MIC_NOT_GRANTED]: 'Opening MedScribe for microphone access',
  [OPEN_APP_CAUSE.NO_SHARED_MIC]: 'Opening MedScribe to record',
  [OPEN_APP_CAUSE.UNFINISHED_SESSION]: 'Opening your unfinished consultation',
};

const FOREGROUND_UNAVAILABLE_MESSAGE = 'Could not start recording in the background';
const COMMAND_FAILED_MESSAGE = 'Something went wrong. Open MedScribe to continue';

function messageForReason(reason) {
  return REASON_MESSAGES[reason] ?? '';
}

function publish() {
  const state = useRecordingStore.getState();
  overlay.pushState(toOverlaySnapshot(state, selectFullTranscript(state)));
}

async function refreshMicPermission() {
  try {
    micGranted = isGranted(await checkMicPermission());
  } catch {
    micGranted = false;
  }
  return micGranted;
}

async function refreshForeignSession() {
  try {
    const active = await getActiveSession();
    const own = useRecordingStore.getState().sessionId;
    foreignSessionId =
      active?.id && active.id !== own && active.segments?.length ? active.id : null;
  } catch {
    foreignSessionId = null;
  }
  return foreignSessionId;
}

async function refreshSharedMicSupport() {
  try {
    sharedMicSupported = await sharedMic.isSupported();
  } catch {
    sharedMicSupported = false;
  }
  return sharedMicSupported;
}

async function handleCommand(action) {
  if (action === OVERLAY_ACTION.PLAY) {
    await refreshMicPermission();
    await refreshForeignSession();
    await refreshSharedMicSupport();
  }

  const state = useRecordingStore.getState();
  const { method, reason } = resolveCommand({
    action,
    status: state.status,
    stage: state.stage,
    micGranted,
    sharedMicSupported,
    hasForeignActiveSession: foreignSessionId !== null,
  });

  if (!method) {
    await overlay.showOverlayMessage(messageForReason(reason));
    publish();
    return;
  }

  try {
    switch (method) {
      case 'startSession':
        if (!(await beginForeground())) {
          return;
        }
        await dictationSessionManager.startSession();
        break;

      case 'resumeSession':
        if (!(await beginForeground())) {
          return;
        }
        await dictationSessionManager.resumeSession();
        break;

      case 'pauseSession':
        await dictationSessionManager.pauseSession();
        break;

      case 'stopSession':
        await dictationSessionManager.stopSession();
        useRecordingStore.getState().setStatus(RECORDING_STATE.SUCCESS);
        await overlay.endDictationForeground();
        setBubbleSessionActive(false);
        await awaitProcessingComplete();
        await overlay.openReviewSurface();
        break;

      case 'openReview':
        await overlay.openReviewSurface();
        break;

      case 'openRecording':
        await overlay.showOverlayMessage(messageForReason(reason));
        requestReportHandoff(RECORDING_ROUTE);
        await overlay.handoffToReport();
        break;

      case 'openHome':
        requestReportHandoff(null);
        await overlay.handoffToReport();
        break;

      case 'dismissBubble': {
        const settingsStore = require('../store/useSettingsStore').default;
        await settingsStore.getState().setBubbleEnabled(false);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    await recoverFromFailure(method);
  } finally {
    publish();
  }
}

function processingSettled() {
  return (
    resolvePhase(useRecordingStore.getState()) !== OVERLAY_PHASE.PROCESSING
  );
}

function awaitProcessingComplete() {
  if (processingSettled()) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const unsubscribe = useRecordingStore.subscribe(() => {
      if (!processingSettled()) {
        return;
      }
      unsubscribe();
      resolve();
    });
  });
}

async function beginForeground() {
  setBubbleSessionActive(true);
  if (await overlay.beginDictationForeground()) {
    return true;
  }
  setBubbleSessionActive(false);
  await overlay.showOverlayMessage(FOREGROUND_UNAVAILABLE_MESSAGE);
  return false;
}

async function recoverFromFailure(method) {
  if (method === 'startSession' || method === 'resumeSession') {
    useRecordingStore.getState().setStatus(RECORDING_STATE.IDLE);
  }
  if (method === 'stopSession') {
    useRecordingStore.getState().setStatus(RECORDING_STATE.SUCCESS);
  }
  await overlay.endDictationForeground();
  setBubbleSessionActive(false);
  await overlay.showOverlayMessage(COMMAND_FAILED_MESSAGE);
}

export function startBubbleRuntime() {
  if (commandSubscription) {
    return;
  }

  const subscription = overlay.subscribeToCommands(event => {
    handleCommand(event?.action).catch(() => {});
  });

  if (!subscription) {
    return;
  }

  commandSubscription = subscription;
  storeSubscription = useRecordingStore.subscribe(publish);
  refreshMicPermission();
  refreshSharedMicSupport();
  publish();
}

export function stopBubbleRuntime() {
  commandSubscription?.();
  commandSubscription = null;
  storeSubscription?.();
  storeSubscription = null;
  setBubbleSessionActive(false);
}

export async function enableBubble() {
  if (!overlay.canDrawOverlays()) {
    return false;
  }
  const started = await overlay.startBubbleService();
  if (started) {
    startBubbleRuntime();
  }
  return started;
}

export async function disableBubble() {
  stopBubbleRuntime();
  return overlay.stopBubbleService();
}

export { OVERLAY_PHASE, isBubbleSessionActive, setBubbleSessionActive };
