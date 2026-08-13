import { RECORDING_STATE } from '../src/constants/recordingStates.js';
import {
  OVERLAY_ACTION,
  OVERLAY_REJECTION,
  resolveCommand,
} from '../src/services/overlayCommandRouter.js';
import { CONSULTATION_STAGE } from '../src/store/useRecordingStore.js';

import { check, report } from './lib/fixture-harness.mjs';

const run = overrides =>
  resolveCommand({
    status: RECORDING_STATE.IDLE,
    stage: CONSULTATION_STAGE.RECORDING,
    micGranted: true,
    hasForeignActiveSession: false,
    ...overrides,
  });

check(
  'C1.1 play from idle starts a session',
  run({ action: OVERLAY_ACTION.PLAY }).method,
  'startSession',
);
check(
  'C1.2 play while paused resumes the same session',
  run({ action: OVERLAY_ACTION.PLAY, status: RECORDING_STATE.PAUSED }).method,
  'resumeSession',
);
check(
  'C1.3 play while listening is refused',
  run({ action: OVERLAY_ACTION.PLAY, status: RECORDING_STATE.LISTENING }).reason,
  OVERLAY_REJECTION.ALREADY_RUNNING,
);
check(
  'C1.4 play while processing is refused',
  run({ action: OVERLAY_ACTION.PLAY, status: RECORDING_STATE.PROCESSING }).reason,
  OVERLAY_REJECTION.BUSY,
);

check(
  'C2.1 play without the microphone is refused',
  run({ action: OVERLAY_ACTION.PLAY, micGranted: false }).reason,
  OVERLAY_REJECTION.MIC_DENIED,
);
check(
  'C2.2 and nothing is invoked',
  run({ action: OVERLAY_ACTION.PLAY, micGranted: false }).method,
  null,
);
check(
  'C2.3 a resume does not need a fresh permission check',
  run({
    action: OVERLAY_ACTION.PLAY,
    status: RECORDING_STATE.PAUSED,
    micGranted: false,
  }).method,
  'resumeSession',
);

check(
  'C3.1 another unfinished session blocks a new one',
  run({ action: OVERLAY_ACTION.PLAY, hasForeignActiveSession: true }).reason,
  OVERLAY_REJECTION.SESSION_IN_PROGRESS,
);
check(
  'C3.2 a consultation already at report stage blocks a new one',
  run({ action: OVERLAY_ACTION.PLAY, stage: CONSULTATION_STAGE.REPORT }).reason,
  OVERLAY_REJECTION.SESSION_IN_PROGRESS,
);

check(
  'C4.1 pause while listening pauses',
  run({ action: OVERLAY_ACTION.PAUSE, status: RECORDING_STATE.LISTENING }).method,
  'pauseSession',
);
for (const status of [
  RECORDING_STATE.IDLE,
  RECORDING_STATE.PAUSED,
  RECORDING_STATE.PROCESSING,
  RECORDING_STATE.SUCCESS,
]) {
  check(
    `C4.2 pause is refused from ${status}`,
    run({ action: OVERLAY_ACTION.PAUSE, status }).reason,
    OVERLAY_REJECTION.NOT_RECORDING,
  );
}

check(
  'C5.1 stop while listening stops',
  run({ action: OVERLAY_ACTION.STOP, status: RECORDING_STATE.LISTENING }).method,
  'stopSession',
);
check(
  'C5.2 stop while paused stops',
  run({ action: OVERLAY_ACTION.STOP, status: RECORDING_STATE.PAUSED }).method,
  'stopSession',
);
for (const status of [
  RECORDING_STATE.IDLE,
  RECORDING_STATE.PROCESSING,
  RECORDING_STATE.SUCCESS,
]) {
  check(
    `C5.3 stop is refused from ${status}`,
    run({ action: OVERLAY_ACTION.STOP, status }).reason,
    OVERLAY_REJECTION.NOT_RECORDING,
  );
}

check(
  'C6.1 home always opens the app',
  run({ action: OVERLAY_ACTION.HOME, status: RECORDING_STATE.LISTENING }).method,
  'openHome',
);
check(
  'C6.2 review always opens the review surface',
  run({ action: OVERLAY_ACTION.REVIEW }).method,
  'openReview',
);

check(
  'C7.1 an unknown action is refused',
  run({ action: 'teleport' }).reason,
  OVERLAY_REJECTION.UNKNOWN_ACTION,
);
check('C7.2 a missing action is refused', run({}).reason, OVERLAY_REJECTION.UNKNOWN_ACTION);
check('C7.3 no arguments is refused', resolveCommand().reason, OVERLAY_REJECTION.UNKNOWN_ACTION);
check(
  'C7.4 a refusal never names a method',
  resolveCommand().method,
  null,
);

report();
