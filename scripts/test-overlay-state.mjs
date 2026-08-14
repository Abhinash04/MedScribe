import { RECORDING_STATE } from '../src/constants/recordingStates.js';
import { ANUVADINI_STATUS } from '../src/services/consultationTranscripts.js';
import { TRANSLATION_STATUS } from '../src/services/consultationTranslation.js';
import {
  OVERLAY_PHASE,
  resolveDetail,
  resolvePhase,
  toOverlaySnapshot,
  truncateTranscript,
} from '../src/services/overlayPresenter.js';
import { CONSULTATION_STAGE } from '../src/store/useRecordingStore.js';

import { check, report } from './lib/fixture-harness.mjs';

const state = overrides => ({
  status: RECORDING_STATE.IDLE,
  stage: CONSULTATION_STAGE.RECORDING,
  partialText: '',
  durationSeconds: 0,
  anuvadini: { status: ANUVADINI_STATUS.IDLE },
  translation: { status: TRANSLATION_STATUS.IDLE, progress: { done: 0, total: 0 } },
  refineProgress: { done: 0, total: 0 },
  ...overrides,
});

check('S1.1 idle', resolvePhase(state()), OVERLAY_PHASE.IDLE);
check(
  'S1.2 listening is recording',
  resolvePhase(state({ status: RECORDING_STATE.LISTENING })),
  OVERLAY_PHASE.RECORDING,
);
check(
  'S1.3 paused',
  resolvePhase(state({ status: RECORDING_STATE.PAUSED })),
  OVERLAY_PHASE.PAUSED,
);
check(
  'S1.4 processing',
  resolvePhase(state({ status: RECORDING_STATE.PROCESSING })),
  OVERLAY_PHASE.PROCESSING,
);
check(
  'S1.5 success becomes review',
  resolvePhase(state({ status: RECORDING_STATE.SUCCESS })),
  OVERLAY_PHASE.REVIEW,
);
check(
  'S1.6 review stage becomes review',
  resolvePhase(state({ stage: CONSULTATION_STAGE.REVIEW })),
  OVERLAY_PHASE.REVIEW,
);
check(
  'S1.7 report stage becomes completed',
  resolvePhase(state({ stage: CONSULTATION_STAGE.REPORT })),
  OVERLAY_PHASE.COMPLETED,
);
check(
  'S1.8 report stage wins over a live status',
  resolvePhase(
    state({ stage: CONSULTATION_STAGE.REPORT, status: RECORDING_STATE.LISTENING }),
  ),
  OVERLAY_PHASE.COMPLETED,
);

check(
  'S2.1 a pending refinement keeps the overlay processing',
  resolvePhase(
    state({
      status: RECORDING_STATE.SUCCESS,
      anuvadini: { status: ANUVADINI_STATUS.PENDING },
    }),
  ),
  OVERLAY_PHASE.PROCESSING,
);
check(
  'S2.2 a pending translation keeps the overlay processing',
  resolvePhase(
    state({
      status: RECORDING_STATE.SUCCESS,
      translation: { status: TRANSLATION_STATUS.PENDING, progress: { done: 0, total: 0 } },
    }),
  ),
  OVERLAY_PHASE.PROCESSING,
);
check(
  'S2.3 a settled pipeline releases to review',
  resolvePhase(
    state({
      status: RECORDING_STATE.SUCCESS,
      anuvadini: { status: ANUVADINI_STATUS.READY },
      translation: { status: TRANSLATION_STATUS.READY, progress: { done: 2, total: 2 } },
    }),
  ),
  OVERLAY_PHASE.REVIEW,
);

check('S3.1 no detail outside processing', resolveDetail(state(), OVERLAY_PHASE.IDLE), '');
check(
  'S3.2 refinement without a chunk count yields no detail, so the overlay rotates its own messages',
  resolveDetail(
    state({ anuvadini: { status: ANUVADINI_STATUS.PENDING } }),
    OVERLAY_PHASE.PROCESSING,
  ),
  '',
);
check(
  'S3.3 refinement with chunks shows progress',
  resolveDetail(
    state({
      anuvadini: { status: ANUVADINI_STATUS.PENDING },
      refineProgress: { done: 1, total: 3 },
    }),
    OVERLAY_PHASE.PROCESSING,
  ),
  'Refining… 1 of 3',
);
check(
  'S3.4 translation with chunks shows progress',
  resolveDetail(
    state({
      translation: { status: TRANSLATION_STATUS.PENDING, progress: { done: 2, total: 4 } },
    }),
    OVERLAY_PHASE.PROCESSING,
  ),
  'Translating… 2 of 4',
);
check(
  'S3.5 an indeterminate translation also yields no detail',
  resolveDetail(
    state({
      anuvadini: { status: ANUVADINI_STATUS.PENDING },
      translation: { status: TRANSLATION_STATUS.PENDING, progress: { done: 0, total: 0 } },
    }),
    OVERLAY_PHASE.PROCESSING,
  ),
  '',
);
check(
  'S3.6 translation progress still outranks refinement progress',
  resolveDetail(
    state({
      anuvadini: { status: ANUVADINI_STATUS.PENDING },
      refineProgress: { done: 1, total: 3 },
      translation: { status: TRANSLATION_STATUS.PENDING, progress: { done: 2, total: 4 } },
    }),
    OVERLAY_PHASE.PROCESSING,
  ),
  'Translating… 2 of 4',
);
check(
  'S3.7 settled pipelines in processing yield no detail',
  resolveDetail(state(), OVERLAY_PHASE.PROCESSING),
  '',
);

