import {
  OPEN_APP_CAUSE,
  PLAY_MODE,
  RECORDING_ROUTE,
  planPlayAction,
} from '../src/services/consultationLauncher.js';

import { check, report } from './lib/fixture-harness.mjs';

const plan = overrides =>
  planPlayAction({
    micGranted: true,
    sharedMicSupported: true,
    hasUnfinishedSession: false,
    ...overrides,
  });

check('C1.1 a ready device starts in place', plan().mode, PLAY_MODE.HEADLESS);
check('C1.2 and carries no cause', plan().cause, null);
check('C1.3 and needs no route', plan().route, null);

check(
  'C2.1 a missing microphone opens the app',
  plan({ micGranted: false }).mode,
  PLAY_MODE.OPEN_APP,
);
check(
  'C2.2 naming the microphone as the cause',
  plan({ micGranted: false }).cause,
  OPEN_APP_CAUSE.MIC_NOT_GRANTED,
);
check(
  'C2.3 at the recording screen',
  plan({ micGranted: false }).route,
  RECORDING_ROUTE,
);

check(
  'C3.1 no shared mic opens the app',
  plan({ sharedMicSupported: false }).mode,
  PLAY_MODE.OPEN_APP,
);
check(
  'C3.2 naming the capture route as the cause',
  plan({ sharedMicSupported: false }).cause,
  OPEN_APP_CAUSE.NO_SHARED_MIC,
);

check(
  'C4.1 an unfinished consultation opens the app',
  plan({ hasUnfinishedSession: true }).mode,
  PLAY_MODE.OPEN_APP,
);
check(
  'C4.2 rather than silently discarding it',
  plan({ hasUnfinishedSession: true }).cause,
  OPEN_APP_CAUSE.UNFINISHED_SESSION,
);
check(
  'C4.3 and it outranks a missing microphone',
  plan({ hasUnfinishedSession: true, micGranted: false }).cause,
  OPEN_APP_CAUSE.UNFINISHED_SESSION,
);

check(
  'C5.1 every open-app plan names a cause',
  [
    plan({ micGranted: false }),
    plan({ sharedMicSupported: false }),
    plan({ hasUnfinishedSession: true }),
  ].every(result => typeof result.cause === 'string' && result.cause.length > 0),
  true,
);
check(
  'C5.2 and every open-app plan names a route',
  [
    plan({ micGranted: false }),
    plan({ sharedMicSupported: false }),
    plan({ hasUnfinishedSession: true }),
  ].every(result => result.route === RECORDING_ROUTE),
  true,
);

check(
  'C6.1 no arguments never starts headlessly',
  planPlayAction().mode,
  PLAY_MODE.OPEN_APP,
);
check(
  'C6.2 because the microphone is unproven',
  planPlayAction().cause,
  OPEN_APP_CAUSE.MIC_NOT_GRANTED,
);
check(
  'C6.3 only a strict true counts as granted',
  plan({ micGranted: 'yes' }).mode,
  PLAY_MODE.OPEN_APP,
);
check(
  'C6.4 only a strict true counts as supported',
  plan({ sharedMicSupported: 1 }).mode,
  PLAY_MODE.OPEN_APP,
);

report();
