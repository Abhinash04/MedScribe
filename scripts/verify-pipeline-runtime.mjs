globalThis.fetch = () => {
  throw new Error('verify-pipeline-runtime must not perform network calls');
};

import { DICTATION_LANGUAGES, displayFor } from '../src/constants/languages.js';
import { PATIENT_FIELDS } from '../src/constants/patientFields.js';
import { missingFieldPrompt } from '../src/services/missingFieldPrompt.js';
import { normalizeAnuvadiniLanguage } from '../src/services/anuvadini/language.js';
import { voiceFor } from '../src/services/anuvadini/speechContract.js';
import {
  ANUVADINI_STATUS,
  TRANSCRIPT_SOURCE,
} from '../src/services/consultationTranscripts.js';
import { TRANSLATION_STATUS } from '../src/services/consultationTranslation.js';
import { extractForReport } from '../src/services/extractionService.js';
import { speechLanguageFor } from '../src/services/languageCapabilities.js';
import {
  blockingFields,
  validateReportCompleteness,
} from '../src/services/reportCompleteness.js';
import { buildReportDocument } from '../src/services/reportDocument.js';
import { toDraft } from '../src/services/reportDraft.js';
import { speakMissingFields } from '../src/services/speechPromptService.js';
import useRecordingStore, {
  selectFullTranscript,
  selectPreferredTranscript,
  selectReportTranscript,
} from '../src/store/useRecordingStore.js';

import { check, report } from './lib/fixture-harness.mjs';

const TOKEN = 'runtime-token';
const URL = 'https://example.invalid/text-to-speech';
const ENGLISH = [
  'Initial case. Patient name is Rahul Sharma. Age is 34 years. Gender is male.',
  'Weight is 70 kg. The patient developed fever, itching and skin rash after the',
  'suspected drug. The suspected drug was stopped and antihistamines were given.',
].join(' ');

const NATIVE_GARBLE = 'rogi naam rahul';
const AI_TRANSCRIPT = 'ପ୍ରାରମ୍ଭିକ ମାମଲା। ରୋଗୀଙ୍କ ନାମ ରାହୁଲ ଶର୍ମା। ବୟସ ୩୪ ବର୍ଷ।';

const recorder = () => {
  const calls = [];
  return {
    calls,
    transport: async ({ body }) => {
      calls.push(body);
      return { status: 200, body: { audio: 'QUJDRA==' } };
    },
  };
};

const VOICED = DICTATION_LANGUAGES.filter(language => language.voice);

for (const language of VOICED) {
  const code = language.code;
  const aiTranscript = code === 'en' ? ENGLISH : AI_TRANSCRIPT;
  const store = useRecordingStore.getState();
  store.reset();

  useRecordingStore.getState().setSessionLanguage(code);
  check(`V1.1 ${code} the session remembers the dictation language`, useRecordingStore.getState().language, code);
  useRecordingStore.getState().appendSegment({ text: NATIVE_GARBLE, confidence: 0.4 });
  check(
    `V1.2 ${code} the native transcript is present`,
    selectFullTranscript(useRecordingStore.getState()),
    NATIVE_GARBLE,
  );
  useRecordingStore.getState().setAnuvadiniResult({ ok: true, text: aiTranscript });
  check(
    `V1.3 ${code} the AI transcript is what a review surface shows`,
    selectPreferredTranscript(useRecordingStore.getState()),
    aiTranscript,
  );
  check(
    `V1.4 ${code} and it is not the native one`,
    selectPreferredTranscript(useRecordingStore.getState()) === NATIVE_GARBLE,
    false,
  );
  check(
    `V1.5 ${code} the session language is untouched by the AI pass`,
    useRecordingStore.getState().language,
    code,
  );
  useRecordingStore.getState().setTranscriptSource(TRANSCRIPT_SOURCE.ANUVADINI);
  useRecordingStore
    .getState()
    .setTranslationResult({ ok: true, text: ENGLISH }, { sourceText: aiTranscript, sourceKind: TRANSCRIPT_SOURCE.ANUVADINI });

  check(
    `V1.6 ${code} translation does not overwrite the dictation language`,
    useRecordingStore.getState().language,
    code,
  );
  const reportText = selectReportTranscript(useRecordingStore.getState());
  check(
    `V1.7 ${code} the report is built from the English translation`,
    reportText === ENGLISH || code === 'en',
    true,
  );

  const { record, residue } = extractForReport(reportText);
  const draft = toDraft(record, residue);
  const completeness = validateReportCompleteness(draft);
  const doc = buildReportDocument(draft, { now: 0 });

  check(`V1.8 ${code} the ADR template is produced`, doc.template, 'IPC_ADR_V1_4');
  check(
    `V1.9 ${code} the report content is English, whatever was dictated`,
    /[^ -~]/u.test(String(doc.sectionA?.patientInitials ?? '')),
    false,
  );
  check(
    `V1.10 ${code} the missing start date blocks the report`,
    blockingFields(completeness).map(field => field.key),
    ['reactionStartDate'],
  );
  const { calls, transport } = recorder();
  const resolved = speechLanguageFor(useRecordingStore.getState().language);
  await speakMissingFields(blockingFields(completeness), {
    ...resolved,
    token: TOKEN,
    url: URL,
    transport,
  });

  check(`V1.11 ${code} exactly one synthesis request`, calls.length, 1);
  check(`V1.12 ${code} it carries the dictation locale`, calls[0].lang, language.tag);
  check(`V1.13 ${code} and the dictation voice`, calls[0].languageVoice, language.voice);
  check(
    `V1.14 ${code} the spoken words are in the dictation language, not English`,
    calls[0].text,
    missingFieldPrompt(blockingFields(completeness), code),
  );
  if (code !== 'en') {
    check(
      `V1.15 ${code} the English report did not drag the voice to English`,
      calls[0].languageVoice === 'en-IN-PrabhatNeural',
      false,
    );
  }
}

