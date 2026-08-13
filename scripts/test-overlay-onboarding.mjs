
import {
  INITIAL_ROUTE,
  resolveInitialRoute,
} from '../src/services/overlayOnboarding.js';

import { check, report } from './lib/fixture-harness.mjs';

const route = overrides =>
  resolveInitialRoute({
    overlayGranted: false,
    micGranted: true,
    onboardingSeen: false,
    overlaySupported: true,
    ...overrides,
  });

check('O1.1 first run without the grant shows onboarding', route(), INITIAL_ROUTE.ONBOARDING);
check(
  'O1.2 an existing grant skips onboarding',
  route({ overlayGranted: true }),
  INITIAL_ROUTE.DASHBOARD,
);
check(
  'O1.3 a previous skip is remembered',
  route({ onboardingSeen: true }),
  INITIAL_ROUTE.DASHBOARD,
);
check(
  'O1.4 granted and seen still goes to the dashboard',
  route({ overlayGranted: true, onboardingSeen: true }),
  INITIAL_ROUTE.DASHBOARD,
);

check(
  'O2.1 a build without the native module never onboards',
  route({ overlaySupported: false }),
  INITIAL_ROUTE.DASHBOARD,
);
check(
  'O2.2 even when nothing else is set',
  route({ overlaySupported: false, overlayGranted: false, onboardingSeen: false }),
  INITIAL_ROUTE.DASHBOARD,
);

check(
  'O3.1 only a strict true counts as granted',
  route({ overlayGranted: 'yes' }),
  INITIAL_ROUTE.ONBOARDING,
);
check(
  'O3.2 only a strict true counts as seen',
  route({ onboardingSeen: 1 }),
  INITIAL_ROUTE.ONBOARDING,
);
check(
  'O3.3 no arguments onboards',
  resolveInitialRoute(),
  INITIAL_ROUTE.ONBOARDING,
);
check(
  'O3.4 the two route names are distinct',
  INITIAL_ROUTE.ONBOARDING === INITIAL_ROUTE.DASHBOARD,
  false,
);

check(
  'O4.1 a missing microphone onboards even with the overlay granted',
  route({ micGranted: false, overlayGranted: true }),
  INITIAL_ROUTE.ONBOARDING,
);
check(
  'O4.2 and even on a build without the overlay module',
  route({ micGranted: false, overlaySupported: false }),
  INITIAL_ROUTE.ONBOARDING,
);
check(
  'O4.3 only a strict true counts as a microphone grant',
  route({ micGranted: 'granted', overlayGranted: true }),
  INITIAL_ROUTE.ONBOARDING,
);
check(
  'O4.4 a previous skip still wins over a missing microphone',
  route({ micGranted: false, onboardingSeen: true }),
  INITIAL_ROUTE.DASHBOARD,
);
check(
  'O4.5 both permissions present goes straight to the dashboard',
  route({ micGranted: true, overlayGranted: true }),
  INITIAL_ROUTE.DASHBOARD,
);

report();
