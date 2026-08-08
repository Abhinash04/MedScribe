import fs from 'node:fs';
import path from 'node:path';

import {
  CAPTURE_OUTCOME,
  decideCaptureOutcome,
  isRetryableFailure,
} from '../src/services/captureOutcome.js';
import { ERROR_KIND } from '../src/services/anuvadini/proxyContract.js';

import { check, report } from './lib/fixture-harness.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

check(
  'O1.1 a normal recording is transcribed',
  decideCaptureOutcome({ path: '/rec-1.wav', withinBudget: true, transcriptionAvailable: true }),
  CAPTURE_OUTCOME.REFINE,
);
check(
  'O1.2 no audio is reported, not swallowed',
  decideCaptureOutcome({ path: null, withinBudget: false, transcriptionAvailable: true }),
  CAPTURE_OUTCOME.NO_AUDIO,
);
check(
  'O1.3 an empty path counts as no audio',
  decideCaptureOutcome({ path: '', withinBudget: true, transcriptionAvailable: true }),
  CAPTURE_OUTCOME.NO_AUDIO,
);
check(
  'O1.4 a runaway recorder is named as too long',
  decideCaptureOutcome({ path: '/rec-1.wav', withinBudget: false, transcriptionAvailable: true }),
  CAPTURE_OUTCOME.TOO_LARGE,
);
check(
  'O1.5 without an endpoint the audio has no purpose',
  decideCaptureOutcome({ path: '/rec-1.wav', withinBudget: true, transcriptionAvailable: false }),
  CAPTURE_OUTCOME.DISCARD,
);
check(
  'O1.6 and that outranks every other condition',
  decideCaptureOutcome({ path: null, withinBudget: false, transcriptionAvailable: false }),
  CAPTURE_OUTCOME.DISCARD,
);
check('O1.7 no arguments still decides', decideCaptureOutcome(), CAPTURE_OUTCOME.DISCARD);

const OUTCOMES = new Set(Object.values(CAPTURE_OUTCOME));
let undecided = 0;
for (const capturePath of [null, '', '/rec-1.wav']) {
  for (const withinBudget of [true, false]) {
    const outcome = decideCaptureOutcome({
      path: capturePath,
      withinBudget,
      transcriptionAvailable: true,
    });
    if (!OUTCOMES.has(outcome)) {
      undecided += 1;
    }
  }
}
check('O1.8 no combination ends a pass without a verdict', undecided, 0);

const tokensOf = (file, marker) => {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return new Set(
    [...src.slice(src.indexOf(marker)).matchAll(/^ {2}([A-Za-z0-9_]+):/gm)].map(m => m[1]),
  );
};

const COLORS = tokensOf('src/theme/colors.js', 'export const colors');
const TYPOGRAPHY = tokensOf('src/theme/typography.js', 'export');

const walk = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(entry =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    );

const missing = [];
for (const file of walk(path.join(ROOT, 'src'))) {
  if (!/\.(js|jsx)$/.test(file) || file.includes(`${path.sep}theme${path.sep}`)) {
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  const shown = path.relative(ROOT, file).split(path.sep).join('/');

  for (const match of src.matchAll(/\bcolors\.([A-Za-z0-9_]+)/g)) {
    if (!COLORS.has(match[1])) {
      missing.push(`${shown}: colors.${match[1]}`);
    }
  }
  for (const match of src.matchAll(/\btypography\.([A-Za-z0-9_]+)/g)) {
    if (!TYPOGRAPHY.has(match[1])) {
      missing.push(`${shown}: typography.${match[1]}`);
    }
  }
}

check('O2.1 every colour token referenced by a style exists', missing, []);
check('O2.2 the palette was actually read', COLORS.has('primaryAccent'), true);
check('O2.3 and the type scale', TYPOGRAPHY.has('largeHeading'), true);
check('O2.4 a wrong name is not in the palette', COLORS.has('primary'), false);

// A failed pass offers Retry, and Retry re-reads the recording that pass made.
// Two kinds have no recording to re-read, so the button could only fail again:
// offering it hides the remedy that does work, which is to dictate again. This
// is the second half of the Add-More-Speech failure - the doctor pressed Retry
// and watched it fail identically every time.
check(
  'O3.1 no audio is not retryable',
  isRetryableFailure(ERROR_KIND.NO_AUDIO),
  false,
);
check(
  'O3.2 an unconfigured build is not retryable',
  isRetryableFailure(ERROR_KIND.NOT_CONFIGURED),
  false,
);
for (const kind of [
  ERROR_KIND.NETWORK,
  ERROR_KIND.TIMEOUT,
  ERROR_KIND.SERVER_ERROR,
  ERROR_KIND.CLIENT_ERROR,
  ERROR_KIND.MALFORMED,
  ERROR_KIND.EMPTY_TRANSCRIPTION,
  ERROR_KIND.AUDIO_TOO_LARGE,
]) {
  check(`O3.3 ${kind} is worth retrying`, isRetryableFailure(kind), true);
}
check('O3.4 no failure means no retry offered', isRetryableFailure(null), false);
check('O3.5 nor does an empty kind', isRetryableFailure(''), false);

report();
