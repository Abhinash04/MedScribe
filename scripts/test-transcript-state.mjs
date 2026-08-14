import {
  ANUVADINI_STATUS,
  TRANSCRIPT_SOURCE,
  activeText,
  applyResult,
  canOffer,
  editAnuvadini,
  nextPassIndex,
  normalizeAnuvadini,
  emptyAnuvadini,
  markPending,
  shouldAutoSelectAi,
  switchSource,
} from '../src/services/consultationTranscripts.js';
import { summarizeChanges } from '../src/services/transcriptDiff.js';
import { extractPatientFields } from '../src/services/extractionService.js';
import { applyEdit, mergeExtraction, toDraft } from '../src/services/reportDraft.js';
import { ERROR_KIND } from '../src/services/anuvadini/proxyContract.js';

import { check, report } from './lib/fixture-harness.mjs';

const NATIVE =
  'The patient image Nisha Verma she has so thought and should take paracetamol to ice daily';
const REFINED =
  'The patient name is Nisha Verma. She has sore throat and should take Paracetamol twice daily.';

check('T1.1 starts idle', emptyAnuvadini().status, ANUVADINI_STATUS.IDLE);
check('T1.2 pending', markPending(emptyAnuvadini()).status, ANUVADINI_STATUS.PENDING);

const ready = applyResult(markPending(emptyAnuvadini()), { ok: true, text: REFINED }, {
  now: 111,
});
check('T1.3 ready on success', ready.status, ANUVADINI_STATUS.READY);
check('T1.4 text stored', ready.text, REFINED);
check('T1.5 error cleared', ready.error, null);
check('T1.6 timestamped', ready.updatedAt, 111);

const failure = applyResult(markPending(emptyAnuvadini()), {
  ok: false,
  errorKind: ERROR_KIND.TIMEOUT,
});
check('T1.7 failed status', failure.status, ANUVADINI_STATUS.FAILED);
check('T1.8 error kind kept for the retry chip', failure.error, ERROR_KIND.TIMEOUT);

const failedRetry = applyResult(ready, { ok: false, errorKind: ERROR_KIND.NETWORK });
check('T1.9 a failed retry keeps the earlier text', failedRetry.text, REFINED);

check(
  'T2.1 ready and different → offered',
  canOffer({ nativeText: NATIVE, anuvadini: ready }),
  true,
);
check(
  'T2.2 pending → not offered',
  canOffer({ nativeText: NATIVE, anuvadini: markPending(emptyAnuvadini()) }),
  false,
);
check(
  'T2.3 failed → not offered',
  canOffer({ nativeText: NATIVE, anuvadini: failure }),
  false,
);
check(
  'T2.4 identical text is not an alternative',
  canOffer({
    nativeText: REFINED,
    anuvadini: applyResult(emptyAnuvadini(), { ok: true, text: REFINED }),
  }),
  false,
);

check(
  'T3.1 native by default',
  activeText({ nativeText: NATIVE, anuvadini: ready, source: TRANSCRIPT_SOURCE.NATIVE }),
  NATIVE,
);
check(
  'T3.2 anuvadini once selected',
  activeText({ nativeText: NATIVE, anuvadini: ready, source: TRANSCRIPT_SOURCE.ANUVADINI }),
  REFINED,
);
check(
  'T3.3 falls back to native when the alternative is empty',
  activeText({
    nativeText: NATIVE,
    anuvadini: emptyAnuvadini(),
    source: TRANSCRIPT_SOURCE.ANUVADINI,
  }),
  NATIVE,
);

check(
  'T4.1 switch accepted when ready',
  switchSource(
    { nativeText: NATIVE, anuvadini: ready, source: TRANSCRIPT_SOURCE.NATIVE },
    TRANSCRIPT_SOURCE.ANUVADINI,
  ),
  TRANSCRIPT_SOURCE.ANUVADINI,
);
check(
  'T4.2 switch refused when failed',
  switchSource(
    { nativeText: NATIVE, anuvadini: failure, source: TRANSCRIPT_SOURCE.NATIVE },
    TRANSCRIPT_SOURCE.ANUVADINI,
  ),
  TRANSCRIPT_SOURCE.NATIVE,
);
check(
  'T4.3 back to native is always allowed',
  switchSource(
    { nativeText: NATIVE, anuvadini: ready, source: TRANSCRIPT_SOURCE.ANUVADINI },
    TRANSCRIPT_SOURCE.NATIVE,
  ),
  TRANSCRIPT_SOURCE.NATIVE,
);

