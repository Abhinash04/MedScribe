globalThis.fetch = () => {
  throw new Error('test-tts-language must not perform real network calls');
};

import {
  DICTATION_LANGUAGES,
  LANGUAGE_BY_CODE,
} from '../src/constants/languages.js';
import { PATIENT_FIELDS } from '../src/constants/patientFields.js';
import { catalogFor, hasCatalog } from '../src/constants/prompts/index.js';
import {
  DEVANAGARI_VOICE_FALLBACK,
  speechLanguageFor,
} from '../src/services/languageCapabilities.js';
import { normalizeAnuvadiniLanguage } from '../src/services/anuvadini/language.js';
import { ERROR_KIND } from '../src/services/anuvadini/proxyContract.js';
import {
  buildDirectSpeechRequestBody,
  voiceFor,
} from '../src/services/anuvadini/speechContract.js';
import { extractForReport } from '../src/services/extractionService.js';
import { missingFieldPrompt } from '../src/services/missingFieldPrompt.js';
import {
  blockingFields,
  validateReportCompleteness,
} from '../src/services/reportCompleteness.js';
import { toDraft } from '../src/services/reportDraft.js';
import { speakMissingFields } from '../src/services/speechPromptService.js';

import { check, report } from './lib/fixture-harness.mjs';

const TOKEN = 'test-token';
const URL = 'https://example.invalid/text-to-speech';
const AUDIO = 'QUJDRA==';

const field = key => {
  const found = PATIENT_FIELDS.find(item => item.key === key);
  return { key: found.key, label: found.label };
};
const THREE = ['patientName', 'age', 'pinCode'].map(field);

function recorder({ failFirstWith = null } = {}) {
  const calls = [];
  const transport = async ({ body }) => {
    calls.push(body);
    if (failFirstWith && calls.length === 1) {
      return { status: failFirstWith, body: null };
    }
    return { status: 200, body: { audio: AUDIO } };
  };
  return { calls, transport };
}

const speak = (fields, options) =>
  speakMissingFields(fields, { token: TOKEN, url: URL, ...options });

const VOICED = DICTATION_LANGUAGES.filter(language => language.voice);
const VOICELESS = DICTATION_LANGUAGES.filter(language => !language.voice);

check('T1.1 fourteen languages carry a voice', VOICED.length, 14);
check('T1.2 ten languages carry none', VOICELESS.length, 10);

for (const language of VOICED) {
  check(
    `T1.3 ${language.code} speaks in its own language with no fallback`,
    speechLanguageFor(language.code),
    { language: language.code, fallbackLanguage: null, resolved: true },
  );
}

for (const language of VOICELESS) {
  const expected =
    language.script === 'devanagari' ? DEVANAGARI_VOICE_FALLBACK : 'en';
  check(
    `T1.4 ${language.code} (${language.script}) falls back to ${expected}`,
    speechLanguageFor(language.code),
    { language: language.code, fallbackLanguage: expected, resolved: true },
  );
}

// resolved:false is the whole point — English-because-unknown must be distinguishable
// from English-because-chosen, or a lost language speaks English and reports success.
check('T1.5 an unknown code resolves to English', speechLanguageFor('zz'), {
  language: 'en',
  fallbackLanguage: null,
  resolved: false,
});
check('T1.6 a null code resolves to English', speechLanguageFor(null), {
  language: 'en',
  fallbackLanguage: null,
  resolved: false,
});
check(
  'T1.6b a known language is marked resolved, an unknown one is not',
  [speechLanguageFor('or').resolved, speechLanguageFor(null).resolved],
  [true, false],
);
check(
  'T1.7 every fallback target has a voice of its own — no dead ends',
  VOICELESS.map(language => speechLanguageFor(language.code).fallbackLanguage)
    .filter(code => !LANGUAGE_BY_CODE[code]?.voice),
  [],
);
check(
  'T1.8 every fallback target has a catalog of its own',
  VOICELESS.map(language => speechLanguageFor(language.code).fallbackLanguage)
    .filter(code => !hasCatalog(code)),
  [],
);