check('S4.1 short text is untouched', truncateTranscript('fever and cough'), 'fever and cough');
check('S4.2 empty text stays empty', truncateTranscript(''), '');
check('S4.3 nullish text stays empty', truncateTranscript(null), '');
{
  const long = 'x'.repeat(500);
  const trimmed = truncateTranscript(long);
  check('S4.4 long text is capped', trimmed.length <= 321, true);
  check('S4.5 and keeps the most recent words', trimmed.endsWith('x'), true);
  check('S4.6 and is marked as truncated', trimmed.startsWith('…'), true);
}

{
  const snapshot = toOverlaySnapshot(
    state({ status: RECORDING_STATE.LISTENING, durationSeconds: 42, partialText: 'aur' }),
    'The patient has fever',
  );
  check('S5.1 phase', snapshot.phase, OVERLAY_PHASE.RECORDING);
  check('S5.2 transcript', snapshot.transcript, 'The patient has fever');
  check('S5.3 partial', snapshot.partial, 'aur');
  check('S5.4 duration', snapshot.durationSeconds, 42);
  check('S5.5 pause is offered while recording', snapshot.canPause, true);
  check('S5.6 stop is offered while recording', snapshot.canStop, true);
  check('S5.7 review is not offered while recording', snapshot.canReview, false);
}

{
  const snapshot = toOverlaySnapshot(state({ status: RECORDING_STATE.PROCESSING }), '');
  check('S5.8 stop is withdrawn while processing', snapshot.canStop, false);
  check('S5.9 pause is withdrawn while processing', snapshot.canPause, false);
}

{
  const snapshot = toOverlaySnapshot(state({ status: RECORDING_STATE.SUCCESS }), 'done');
  check('S5.10 review is offered once settled', snapshot.canReview, true);
  check('S5.11 stop is withdrawn once settled', snapshot.canStop, false);
}

{
  const snapshot = toOverlaySnapshot(state(), '');
  check('S5.12 an idle snapshot carries no partial', snapshot.partial, '');
  check('S5.13 and no detail', snapshot.detail, '');
  check('S5.14 and a zero duration', snapshot.durationSeconds, 0);
}

check(
  'S6.1 a stale pending refinement never wakes an idle bubble',
  resolvePhase(state({ anuvadini: { status: ANUVADINI_STATUS.PENDING } })),
  OVERLAY_PHASE.IDLE,
);
check(
  'S6.2 nor does a stale pending translation',
  resolvePhase(
    state({
      translation: { status: TRANSLATION_STATUS.PENDING, progress: { done: 0, total: 0 } },
    }),
  ),
  OVERLAY_PHASE.IDLE,
);
check(
  'S6.3 so an idle bubble shows no transcript panel',
  toOverlaySnapshot(state({ anuvadini: { status: ANUVADINI_STATUS.PENDING } })).phase,
  OVERLAY_PHASE.IDLE,
);
check(
  'S6.4 and carries no processing detail',
  toOverlaySnapshot(state({ anuvadini: { status: ANUVADINI_STATUS.PENDING } })).detail,
  '',
);
check(
  'S6.5 a pending pipeline during recording stays recording',
  resolvePhase(
    state({
      status: RECORDING_STATE.LISTENING,
      anuvadini: { status: ANUVADINI_STATUS.PENDING },
    }),
  ),
  OVERLAY_PHASE.RECORDING,
);
check(
  'S6.6 but a pending pipeline after review still reports processing',
  resolvePhase(
    state({
      stage: CONSULTATION_STAGE.REVIEW,
      anuvadini: { status: ANUVADINI_STATUS.PENDING },
    }),
  ),
  OVERLAY_PHASE.PROCESSING,
);

report();