const nativeDraft = toDraft(extractPatientFields(NATIVE));
check('T5.1 the native mishearing yields no name', nativeDraft.patientName.value, '');
check('T5.2 the native symptom is the misheard one', nativeDraft.symptoms.value, [
  'Thought',
  'Should take paracetamol to ice daily',
]);

const edited = applyEdit(nativeDraft, 'patientName', 'N. Verma');
check('T5.3 the doctor typed a name', edited.patientName.edited, true);

const refinedRecord = extractPatientFields(REFINED);
const switched = mergeExtraction(edited, refinedRecord);

check('T5.4 the manual correction outranks the refined extraction', switched.patientName.value, 'N. Verma');
check('T5.5 it is still flagged as edited', switched.patientName.edited, true);
check('T5.6 an unedited field takes the refined value', switched.symptoms.value, [
  'Sore throat',
  'Should take Paracetamol twice daily',
]);

const unedited = mergeExtraction(nativeDraft, refinedRecord);
check('T5.7 refined name adopted when nothing was typed', unedited.patientName.value, 'Nisha Verma');

const back = mergeExtraction(switched, extractPatientFields(NATIVE));
check('T5.8 the typed name is still the doctor’s', back.patientName.value, 'N. Verma');
check('T5.9 unedited fields follow the active transcript', back.symptoms.value, [
  'Thought',
  'Should take paracetamol to ice daily',
]);

const state = {
  nativeText: NATIVE,
  anuvadini: ready,
  source: TRANSCRIPT_SOURCE.ANUVADINI,
};
const afterRoundTrip = {
  ...state,
  source: switchSource(
    { ...state, source: switchSource(state, TRANSCRIPT_SOURCE.NATIVE) },
    TRANSCRIPT_SOURCE.ANUVADINI,
  ),
};
check('T6.1 native text intact', afterRoundTrip.nativeText, NATIVE);
check('T6.2 refined text intact', afterRoundTrip.anuvadini.text, REFINED);
check('T6.3 back on the refined source', afterRoundTrip.source, TRANSCRIPT_SOURCE.ANUVADINI);

const persisted = JSON.parse(
  JSON.stringify({ anuvadiniTranscript: ready, transcriptSource: TRANSCRIPT_SOURCE.ANUVADINI }),
);
check('T7.1 transcript survives serialization', persisted.anuvadiniTranscript.text, REFINED);
check('T7.2 status survives', persisted.anuvadiniTranscript.status, ANUVADINI_STATUS.READY);
check('T7.3 source survives', persisted.transcriptSource, TRANSCRIPT_SOURCE.ANUVADINI);
check(
  'T7.4 a restored session can still resolve its active text',
  activeText({
    nativeText: NATIVE,
    anuvadini: persisted.anuvadiniTranscript,
    source: persisted.transcriptSource,
  }),
  REFINED,
);

const SOAR = 'Patient has soar throat.';
const CORRECTED = 'Patient has sore throat.';

const pass1 = applyResult(emptyAnuvadini(), { ok: true, text: SOAR });
const editedAi = { ...pass1, text: CORRECTED };

check('T8.1 the draft holds the correction', editedAi.text, CORRECTED);
check('T8.2 the raw baseline is untouched', editedAi.raw, SOAR);
check(
  'T8.3 the comparison is unchanged by the edit',
  summarizeChanges('Patient has soar throat.', editedAi.raw),
  summarizeChanges('Patient has soar throat.', pass1.raw),
);
check(
  'T8.4 the report uses the edited draft',
  activeText({
    nativeText: 'native',
    anuvadini: editedAi,
    source: TRANSCRIPT_SOURCE.ANUVADINI,
  }),
  CORRECTED,
);

const FEVER = 'He also has fever.';

check('T9.0 the next pass follows the last', nextPassIndex(editedAi), 2);

const pass2 = applyResult(markPending(editedAi), { ok: true, text: FEVER }, {
  passIndex: 2,
});

check('T9.3 the draft keeps the correction and gains the new speech', pass2.text, `${CORRECTED}\n${FEVER}`);
check('T9.4 raw accumulates only what the service produced', pass2.raw, `${SOAR}\n${FEVER}`);
check('T9.5 the doctor’s wording never reaches raw', pass2.raw.includes('sore'), false);
check('T9.6 status is ready', pass2.status, ANUVADINI_STATUS.READY);
check('T9.9 both passes are recorded', pass2.passes.map(pass => pass.index), [1, 2]);