for (const language of VOICED) {
  const normalized = normalizeAnuvadiniLanguage(language.code);
  check(`T2.1 ${language.code} normalizes to ${language.tag}`, normalized, language.tag);
  check(
    `T2.2 ${language.code} resolves to ${language.voice}`,
    voiceFor(normalized),
    { voice: language.voice, gender: language.gender },
  );
  check(
    `T2.3 ${language.code} request body carries its own voice`,
    buildDirectSpeechRequestBody('x', normalized, voiceFor(normalized)),
    {
      text: 'x',
      lang: language.tag,
      languageVoice: language.voice,
      gender: language.gender,
    },
  );
}

for (const language of VOICELESS) {
  check(
    `T2.4 ${language.code} has no voice to resolve`,
    voiceFor(normalizeAnuvadiniLanguage(language.code)),
    null,
  );
}

{
  const { calls, transport } = recorder();
  const outcome = await speak(THREE, { ...speechLanguageFor('en'), transport });

  check('T3.1 English synthesises once', calls.length, 1);
  check('T3.2 English sends en-IN', calls[0].lang, 'en-IN');
  check('T3.3 English uses the English voice', calls[0].languageVoice, 'en-IN-PrabhatNeural');
  check('T3.4 English speaks the English sentence', calls[0].text, missingFieldPrompt(THREE, 'en'));
  check('T3.5 English runs the full service', outcome.reason, 'playback_failed');
}

{
  const { calls, transport } = recorder();
  await speak(THREE, { ...speechLanguageFor('or'), transport });

  check('T4.1 Odia synthesises once — no English retry', calls.length, 1);
  check('T4.2 Odia sends or-IN, not en-IN', calls[0].lang, 'or-IN');
  check('T4.3 Odia uses the Odia voice', calls[0].languageVoice, 'or-IN-SubhasiniNeural');
  check('T4.4 Odia speaks the Odia sentence', calls[0].text, missingFieldPrompt(THREE, 'or'));
  check('T4.5 the Odia sentence is not the English one', calls[0].text === missingFieldPrompt(THREE, 'en'), false);
  check('T4.6 no Latin word survives into the Odia utterance', /[A-Za-z]{4,}/.test(calls[0].text), false);
}

for (const language of VOICED) {
  const { calls, transport } = recorder();
  await speak(THREE, { ...speechLanguageFor(language.code), transport });

  check(`T5.1 ${language.code} synthesises exactly once`, calls.length, 1);
  check(`T5.2 ${language.code} sends its own tag`, calls[0].lang, language.tag);
  check(`T5.3 ${language.code} sends its own voice`, calls[0].languageVoice, language.voice);
  check(
    `T5.4 ${language.code} speaks its own catalog text`,
    calls[0].text,
    missingFieldPrompt(THREE, language.code),
  );
  if (language.script !== 'latin') {
    check(
      `T5.5 ${language.code} never speaks the English sentence`,
      calls[0].text === missingFieldPrompt(THREE, 'en'),
      false,
    );
  }
}

for (const language of VOICELESS) {
  const resolved = speechLanguageFor(language.code);
  const { calls, transport } = recorder();
  await speak(THREE, { ...resolved, transport });

  const fallbackTag = LANGUAGE_BY_CODE[resolved.fallbackLanguage].tag;
  const fallbackVoice = LANGUAGE_BY_CODE[resolved.fallbackLanguage].voice;

  check(`T6.1 ${language.code} reaches the wire exactly once`, calls.length, 1);
  check(`T6.2 ${language.code} retry sends ${fallbackTag}`, calls[0].lang, fallbackTag);
  check(`T6.3 ${language.code} retry uses ${fallbackVoice}`, calls[0].languageVoice, fallbackVoice);
  check(
    `T6.4 ${language.code} retry speaks the ${resolved.fallbackLanguage} catalog, not English words in a foreign voice`,
    calls[0].text,
    missingFieldPrompt(THREE, resolved.fallbackLanguage),
  );
}

{
  const resolved = speechLanguageFor('mai');
  const outcome = await speak(THREE, {
    language: resolved.language,
    fallbackLanguage: null,
    transport: recorder().transport,
  });
  check('T6.5 a voice-less language with no fallback reports why', outcome, {
    spoken: false,
    reason: ERROR_KIND.UNSUPPORTED_LANGUAGE,
  });
}