{
  const store = useRecordingStore.getState();

  store.reset();
  useRecordingStore.getState().setSessionLanguage('or');
  useRecordingStore.getState().appendSegment({ text: NATIVE_GARBLE, confidence: 0.4 });

  check(
    'V2.1 before the AI pass the sheet shows the native text rather than nothing',
    selectPreferredTranscript(useRecordingStore.getState()),
    NATIVE_GARBLE,
  );

  useRecordingStore.getState().setAnuvadiniPending();
  check(
    'V2.2 while pending it still shows something',
    selectPreferredTranscript(useRecordingStore.getState()),
    NATIVE_GARBLE,
  );
  check(
    'V2.3 and the pending state is visible to the UI',
    useRecordingStore.getState().anuvadini.status,
    ANUVADINI_STATUS.PENDING,
  );

  useRecordingStore.getState().setAnuvadiniResult({ ok: false, errorKind: 'network' });
  check(
    'V2.4 a failed AI pass degrades to the native transcript',
    selectPreferredTranscript(useRecordingStore.getState()),
    NATIVE_GARBLE,
  );
  check(
    'V2.5 and the failure is visible to the UI',
    useRecordingStore.getState().anuvadini.status,
    ANUVADINI_STATUS.FAILED,
  );

  useRecordingStore.getState().setAnuvadiniResult({ ok: true, text: AI_TRANSCRIPT });
  check(
    'V2.6 once it lands the AI text takes over',
    selectPreferredTranscript(useRecordingStore.getState()),
    AI_TRANSCRIPT,
  );
}

{
  const session = useRecordingStore.getState();
  session.reset();
  useRecordingStore.getState().setSessionLanguage('ur');
  useRecordingStore.getState().appendSegment({ text: NATIVE_GARBLE, confidence: 0.4 });
  useRecordingStore.getState().setAnuvadiniResult({ ok: true, text: AI_TRANSCRIPT });
  useRecordingStore.getState().setTranscriptSource(TRANSCRIPT_SOURCE.ANUVADINI);
  useRecordingStore
    .getState()
    .setTranslationResult(
      { ok: false, errorKind: 'unsupported_language' },
      { sourceText: AI_TRANSCRIPT, sourceKind: TRANSCRIPT_SOURCE.ANUVADINI },
    );

  check(
    'V3.1 the translation is marked failed',
    useRecordingStore.getState().translation.status,
    TRANSLATION_STATUS.FAILED,
  );
  check(
    'V3.2 the AI transcript is still there',
    selectPreferredTranscript(useRecordingStore.getState()),
    AI_TRANSCRIPT,
  );
  check(
    'V3.3 the report falls back to it rather than being empty',
    selectReportTranscript(useRecordingStore.getState()),
    AI_TRANSCRIPT,
  );
  check(
    'V3.4 and the dictation language is still intact for the spoken reply',
    useRecordingStore.getState().language,
    'ur',
  );
}

{
  const fields = PATIENT_FIELDS.slice(0, 2).map(field => ({ key: field.key, label: field.label }));
  for (const code of ['or', 'hi', 'ta', 'ml']) {
    const spoken = missingFieldPrompt(fields, code);
    check(`V4.1 ${code} produces a prompt`, spoken.length > 0, true);
    check(
      `V4.2 ${code} the prompt is not English`,
      spoken === missingFieldPrompt(fields, 'en'),
      false,
    );
    check(
      `V4.3 ${code} the voice matches the words`,
      Boolean(voiceFor(normalizeAnuvadiniLanguage(code))),
      true,
    );
    check(`V4.4 ${code} is a known language`, displayFor(code).code, code);
  }
}

report();