const replayed = applyResult(pass2, { ok: true, text: FEVER }, { passIndex: 2 });
check('T9.7 retry of the same pass is idempotent', replayed.text, `${CORRECTED}\n${FEVER}`);
check('T9.8 idempotent for raw too', replayed.raw, `${SOAR}\n${FEVER}`);
check('T9.10 and adds no extra pass', replayed.passes.length, 2);
const unnumbered = applyResult(pass2, { ok: true, text: 'Third thing.' });
check('T9.11 an unnumbered result appends', unnumbered.text, `${CORRECTED}\n${FEVER}\nThird thing.`);
check('T9.12 and never drops what came before', unnumbered.raw.includes(SOAR), true);
check('T9.13 landing as the next pass', unnumbered.passes.map(pass => pass.index), [1, 2, 3]);

const failedContinuation = applyResult(markPending(pass2), {
  ok: false,
  errorKind: ERROR_KIND.TIMEOUT,
}, { passIndex: 3 });

check('T10.1 the draft survives', failedContinuation.text, pass2.text);
check('T10.2 the raw baseline survives', failedContinuation.raw, pass2.raw);
check('T10.3 status reports the failure', failedContinuation.status, ANUVADINI_STATUS.FAILED);
check('T10.4 the error kind is kept for Retry', failedContinuation.error, ERROR_KIND.TIMEOUT);

const RAW_1 = 'Patient has soar throat.';
const EDIT_1 = 'Patient has sore throat.';
const RAW_2 = 'He also has fever.';
const RAW_3 = 'History of asthma.';

let sequence = applyResult(emptyAnuvadini(), { ok: true, text: RAW_1 });
sequence = { ...sequence, text: EDIT_1 };

sequence = applyResult(markPending(sequence), { ok: false, errorKind: ERROR_KIND.NETWORK }, {
  passIndex: 2,
});
check('T11.1 the failure left the edit alone', sequence.text, EDIT_1);

sequence = applyResult(markPending(sequence), { ok: true, text: RAW_2 }, {
  passIndex: 2,
});

sequence = applyResult(markPending(sequence), { ok: true, text: RAW_3 }, {
  passIndex: 3,
});

check('T11.2 final draft', sequence.text, `${EDIT_1}\n${RAW_2}\n${RAW_3}`);
check('T11.3 final raw', sequence.raw, `${RAW_1}\n${RAW_2}\n${RAW_3}`);
check('T11.4 the manual correction survived every pass', sequence.text.includes('sore throat'), true);
check('T11.5 raw still shows what the service actually heard', sequence.raw.includes('soar throat'), true);

for (const [label, chunk] of [
  ['pass 2', RAW_2],
  ['pass 3', RAW_3],
]) {
  check(
    `T11.6 ${label} appears exactly once in the draft`,
    sequence.text.split(chunk).length - 1,
    1,
  );
  check(
    `T11.7 ${label} appears exactly once in raw`,
    sequence.raw.split(chunk).length - 1,
    1,
  );
}

const whileNative = {
  nativeText: 'native transcript',
  anuvadini: sequence,
  source: TRANSCRIPT_SOURCE.NATIVE,
};
check(
  'T12.1 the AI draft still accumulated',
  whileNative.anuvadini.text.includes(RAW_3),
  true,
);
check(
  'T12.2 the selected source is unchanged',
  switchSource(whileNative, TRANSCRIPT_SOURCE.NATIVE),
  TRANSCRIPT_SOURCE.NATIVE,
);
check(
  'T12.3 the report still reads the native transcript',
  activeText(whileNative),
  'native transcript',
);

const passOne = { path: '/consultations/sess_abc-1.wav', bytes: 320044 };
const passTwo = { path: '/consultations/sess_abc-2.wav', bytes: 160044 };

check('T13.1 passes write to different recordings', passOne.path === passTwo.path, false);

const draftAfterOne = applyResult(emptyAnuvadini(), { ok: true, text: 'Pass one text.' });
const editedAfterOne = { ...draftAfterOne, text: 'Pass one corrected.' };

const failedTwo = applyResult(markPending(editedAfterOne), {
  ok: false,
  errorKind: ERROR_KIND.NETWORK,
}, { passIndex: 2 });

check('T13.2 the failure keeps the earlier correction', failedTwo.text, 'Pass one corrected.');
check('T13.3 and the earlier raw', failedTwo.raw, 'Pass one text.');