{
  const ENGLISH_TRANSLATION =
    'Initial case. Patient name is Rahul Sharma. Age is 34 years. Gender is ' +
    'male. Weight is 70 kilograms. The patient developed fever, generalized ' +
    'itching, and skin rash after taking the suspected medicine. The ' +
    'suspected medication was stopped and patient was treated with ' +
    'antihistamine. Symptoms improved after treatment.';

  const { record, residue } = extractForReport(ENGLISH_TRANSLATION);
  const draft = toDraft(record, residue);
  const completeness = validateReportCompleteness(draft);
  const missing = blockingFields(completeness);

  check(
    'T7.1 the reaction start date is what blocks the report',
    missing.map(item => item.key),
    ['reactionStartDate'],
  );

  const { calls, transport } = recorder();
  await speak(missing, { ...speechLanguageFor('or'), transport });

  check('T7.2 the utterance is still Odia', calls[0].lang, 'or-IN');
  check('T7.3 the voice is still Odia', calls[0].languageVoice, 'or-IN-SubhasiniNeural');
  check(
    'T7.4 the field name is spoken in Odia, not English',
    calls[0].text.includes(catalogFor('or').labels.reactionStartDate),
    true,
  );
  check(
    'T7.5 the English field label never reaches the utterance',
    calls[0].text.toLowerCase().includes('reaction start date'),
    false,
  );
  check(
    'T7.6 no English value from the report leaks into the utterance',
    ['Rahul', 'Sharma', 'antihistamine', 'kilograms'].filter(word =>
      calls[0].text.includes(word),
    ),
    [],
  );

  const hindi = recorder();
  await speak(missing, { ...speechLanguageFor('hi'), transport: hindi.transport });
  check('T7.7 the same English report speaks Hindi for a Hindi session', hindi.calls[0].lang, 'hi-IN');
  check('T7.8 with the Hindi voice', hindi.calls[0].languageVoice, 'hi-IN-SwaraNeural');
}

{
  const { calls, transport } = recorder();
  await speakMissingFields(THREE, { token: TOKEN, url: URL, transport });
  check('T8.1 no options still defaults to English', calls[0].lang, 'en-IN');
  check('T8.2 and the English voice', calls[0].languageVoice, 'en-IN-PrabhatNeural');
}

{
  const { calls, transport } = recorder();
  const outcome = await speak([], { ...speechLanguageFor('or'), transport });
  check('T8.3 nothing missing means nothing spoken', outcome, {
    spoken: false,
    reason: 'nothing_missing',
  });
  check('T8.4 and no request is made', calls.length, 0);
}

{
  const { transport } = recorder({ failFirstWith: 500 });
  const outcome = await speak(THREE, { ...speechLanguageFor('or'), transport });
  check('T8.5 an upstream failure is reported, not thrown', outcome, {
    spoken: false,
    reason: ERROR_KIND.SERVER_ERROR,
  });
}

for (const missing of [null, undefined, '', '   ', 'zz', 'en-US-x-private']) {
  const label = JSON.stringify(missing);
  const resolved = speechLanguageFor(missing);
  const { calls, transport } = recorder();

  check(`T9.1 ${label} still resolves a language`, Boolean(resolved.language), true);

  const outcome = await speak(THREE, { ...resolved, transport });
  check(`T9.2 ${label} still reaches the wire`, calls.length, 1);
  check(`T9.3 ${label} falls back to the English voice`, calls[0].languageVoice, 'en-IN-PrabhatNeural');
  check(`T9.4 ${label} speaks real words`, calls[0].text.length > 0, true);
  check(`T9.5 ${label} does not report an unsupported language`, outcome.reason, 'playback_failed');
}

for (const language of VOICED) {
  const { calls, transport } = recorder();
  await speak(THREE, { ...speechLanguageFor(language.code), transport });

  const spokeOwnLanguage = calls[0].lang === language.tag;
  const usedOwnVoice = calls[0].languageVoice === language.voice;
  const wordsMatchVoice =
    calls[0].text === missingFieldPrompt(THREE, language.code);

  check(
    `T10.1 ${language.code}: dictation language survives to the spoken reply`,
    { spokeOwnLanguage, usedOwnVoice, wordsMatchVoice },
    { spokeOwnLanguage: true, usedOwnVoice: true, wordsMatchVoice: true },
  );
}


