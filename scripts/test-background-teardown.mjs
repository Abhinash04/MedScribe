import {
  shouldFinalizeImmediately,
  shouldRestoreAudioCue,
  shouldTeardownOnBackground,
} from '../src/services/dictationBackground.js';
import {
  isBubbleSessionActive,
  setBubbleSessionActive,
} from '../src/services/dictationBubbleSession.js';

import { check, report } from './lib/fixture-harness.mjs';

const teardown = (appState, isDictating, bubbleActive) =>
  shouldTeardownOnBackground({ appState, isDictating, bubbleActive });

check('B1.1 active and dictating stays running', teardown('active', true, false), false);
check('B1.2 active with bubble stays running', teardown('active', true, true), false);
check('B1.3 active and idle stays running', teardown('active', false, false), false);

check('B2.1 background while dictating tears down', teardown('background', true, false), true);
check('B2.2 inactive while dictating tears down', teardown('inactive', true, false), true);
check('B2.3 background while idle does nothing', teardown('background', false, false), false);

check('B3.1 bubble keeps a background session alive', teardown('background', true, true), false);
check('B3.2 bubble keeps an inactive session alive', teardown('inactive', true, true), false);
check('B3.3 bubble and idle still does nothing', teardown('background', false, true), false);

check('B4.1 an absent bubble flag tears down', teardown('background', true, undefined), true);
check('B4.2 a non-true bubble flag tears down', teardown('background', true, 'yes'), true);
check('B4.3 a non-true dictating flag does nothing', teardown('background', 'yes', false), false);
check('B4.4 no arguments does nothing', shouldTeardownOnBackground(), false);

const restore = (appState, bubbleActive) =>
  shouldRestoreAudioCue({ appState, bubbleActive });

check('B5.1 active never restores', restore('active', false), false);
check('B5.2 active with bubble never restores', restore('active', true), false);
check('B5.3 background without bubble restores', restore('background', false), true);
check('B5.4 inactive without bubble restores', restore('inactive', false), true);
check('B5.5 bubble suppresses the restore', restore('background', true), false);
check('B5.6 an absent bubble flag restores', restore('background', undefined), true);
check('B5.7 no arguments restores', shouldRestoreAudioCue(), true);

check(
  'B6.1 shared mic finalizes without waiting',
  shouldFinalizeImmediately({ usesSharedMic: true }),
  true,
);
check(
  'B6.2 the recognizer path keeps its drain window',
  shouldFinalizeImmediately({ usesSharedMic: false }),
  false,
);
check('B6.3 no arguments keeps the drain window', shouldFinalizeImmediately(), false);

check('B7.1 the bubble flag starts false', isBubbleSessionActive(), false);
setBubbleSessionActive(true);
check('B7.2 the flag can be raised', isBubbleSessionActive(), true);
check(
  'B7.3 and a raised flag protects a background session',
  teardown('background', true, isBubbleSessionActive()),
  false,
);
setBubbleSessionActive(false);
check('B7.4 the flag can be lowered', isBubbleSessionActive(), false);
check(
  'B7.5 and a lowered flag lets teardown run',
  teardown('background', true, isBubbleSessionActive()),
  true,
);
setBubbleSessionActive('truthy');
check('B7.6 only a strict true raises it', isBubbleSessionActive(), false);
setBubbleSessionActive(false);

report();
