globalThis.fetch = () => {
  throw new Error('test-overlay-review-transcript must not perform network calls');
};

import {
  ANUVADINI_STATUS,
  TRANSCRIPT_SOURCE,
  canOffer,
  emptyAnuvadini,
  shouldAutoSelectAi,
} from '../src/services/consultationTranscripts.js';
import { TRANSLATION_STATUS } from '../src/services/consultationTranslation.js';
import {
  REPORT_SOURCE_KIND,
  isTranslationReady,
  selectActiveTranscript,
  selectEnglishTranscript,
  selectFullTranscript,
  selectLiveTranscript,
  selectPreferredTranscript,
  selectReportSourceKind,
  selectReportTranscript,
} from '../src/store/useRecordingStore.js';

import { check, report } from './lib/fixture-harness.mjs';

const NATIVE = 'ରୋଗୀ ନାମ ରାହୁଲ ବୟସ ଚଉତିରିଶ';
const AI = 'ପ୍ରାରମ୍ଭିକ ମାମଲା। ରୋଗୀଙ୍କ ନାମ ରାହୁଲ ଶର୍ମା। ବୟସ ୩୪ ବର୍ଷ।';

const state = ({
  native = NATIVE,
  anuvadini = {},
  source = TRANSCRIPT_SOURCE.NATIVE,
  language = 'or',
  translation = null,
} = {}) => ({
  segments: native ? [{ text: native, confidence: 1 }] : [],
  chunks: [],
  anuvadini: { ...emptyAnuvadini(), ...anuvadini },
  transcriptSource: source,
  sourceChosen: false,
  language,
  translation: translation ?? {
    text: '',
    status: TRANSLATION_STATUS.IDLE,
    sourceText: '',
  },
});

const ready = (text = AI) => ({ text, status: ANUVADINI_STATUS.READY });

{
  const drawer = state({ anuvadini: ready() });

  check('O1.1 the AI transcript is what the drawer renders', selectPreferredTranscript(drawer), AI);
  check(
    'O1.2 the native transcript is NOT what the drawer renders',
    selectPreferredTranscript(drawer) === selectFullTranscript(drawer),
    false,
  );
  check('O1.3 the native transcript is still reachable', selectFullTranscript(drawer), NATIVE);
}

for (const status of [
  ANUVADINI_STATUS.IDLE,
  ANUVADINI_STATUS.PENDING,
  ANUVADINI_STATUS.FAILED,
]) {
  check(
    `O2.1 ${status} falls back to the native transcript`,
    selectPreferredTranscript(state({ anuvadini: { text: AI, status } })),
    NATIVE,
  );
}

check(
  'O2.2 READY with whitespace-only text falls back',
  selectPreferredTranscript(state({ anuvadini: ready('   ') })),
  NATIVE,
);
check(
  'O2.3 READY with empty text falls back',
  selectPreferredTranscript(state({ anuvadini: ready('') })),
  NATIVE,
);
check(
  'O2.4 a missing anuvadini block is survivable',
  selectPreferredTranscript({ ...state(), anuvadini: undefined }),
  NATIVE,
);
check(
  'O2.5 with neither transcript the drawer gets an empty string, not a crash',
  selectPreferredTranscript(state({ native: '', anuvadini: ready('') })),
  '',
);
check(
  'O2.6 AI-only, no native segments, still shows the AI text',
  selectPreferredTranscript(state({ native: '', anuvadini: ready() })),
  AI,
);

{
  const opening = state({ anuvadini: ready() });

  check(
    'O3.1 the drawer opens wanting to switch to the AI source',
    shouldAutoSelectAi({
      nativeText: selectFullTranscript(opening),
      anuvadini: opening.anuvadini,
      source: opening.transcriptSource,
      chosen: false,
    }),
    true,
  );

  check(
    'O3.2 before the flip the pipeline still reads native — the mismatch this fixes',
    selectActiveTranscript(opening),
    NATIVE,
  );

  const flipped = { ...opening, transcriptSource: TRANSCRIPT_SOURCE.ANUVADINI };

  check('O3.3 after the flip the pipeline reads the AI text', selectActiveTranscript(flipped), AI);
  check(
    'O3.4 displayed text and pipeline text now agree',
    selectPreferredTranscript(flipped),
    selectActiveTranscript(flipped),
  );
  check(
    'O3.5 the flip does not repeat once it has happened',
    shouldAutoSelectAi({
      nativeText: selectFullTranscript(flipped),
      anuvadini: flipped.anuvadini,
      source: flipped.transcriptSource,
      chosen: false,
    }),
    false,
  );
  check(
    'O3.6 a doctor who already chose is not overridden',
    shouldAutoSelectAi({
      nativeText: selectFullTranscript(opening),
      anuvadini: opening.anuvadini,
      source: opening.transcriptSource,
      chosen: true,
    }),
    false,
  );
}