// T11 — which application states speak, and what words they use
//
// The app has exactly one spoken output: the missing-field prompt, reached from
// "Generate report" when the report is blocked, and from "Read aloud again". There is
// no spoken success, no spoken completion, no spoken confirmation. These assertions
// pin that down per state, so that adding a second spoken surface later is a
// deliberate change rather than an accident.

{
  // Success / complete report. Nothing is spoken, and nothing is sent.
  const complete = extractForReport(
    'Patient Rahul Sharma, 34 years, male, 70 kg. He developed fever and rash. ' +
      'The reaction began on 3 August 2026 and stopped on 9 August 2026. ' +
      'The suspected drug was stopped. Initial case.',
  );
  const completeness = validateReportCompleteness(
    toDraft(complete.record, complete.residue),
  );
  const { calls, transport } = recorder();
  const outcome = await speak(blockingFields(completeness), {
    ...speechLanguageFor('or'),
    transport,
  });

  check('T11.1 a complete ADR report speaks nothing', outcome.spoken, false);
  check('T11.2 and reaches no service', calls.length, 0);
}

{
  // Validation error. An invalid field is spoken exactly like a missing one — the
  // doctor is told which field needs attention, in their own language.
  const invalidOnly = {
    missingFields: [],
    invalidFields: [field('age')],
    isComplete: false,
  };
  const { calls, transport } = recorder();
  await speak(blockingFields(invalidOnly), { ...speechLanguageFor('or'), transport });

  check('T11.3 an invalid field is spoken, not silently skipped', calls.length, 1);
  check(
    'T11.4 in the dictated language',
    calls[0].text,
    missingFieldPrompt([field('age')], 'or'),
  );
  check('T11.5 with the dictated voice', calls[0].languageVoice, LANGUAGE_BY_CODE.or.voice);
}

{
  // Missing and invalid together: both are named, in one prompt.
  const both = {
    missingFields: [field('patientName')],
    invalidFields: [field('age')],
    isComplete: false,
  };
  check(
    'T11.6 missing and invalid fields are spoken together',
    blockingFields(both).map(entry => entry.key),
    ['patientName', 'age'],
  );
}

{
  // More fields than the spoken limit. The prompt names four and says how many remain,
  // rather than reading out a list nobody can hold in their head.
  const many = [
    'patientName',
    'age',
    'pinCode',
    'contactNumber',
    'medicalHistory',
    'diagnosis',
  ].map(field);
  const { calls, transport } = recorder();
  await speak(many, { ...speechLanguageFor('or'), transport });

  const catalog = catalogFor('or');
  check('T11.7 a long list is still spoken', calls.length, 1);
  check(
    'T11.8 using the catalog frame that mentions the remainder',
    calls[0].text,
    missingFieldPrompt(many, 'or'),
  );
  check(
    'T11.9 and the frame is the one written for many fields',
    calls[0].text.startsWith(catalog.frames.many.split('{')[0]),
    true,
  );
}

{
  // Translation failure. The report cannot be filled, so the prompt is what the doctor
  // hears — and it must be in the language they dictated, not the language the report
  // would have been written in.
  const nothingExtracted = validateReportCompleteness(toDraft({}, []));
  const { calls, transport } = recorder();
  await speak(blockingFields(nothingExtracted), {
    ...speechLanguageFor('or'),
    transport,
  });

  check('T11.10 a failed translation still speaks', calls.length > 0, true);
  check('T11.11 in Odia', calls[0].lang, LANGUAGE_BY_CODE.or.tag);
  check(
    'T11.12 and never in the report language',
    calls[0].lang === LANGUAGE_BY_CODE.en.tag,
    false,
  );
}

{
  // Replay. "Read aloud again" repeats the same words in the same language; a second
  // play must not drift towards English.
  const { calls, transport } = recorder();
  await speak(THREE, { ...speechLanguageFor('or'), transport });
  await speak(THREE, { ...speechLanguageFor('or'), transport });

  check('T11.13 a replay speaks again', calls.length, 2);
  check('T11.14 with identical words', calls[0].text, calls[1].text);
  check('T11.15 and identical language', calls[0].lang, calls[1].lang);
}

report();
