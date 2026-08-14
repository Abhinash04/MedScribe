import {
  OVERLAY_STATE,
  canBeRestricted,
  describeDiagnostics,
  guidanceFor,
  isAdbInstall,
  isTrustedInstall,
  resolveOverlayState,
} from '../src/services/overlayRestriction.js';

import { check, report } from './lib/fixture-harness.mjs';

const PLAY = 'com.android.vending';
const FILE_MANAGER = 'com.google.android.packageinstaller';

const diag = overrides => ({
  canDrawOverlays: false,
  windowAttached: false,
  serviceRunning: false,
  sdkInt: 34,
  manufacturer: 'Google',
  model: 'Pixel',
  installerPackage: FILE_MANAGER,
  ...overrides,
});

check('R1.1 an adb install reports none', isAdbInstall('none'), true);
check('R1.2 and com.android.shell', isAdbInstall('com.android.shell'), true);
check('R1.3 and a null string', isAdbInstall('null'), true);
check('R1.4 an unreadable installer is treated as adb', isAdbInstall('unknown'), true);
check('R1.5 a file manager is not an adb install', isAdbInstall(FILE_MANAGER), false);
check('R1.6 Play is not an adb install', isAdbInstall(PLAY), false);
check('R1.7 Play is the trusted installer', isTrustedInstall(PLAY), true);
check('R1.8 a file manager is not trusted', isTrustedInstall(FILE_MANAGER), false);

check(
  'R2.1 a file-manager install on API 34 can be restricted',
  canBeRestricted({ sdkInt: 34, installerPackage: FILE_MANAGER }),
  true,
);
check(
  'R2.2 the same install on API 32 cannot',
  canBeRestricted({ sdkInt: 32, installerPackage: FILE_MANAGER }),
  false,
);
check(
  'R2.3 an adb install is exempt even on API 34',
  canBeRestricted({ sdkInt: 34, installerPackage: 'com.android.shell' }),
  false,
);
check(
  'R2.4 a Play install is exempt',
  canBeRestricted({ sdkInt: 34, installerPackage: PLAY }),
  false,
);
check('R2.5 no arguments cannot be restricted', canBeRestricted(), false);

check(
  'R3.1 the release sideload case resolves to restricted settings',
  resolveOverlayState(diag()),
  OVERLAY_STATE.RESTRICTED_SETTINGS,
);
check(
  'R3.2 the same refusal after an adb install is simply not granted',
  resolveOverlayState(diag({ installerPackage: 'none' })),
  OVERLAY_STATE.NOT_GRANTED,
);
check(
  'R3.3 a granted permission with an attached window is granted',
  resolveOverlayState(diag({ canDrawOverlays: true, windowAttached: true })),
  OVERLAY_STATE.GRANTED,
);
check(
  'R3.4 granted but never attached while running is the OEM block',
  resolveOverlayState(
    diag({ canDrawOverlays: true, windowAttached: false, serviceRunning: true }),
  ),
  OVERLAY_STATE.OEM_BACKGROUND_BLOCK,
);
check(
  'R3.5 granted with no service running is not an OEM block',
  resolveOverlayState(
    diag({ canDrawOverlays: true, windowAttached: false, serviceRunning: false }),
  ),
  OVERLAY_STATE.GRANTED,
);
check(
  'R3.6 an old device that refuses is simply not granted',
  resolveOverlayState(diag({ sdkInt: 30 })),
  OVERLAY_STATE.NOT_GRANTED,
);
check(
  'R3.7 no diagnostics at all resolves to not granted',
  resolveOverlayState(),
  OVERLAY_STATE.NOT_GRANTED,
);

check(
  'R4.1 the restricted guidance names the menu the user must open',
  guidanceFor(OVERLAY_STATE.RESTRICTED_SETTINGS).body.includes(
    'Allow restricted settings',
  ),
  true,
);
check(
  'R4.2 and says it is not the app misbehaving',
  guidanceFor(OVERLAY_STATE.RESTRICTED_SETTINGS).body.includes('not a'),
  true,
);
check(
  'R4.3 the OEM guidance names the background toggle',
  guidanceFor(OVERLAY_STATE.OEM_BACKGROUND_BLOCK).body.includes(
    'running in background',
  ),
  true,
);
check(
  'R4.4 an unknown state still returns usable guidance',
  typeof guidanceFor('nonsense').title,
  'string',
);

const described = describeDiagnostics(diag());
check('R5.1 a description carries the state', described.state, OVERLAY_STATE.RESTRICTED_SETTINGS);
check('R5.2 and six diagnostic lines', described.lines.length, 6);
check(
  'R5.3 including the installer, which is the deciding value',
  described.lines.some(line => line.includes(FILE_MANAGER)),
  true,
);
check('R5.4 describing nothing does not throw', typeof describeDiagnostics().state, 'string');

report();
