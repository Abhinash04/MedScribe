import { TRANSLATION_STATUS } from '../src/services/consultationTranslation.js';
import {
  canGenerateReport,
  consumeReportHandoff,
  hasPendingHandoff,
  requestReportHandoff,
} from '../src/services/overlayHandoff.js';

import { check, report } from './lib/fixture-harness.mjs';

check('H1.1 nothing is queued initially', hasPendingHandoff(), false);
check('H1.2 consuming nothing yields nothing', consumeReportHandoff(), null);

requestReportHandoff('Report');
check('H1.3 a request is queued', hasPendingHandoff(), true);
check('H1.4 it consumes as the requested route', consumeReportHandoff(), 'Report');
check('H1.5 and only once', consumeReportHandoff(), null);
check('H1.6 leaving nothing queued', hasPendingHandoff(), false);

requestReportHandoff();
check('H1.7 the default route is Report', consumeReportHandoff(), 'Report');

requestReportHandoff(null);
check('H1.8 a null route queues nothing consumable', consumeReportHandoff(), null);

requestReportHandoff('Report');
requestReportHandoff('Dashboard');
check('H1.9 the latest request wins', consumeReportHandoff(), 'Dashboard');

requestReportHandoff('TranscriptReview');
check(
  'H1.10 the full-review route round trips',
  consumeReportHandoff(),
  'TranscriptReview',
);
check('H1.11 and is consumed once', consumeReportHandoff(), null);

requestReportHandoff('TranscriptReview');
requestReportHandoff('Report');
check(
  'H1.12 generate-report overrides a queued full review',
  consumeReportHandoff(),
  'Report',
);

const state = overrides => ({
  language: 'hi',
  translation: { status: TRANSLATION_STATUS.READY, text: 'English text' },
  ...overrides,
});

check('H2.1 no state cannot generate', canGenerateReport(null), false);
check('H2.2 a ready translation can generate', canGenerateReport(state()), true);
check(
  'H2.3 a pending translation cannot generate',
  canGenerateReport(
    state({ translation: { status: TRANSLATION_STATUS.PENDING, text: '' } }),
  ),
  false,
);
check(
  'H2.4 a failed translation cannot generate',
  canGenerateReport(
    state({ translation: { status: TRANSLATION_STATUS.FAILED, text: '' } }),
  ),
  false,
);
check(
  'H2.5 an English session needs no translation',
  canGenerateReport(
    state({
      language: 'en',
      translation: { status: TRANSLATION_STATUS.IDLE, text: '' },
    }),
  ),
  true,
);
check(
  'H2.6 a session with no language yet needs no translation',
  canGenerateReport(
    state({
      language: null,
      translation: { status: TRANSLATION_STATUS.IDLE, text: '' },
    }),
  ),
  true,
);

report();