const retried = applyResult(markPending(failedTwo), { ok: true, text: 'Pass two text.' }, {
  passIndex: 2,
});
check('T13.4 retry appends the second pass once', retried.text, 'Pass one corrected.\nPass two text.');
check('T13.5 raw carries both service outputs', retried.raw, 'Pass one text.\nPass two text.');
check(
  'T13.6 retrying again does not duplicate',
  applyResult(retried, { ok: true, text: 'Pass two text.' }, { passIndex: 2 }).text,
  'Pass one corrected.\nPass two text.',
);

let many = applyResult(emptyAnuvadini(), { ok: true, text: 'One.' }, { passIndex: 1 });
for (const [index, text] of [[2, 'Two.'], [3, 'Three.'], [4, 'Four.']]) {
  many = applyResult(markPending(many), { ok: true, text }, { passIndex: index });
}

check('T14.1 every pass is present in order', many.raw, 'One.\nTwo.\nThree.\nFour.');
check('T14.2 and in the draft', many.text, 'One.\nTwo.\nThree.\nFour.');
check('T14.3 four passes recorded', many.passes.map(pass => pass.index), [1, 2, 3, 4]);
for (const text of ['One.', 'Two.', 'Three.', 'Four.']) {
  check(`T14.4 "${text}" appears exactly once`, many.raw.split(text).length - 1, 1);
}

{
  const replaced = applyResult(many, { ok: true, text: 'TWO-FIXED.' }, { passIndex: 2 });
  check('T14.5 the replaced pass reaches raw', replaced.raw, 'One.\nTWO-FIXED.\nThree.\nFour.');
  check('T14.6 and the draft does not diverge from it', replaced.text, replaced.raw);
  for (const text of ['One.', 'TWO-FIXED.', 'Three.', 'Four.']) {
    check(`T14.7 "${text}" appears exactly once`, replaced.text.split(text).length - 1, 1);
  }
  check('T14.8 the superseded text is gone', replaced.text.includes('Two.'), false);
}

const legacy = normalizeAnuvadini({
  text: 'Edited pass one.',
  raw: 'Pass one text.',
  status: ANUVADINI_STATUS.READY,
  error: null,
  updatedAt: 1,
});
check('T14.5 legacy state reads as one completed pass', legacy.passes, [
  { index: 1, text: 'Pass one text.' },
]);
check('T14.6 its edited draft is untouched', legacy.text, 'Edited pass one.');

const legacyContinued = applyResult(markPending(legacy), { ok: true, text: 'Pass two text.' });
check(
  'T14.7 a continuation on legacy state appends rather than replacing',
  legacyContinued.text,
  'Edited pass one.\nPass two text.',
);
check('T14.8 and raw carries both', legacyContinued.raw, 'Pass one text.\nPass two text.');

check('T14.9 empty state has no passes', normalizeAnuvadini(null).passes, []);
check('T14.10 and reports pass one next', nextPassIndex(null), 1);

{
  const NATIVE_TEXT = 'Patient has fever and caugh.';
  const refined = applyResult(emptyAnuvadini(), {
    ok: true,
    text: 'Patient has fever and cough.',
  });
  const base = { nativeText: NATIVE_TEXT, anuvadini: refined, source: TRANSCRIPT_SOURCE.NATIVE };

  check('T15.1 a ready, different transcript is taken automatically',
    shouldAutoSelectAi({ ...base, chosen: false }), true);

  check('T15.2 never while it is still being generated',
    shouldAutoSelectAi({ ...base, anuvadini: markPending(emptyAnuvadini()), chosen: false }), false);

  check('T15.3 never after a failure',
    shouldAutoSelectAi({
      ...base,
      anuvadini: applyResult(markPending(emptyAnuvadini()), { ok: false, errorKind: ERROR_KIND.NETWORK }),
      chosen: false,
    }), false);

  check('T15.4 never when the refinement is empty',
    shouldAutoSelectAi({ ...base, anuvadini: emptyAnuvadini(), chosen: false }), false);

  check('T15.5 never when it says the same as the recognizer',
    shouldAutoSelectAi({
      ...base,
      anuvadini: applyResult(emptyAnuvadini(), { ok: true, text: NATIVE_TEXT }),
      chosen: false,
    }), false);

  check('T15.6 never once the doctor has chosen',
    shouldAutoSelectAi({ ...base, chosen: true }), false);

  check('T15.7 including when they chose to stay on the original',
    shouldAutoSelectAi({ ...base, chosen: true, source: TRANSCRIPT_SOURCE.NATIVE }), false);

  check('T15.8 does not fire again once AI is already active',
    shouldAutoSelectAi({ ...base, source: TRANSCRIPT_SOURCE.ANUVADINI, chosen: false }), false);

  const continued = applyResult(markPending(refined), { ok: true, text: 'And a headache.' }, { passIndex: 2 });
  check('T15.9 a later pass cannot override an explicit choice',
    shouldAutoSelectAi({ nativeText: NATIVE_TEXT, anuvadini: continued, source: TRANSCRIPT_SOURCE.NATIVE, chosen: true }),
    false);
  check('T15.10 but still applies if nothing was ever chosen',
    shouldAutoSelectAi({ nativeText: NATIVE_TEXT, anuvadini: continued, source: TRANSCRIPT_SOURCE.NATIVE, chosen: false }),
    true);
}

