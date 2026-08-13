import { RECORDING_STATE } from '../constants/recordingStates';
import useRecordingStore, {
  selectFullTranscript,
} from '../store/useRecordingStore';
import dictationSessionManager from './dictationSessionManager';
import * as overlay from './dictationOverlayService';
import { checkMicPermission, isGranted } from './permissionService';
import { getActiveSession } from './sessionPersistenceService';
import { OVERLAY_ACTION, resolveCommand } from './overlayCommandRouter';
import { OVERLAY_PHASE, toOverlaySnapshot } from './overlayPresenter';
import { requestReportHandoff } from './overlayHandoff';
import {
  isBubbleSessionActive,
  setBubbleSessionActive,
} from './dictationBubbleSession';

let commandSubscription = null;
let storeSubscription = null;
let micGranted = false;
let foreignSessionId = null;

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

async function handleCommand(action) {
  if (action === OVERLAY_ACTION.PLAY) {
    await refreshMicPermission();
    await refreshForeignSession();
  }

  const state = useRecordingStore.getState();
  const { method } = resolveCommand({
    action,
    status: state.status,
    stage: state.stage,
    micGranted,
    hasForeignActiveSession: foreignSessionId !== null,
  });

  if (!method) {
    publish();
    return;
  }

  switch (method) {
    case 'startSession':
      setBubbleSessionActive(true);
      await overlay.beginDictationForeground();
      await dictationSessionManager.startSession();
      break;

    case 'resumeSession':
      setBubbleSessionActive(true);
      await overlay.beginDictationForeground();
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
      await overlay.openReviewSurface();
      break;

    case 'openReview':
      await overlay.openReviewSurface();
      break;

    case 'openHome':
      requestReportHandoff(null);
      await overlay.handoffToReport();
      break;

    default:
      break;
  }

  publish();
}

export function startBubbleRuntime() {
  if (commandSubscription) {
    return;
  }

  commandSubscription = overlay.subscribeToCommands(event => {
    handleCommand(event?.action).catch(() => {});
  });

  storeSubscription = useRecordingStore.subscribe(publish);
  refreshMicPermission();
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
