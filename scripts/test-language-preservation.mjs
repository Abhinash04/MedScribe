globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { DICTATION_LANGUAGES } from '../src/constants/languages.js';
import { TRANSCRIPT_SOURCE } from '../src/services/consultationTranscripts.js';
import { needsTranslation } from '../src/services/consultationTranslation.js';
import { speechLanguageFor } from '../src/services/languageCapabilities.js';
import { normalizeAnuvadiniLanguage } from '../src/services/anuvadini/language.js';
import { voiceFor } from '../src/services/anuvadini/speechContract.js';
import useRecordingStore from '../src/store/useRecordingStore.js';

import { check, report } from './lib/fixture-harness.mjs';

const ENGLISH_REPORT =
  'Initial case. Patient name is Rahul Sharma. Age is 34 years. Gender is male.';

for (const language of DICTATION_LANGUAGES) {
  const code = language.code;
  useRecordingStore.getState().reset();
  useRecordingStore.getState().setSessionLanguage(code);
  useRecordingStore.getState().appendSegment({ text: 'dictated', confidence: 1 });
  useRecordingStore.getState().setAnuvadiniResult({ ok: true, text: 'transcribed' });
  useRecordingStore.getState().setTranscriptSource(TRANSCRIPT_SOURCE.ANUVADINI);
  useRecordingStore
    .getState()
    .setTranslationResult(
      { ok: true, text: ENGLISH_REPORT },
      { sourceText: 'transcribed', sourceKind: TRANSCRIPT_SOURCE.ANUVADINI },
    );

  const after = useRecordingStore.getState();
  check(`L1.1 ${code} survives an English translation`, after.language, code);
  check(
    `L1.2 ${code} TTS is asked for the dictation language, not English`,
    speechLanguageFor(after.language).language,
    code,
  );
  check(
    `L1.3 ${code} the language resolved — it was not guessed`,
    speechLanguageFor(after.language).resolved,
    true,
  );
}

{
  useRecordingStore.getState().reset();
  useRecordingStore.getState().setSessionLanguage('or');
  useRecordingStore.getState().restoreSession({
    id: 'sess_legacy',
    segments: [{ id: 's1', text: 'dictated in Odia', confidence: 1 }],
    language: null,
  });

  const after = useRecordingStore.getState();
  check('L2.1 a legacy row does not erase the live language', after.language, 'or');
  check('L2.2 translation is still known to be needed', needsTranslation(after.language), true);
  check(
    'L2.3 TTS still asks for Odia',
    speechLanguageFor(after.language).language,
    'or',
  );
  check(
    'L2.4 and for the Odia voice',
    voiceFor(normalizeAnuvadiniLanguage(after.language)).voice,
    'or-IN-SubhasiniNeural',
  );
}

{
  const store = useRecordingStore.getState();
  store.reset();
  // L2.5: restored language overrides current language
  useRecordingStore.getState().setSessionLanguage('or');
  useRecordingStore.getState().restoreSession({ id: 'sess_hi', segments: [], language: 'hi' });
  check('L2.5 a restored language overrides the current one', useRecordingStore.getState().language, 'hi');
}

{
  useRecordingStore.getState().reset();
  const resolved = speechLanguageFor(useRecordingStore.getState().language);
  check('L3.1 an unset language falls back to English', resolved.language, 'en');
  check(
    'L3.2 but is explicitly flagged as unresolved so the UI can say so',
    resolved.resolved,
    false,
  );
  check(
    'L3.3 an explicit English session is NOT flagged',
    speechLanguageFor('en').resolved,
    true,
  );
}

{
  const MUTATORS = [
    ['setAnuvadiniPending', store => store.setAnuvadiniPending()],
    ['setAnuvadiniResult', store => store.setAnuvadiniResult({ ok: true, text: 'x' })],
    ['setAnuvadiniText', store => store.setAnuvadiniText('y')],
    ['setTranscriptSource', store => store.setTranscriptSource(TRANSCRIPT_SOURCE.ANUVADINI)],
    ['setTranslationPending', store => store.setTranslationPending({ sourceText: 'x' })],
    [
      'setTranslationResult',
      store => store.setTranslationResult({ ok: true, text: ENGLISH_REPORT }, { sourceText: 'x' }),
    ],
    ['setTranslationText', store => store.setTranslationText('z')],
    ['setStage', store => store.setStage('review')],
    ['setReportDraft', store => store.setReportDraft({})],
    ['setNativeRaw', store => store.setNativeRaw('raw')],
  ];

  for (const [name, mutate] of MUTATORS) {
    useRecordingStore.getState().reset();
    useRecordingStore.getState().setSessionLanguage('ta');
    mutate(useRecordingStore.getState());
    check(`L4.1 ${name} leaves the language alone`, useRecordingStore.getState().language, 'ta');
  }
}

{
  const session = useRecordingStore.getState();
  session.reset();
  // L5: reset clears stale session state for next consultation
  useRecordingStore.getState().setSessionLanguage('or');
  useRecordingStore.getState().appendSegment({ text: 'first consultation', confidence: 1 });

  useRecordingStore.getState().reset();

  check('L5.1 reset clears the stale language', useRecordingStore.getState().language, null);
  check('L5.2 and the stale transcript', useRecordingStore.getState().segments, []);
  check(
    'L5.3 so the next session is free to take the current setting',
    useRecordingStore.getState().language ?? 'hi',
    'hi',
  );
}


for (const language of DICTATION_LANGUAGES) {
  const resolved = speechLanguageFor(language.code);
  const own = voiceFor(normalizeAnuvadiniLanguage(resolved.language));
  const fallback = resolved.fallbackLanguage
    ? voiceFor(normalizeAnuvadiniLanguage(resolved.fallbackLanguage))
    : null;

  check(`L6.1 ${language.code} ends at a voice`, Boolean(own || fallback), true);
  check(
    `L6.2 ${language.code} a language WITH a voice never declares a fallback`,
    language.voice ? resolved.fallbackLanguage === null : true,
    true,
  );
  check(
    `L6.3 ${language.code} a language WITHOUT a voice always declares one`,
    language.voice ? true : Boolean(resolved.fallbackLanguage),
    true,
  );
}

report();