for (const status of [ANUVADINI_STATUS.PENDING, ANUVADINI_STATUS.FAILED]) {
  const pending = state({ anuvadini: { text: AI, status } });
  check(
    `O3.7 no flip while the AI pass is ${status}`,
    shouldAutoSelectAi({
      nativeText: selectFullTranscript(pending),
      anuvadini: pending.anuvadini,
      source: pending.transcriptSource,
      chosen: false,
    }),
    false,
  );
}

check(
  'O3.8 no flip when the AI text is identical to the native text',
  canOffer({ nativeText: NATIVE, anuvadini: ready(NATIVE) }),
  false,
);

{
  const englishOfNative = 'Patient name Rahul age thirty four';
  const englishOfAi =
    'Initial case. Patient name is Rahul Sharma. Age is 34 years.';

  const stale = state({
    anuvadini: ready(),
    source: TRANSCRIPT_SOURCE.ANUVADINI,
    translation: {
      text: englishOfNative,
      status: TRANSLATION_STATUS.READY,
      sourceText: NATIVE,
    },
  });

  check(
    'O4.1 the report reads the translation, not the transcript',
    selectReportTranscript(stale),
    englishOfNative,
  );
  check(
    'O4.2 that translation was made from the native text — hence ensureTranslation on flip',
    stale.translation.sourceText,
    NATIVE,
  );

  const refreshed = {
    ...stale,
    translation: {
      text: englishOfAi,
      status: TRANSLATION_STATUS.READY,
      sourceText: AI,
    },
  };
  check(
    'O4.3 after re-translating, the report reads the AI-derived English',
    selectReportTranscript(refreshed),
    englishOfAi,
  );

  const monolingual = state({
    anuvadini: ready(),
    source: TRANSCRIPT_SOURCE.ANUVADINI,
    language: 'en',
  });
  check(
    'O4.4 an English session reports the AI transcript directly',
    selectReportTranscript(monolingual),
    AI,
  );
}

{
  const pending = state({ anuvadini: { text: '', status: ANUVADINI_STATUS.PENDING } });
  check(
    'O5.1 while the AI pass is pending the native text is shown, not a blank sheet',
    selectPreferredTranscript(pending),
    NATIVE,
  );
  check(
    'O5.2 pending is distinguishable from ready',
    pending.anuvadini.status === ANUVADINI_STATUS.READY,
    false,
  );

  const failed = state({ anuvadini: { text: '', status: ANUVADINI_STATUS.FAILED } });
  check(
    'O5.3 a failed AI pass degrades to the native transcript',
    selectPreferredTranscript(failed),
    NATIVE,
  );

  const nothing = state({ native: '', anuvadini: { text: '', status: ANUVADINI_STATUS.FAILED } });
  check(
    'O5.4 with neither transcript the sheet gets an empty string, not a crash',
    selectPreferredTranscript(nothing),
    '',
  );
}

{
  const failedTranslation = state({
    anuvadini: ready(),
    source: TRANSCRIPT_SOURCE.ANUVADINI,
    translation: {
      text: '',
      status: TRANSLATION_STATUS.FAILED,
      sourceText: AI,
    },
  });

  check(
    'O6.1 the report falls back to the original transcript',
    selectReportTranscript(failedTranslation),
    AI,
  );
  check(
    'O6.2 the transcript itself is never lost',
    selectPreferredTranscript(failedTranslation),
    AI,
  );
  check(
    'O6.3 the English selector is honest that it has nothing',
    selectEnglishTranscript(failedTranslation),
    '',
  );
  check(
    'O6.4 the report is flagged as built from the untranslated original',
    selectReportSourceKind(failedTranslation),
    REPORT_SOURCE_KIND.ORIGINAL,
  );

  const pendingTranslation = {
    ...failedTranslation,
    translation: { text: '', status: TRANSLATION_STATUS.PENDING, sourceText: AI },
  };
  check(
    'O6.5 a pending translation is not mistaken for a failed one',
    selectReportSourceKind(pendingTranslation),
    REPORT_SOURCE_KIND.ORIGINAL,
  );
  check(
    'O6.6 and it is not yet ready',
    isTranslationReady(pendingTranslation),
    false,
  );
}

// O7 — the five drawer cases, against selectLiveTranscript
//
// These are the states that hid three HIGH-severity bugs. The audit found that three
// different predicates all claimed to answer "is the AI transcript live?" and
// disagreed here, so an edit could be written to a slice the report does not read and
// be silently discarded after the UI said "Changes saved".
//
// `slice` is what a save must target. Display and write both derive from it.