{
  const failed = applyResult(markPending(emptyAnuvadini()), {
    ok: false,
    errorKind: ERROR_KIND.NO_AUDIO,
  });
  check('T16.1 the failed pass leaves nothing to offer', failed.text, '');

  const recovered = applyResult(markPending(failed), { ok: true, text: REFINED });
  check('T16.2 a successful retry fills the text', recovered.text, REFINED);
  check('T16.3 and the untouched baseline', recovered.raw, REFINED);
  check('T16.4 the failure is cleared', recovered.error, null);

  check(
    'T16.5 the recovered pass is offerable',
    canOffer({ nativeText: NATIVE, anuvadini: recovered }, TRANSCRIPT_SOURCE.ANUVADINI),
    true,
  );
  check(
    'T16.6 auto-select fires on the recovered pass',
    shouldAutoSelectAi({
      nativeText: NATIVE,
      anuvadini: recovered,
      source: TRANSCRIPT_SOURCE.NATIVE,
      chosen: false,
    }),
    true,
  );

  check(
    'T16.7 an emptied transcript cannot be offered',
    canOffer(
      { nativeText: NATIVE, anuvadini: { ...recovered, text: '' } },
      TRANSCRIPT_SOURCE.ANUVADINI,
    ),
    false,
  );
}

const firstPass = applyResult(
  markPending(emptyAnuvadini()),
  { ok: true, text: 'patient has fevr' },
  { passIndex: 1 },
);
const corrected = editAnuvadini(firstPass, 'patient has fever');

check('E1.1 an edit is recorded', corrected.edited, true);
check('E1.2 and keeps the correction', corrected.text, 'patient has fever');
check(
  'E1.3 a late result for the same pass must not overwrite the correction',
  applyResult(corrected, { ok: true, text: 'patient has fevr' }, { passIndex: 1 })
    .text,
  'patient has fever',
);
check(
  'E1.4 and the edit flag survives it',
  applyResult(corrected, { ok: true, text: 'patient has fevr' }, { passIndex: 1 })
    .edited,
  true,
);
check(
  'E1.5 but the raw AI text is still recorded underneath',
  applyResult(corrected, { ok: true, text: 'patient has fevr' }, { passIndex: 1 })
    .raw,
  'patient has fevr',
);

const appended = applyResult(
  corrected,
  { ok: true, text: 'and a cough' },
  { passIndex: 2 },
);
check(
  'E2.1 more dictation appends to the corrected text, not the raw text',
  appended.text.startsWith('patient has fever'),
  true,
);
check('E2.2 and includes the new pass', appended.text.includes('and a cough'), true);
check('E2.3 the transcript is still marked edited', appended.edited, true);

const failedAfterEdit = applyResult(corrected, {
  ok: false,
  errorKind: ERROR_KIND.NETWORK,
});
check(
  'E3.1 a failure leaves the corrected text alone',
  failedAfterEdit.text,
  'patient has fever',
);
check(
  'E3.2 retrying a failed refinement does take the new text',
  applyResult(failedAfterEdit, { ok: true, text: 'patient has a fever' }, {
    passIndex: 1,
  }).text,
  'patient has a fever',
);

check(
  'E4.1 an untouched transcript is not marked edited',
  firstPass.edited,
  false,
);
check(
  'E4.2 and is replaced normally by a same-pass result',
  applyResult(firstPass, { ok: true, text: 'patient has a fever' }, { passIndex: 1 })
    .text,
  'patient has a fever',
);

report();