// Case A — native wrong, AI correct: the drawer must show the AI text.
{
  const drawer = state({ anuvadini: ready() });
  const live = selectLiveTranscript(drawer);
  check('O7.A1 the AI transcription is displayed', live.text, AI);
  check('O7.A2 it is not the native one', live.text === NATIVE, false);
  check('O7.A3 an edit is written to the AI slice', live.slice, TRANSCRIPT_SOURCE.ANUVADINI);
}

// Case B — AI still processing: show something, and do not claim it is the AI text.
{
  const drawer = state({ anuvadini: { text: '', status: ANUVADINI_STATUS.PENDING } });
  const live = selectLiveTranscript(drawer);
  check('O7.B1 the native text stands in while pending', live.text, NATIVE);
  check('O7.B2 the slice is native, so an edit lands where the report reads', live.slice, TRANSCRIPT_SOURCE.NATIVE);
  check('O7.B3 it is not labelled as the AI transcript', live.reason, 'native-only');
}

// Case C — AI succeeded: covered by A, plus the source flip.
{
  const flipped = {
    ...state({ anuvadini: ready() }),
    transcriptSource: TRANSCRIPT_SOURCE.ANUVADINI,
  };
  const live = selectLiveTranscript(flipped);
  check('O7.C1 the AI text is live once selected', live.text, AI);
  check('O7.C2 and stays the save target', live.slice, TRANSCRIPT_SOURCE.ANUVADINI);
  check('O7.C3 report and drawer agree', selectActiveTranscript(flipped), live.text);
}

// Case D — AI failed: fall back honestly, never present native AS the AI transcript.
{
  const failed = state({ anuvadini: { text: '', status: ANUVADINI_STATUS.FAILED } });
  const live = selectLiveTranscript(failed);
  check('O7.D1 the native text is shown', live.text, NATIVE);
  check('O7.D2 the slice is native', live.slice, TRANSCRIPT_SOURCE.NATIVE);
  check('O7.D3 and it is not claimed to be the AI transcript', live.reason, 'native-only');
}

// Case D2 — a LATER pass fails while good AI text is already selected.
//
// markPending and applyResult's failure branch both RETAIN the text. A status-only
// test reverted the drawer to native while transcriptSource was still ANUVADINI — so
// the drawer showed and saved native while the report read stale AI.
{
  const secondPassFailed = {
    ...state({ anuvadini: { text: AI, status: ANUVADINI_STATUS.FAILED } }),
    transcriptSource: TRANSCRIPT_SOURCE.ANUVADINI,
  };
  const live = selectLiveTranscript(secondPassFailed);
  check('O7.D4 the selected AI text stays live through a failed retry', live.text, AI);
  check('O7.D5 the save target still matches the report', live.slice, TRANSCRIPT_SOURCE.ANUVADINI);
  check(
    'O7.D6 drawer and report do not diverge',
    live.text,
    selectActiveTranscript(secondPassFailed),
  );
}

// Case E — the AI returns EXACTLY the native text.
//
// canOffer is false, so transcriptSource stays NATIVE and the report reads the native
// slice. Showing the AI text is right; writing an edit to the AI slice would lose it.
{
  const identical = state({ anuvadini: ready(NATIVE) });
  const live = selectLiveTranscript(identical);
  check('O7.E1 the AI data source is still what is displayed', live.text, NATIVE);
  check(
    'O7.E2 but the edit goes to the slice the report reads',
    live.slice,
    TRANSCRIPT_SOURCE.NATIVE,
  );
  check('O7.E3 and the reason says why', live.reason, 'ai-matches-native');
  check(
    'O7.E4 an edit saved there is what the report gets',
    selectActiveTranscript(identical),
    NATIVE,
  );
}

// O8 — a deliberate choice by the doctor is session state, not component state
{
  const chosenNative = {
    ...state({ anuvadini: ready() }),
    sourceChosen: true,
  };
  check(
    'O8.1 the drawer does not override a deliberate "Original"',
    shouldAutoSelectAi({
      nativeText: selectFullTranscript(chosenNative),
      anuvadini: chosenNative.anuvadini,
      source: chosenNative.transcriptSource,
      chosen: chosenNative.sourceChosen,
    }),
    false,
  );
  check(
    'O8.2 but it does auto-select when nothing was chosen',
    shouldAutoSelectAi({
      nativeText: selectFullTranscript(chosenNative),
      anuvadini: chosenNative.anuvadini,
      source: chosenNative.transcriptSource,
      chosen: false,
    }),
    true,
  );
}

report();
