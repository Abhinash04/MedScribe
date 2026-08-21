globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { LANGUAGE_BY_CODE } from '../src/constants/languages.js';
import { hasCatalog } from '../src/constants/prompts/index.js';
import { normalizeAnuvadiniLanguage } from '../src/services/anuvadini/language.js';
import { voiceFor } from '../src/services/anuvadini/speechContract.js';
import { needsTranslation } from '../src/services/consultationTranslation.js';
import { isPravahLanguage } from '../src/services/pravah/translationContract.js';
import {
  CORPUS_LANGUAGES,
  EXPECTED,
  SAMPLE_IDS,
  STYLES,
  parseCorpusFile,
  samplesFor,
} from './fixtures/dictation-samples.mjs';

import { check, report } from './lib/fixture-harness.mjs';

check('C1.1 fourteen languages are covered', CORPUS_LANGUAGES.length, 14);
check('C1.2 twenty dictation styles are expected', SAMPLE_IDS.length, 20);
check(
  'C1.3 every expected id has a named style',
  SAMPLE_IDS.filter(id => !STYLES[id]),
  [],
);
check(
  'C1.4 every corpus language is a real row in languages.js',
  CORPUS_LANGUAGES.filter(entry => !LANGUAGE_BY_CODE[entry.code]).map(e => e.code),
  [],
);
check(
  'C1.5 no language is listed twice',
  CORPUS_LANGUAGES.length,
  new Set(CORPUS_LANGUAGES.map(entry => entry.code)).size,
);

const english = samplesFor('en');

for (const entry of CORPUS_LANGUAGES) {
  const samples = samplesFor(entry.code);

  check(`C2.1 ${entry.code} parses twenty samples`, samples.length, 20);
  check(
    `C2.2 ${entry.code} ids run 1..20 in order`,
    samples.map(sample => sample.id),
    SAMPLE_IDS,
  );
  check(
    `C2.3 ${entry.code} titles match the English column`,
    samples.map(sample => sample.title),
    english.map(sample => sample.title),
  );
  check(
    `C2.4 ${entry.code} has no empty dictation`,
    samples.filter(sample => sample.text.length < 40).map(sample => sample.id),
    [],
  );
}

for (const entry of CORPUS_LANGUAGES) {
  const samples = samplesFor(entry.code);

  check(
    `C3.1 ${entry.code} every sample is written in its own script`,
    samples.filter(sample => !entry.script.test(sample.text)).map(s => s.id),
    [],
  );

  if (entry.code === 'en') {
    continue;
  }

  check(
    `C3.2 ${entry.code} no sample is a verbatim copy of the English`,
    samples
      .filter((sample, index) => sample.text === english[index].text)
      .map(sample => sample.id),
    [],
  );

  check(
    `C3.3 ${entry.code} carries no English patient name verbatim`,
    samples
      .filter(sample => sample.text.includes(EXPECTED[sample.id].fullSpokenName))
      .map(sample => sample.id),
    [],
  );
}

for (const entry of CORPUS_LANGUAGES) {
  const language = LANGUAGE_BY_CODE[entry.code];

  check(`C4.1 ${entry.code} has a recognizer tag`, Boolean(language.tag), true);
  check(
    `C4.2 ${entry.code} has a translation code the API accepts`,
    isPravahLanguage(language.translationCode),
    true,
  );
  check(
    `C4.3 ${entry.code} has a voice for the spoken reply`,
    Boolean(voiceFor(normalizeAnuvadiniLanguage(entry.code))),
    true,
  );
  check(`C4.4 ${entry.code} has a prompt catalog`, hasCatalog(entry.code), true);
  check(
    `C4.5 ${entry.code} translation need is decided correctly`,
    needsTranslation(entry.code),
    entry.code !== 'en',
  );
}

const DIGIT_BASES = [
  0x0030,
  0x0660,
  0x06f0,
  0x0966,
  0x09e6,
  0x0a66,
  0x0ae6,
  0x0b66,
  0x0be6,
  0x0c66,
  0x0ce6,
  0x0d66,
];

const NUMERAL_CLASS = Object.fromEntries(
  Array.from({ length: 10 }, (unused, digit) => [
    String(digit),
    `[${DIGIT_BASES.map(base => String.fromCodePoint(base + digit)).join('')}]`,
  ]),
);

const anyNumeralForm = digits =>
  new RegExp([...String(digits)].map(digit => NUMERAL_CLASS[digit]).join('\\s*'));

for (const entry of CORPUS_LANGUAGES) {
  for (const sample of samplesFor(entry.code)) {
    const expected = EXPECTED[sample.id];
    const [day, month] = expected.reactionStartDate.split('/');

    check(
      `C5.1 ${entry.code}/${sample.id} carries the reaction start day ${Number(day)}`,
      anyNumeralForm(Number(day)).test(sample.text),
      true,
    );
    check(
      `C5.2 ${entry.code}/${sample.id} carries the year 2026`,
      anyNumeralForm(2026).test(sample.text),
      true,
    );
    check(
      `C5.3 ${entry.code}/${sample.id} carries the age ${parseInt(expected.age, 10)}`,
      anyNumeralForm(parseInt(expected.age, 10)).test(sample.text),
      true,
    );
    check(
      `C5.4 ${entry.code}/${sample.id} names month ${Number(month)} (August)`,
      Number(month),
      8,
    );
  }
}

{
  const parsed = parseCorpusFile(
    'Sample 1 — First\nBody one.\n\nSample 2 — Second\nBody two.\n',
  );
  check('C6.1 the parser reads two samples', parsed.length, 2);
  check('C6.2 the parser keeps the id', parsed[0].id, 1);
  check('C6.3 the parser keeps the title', parsed[1].title, 'Second');
  check('C6.4 the parser keeps the body', parsed[0].text, 'Body one.');
  check('C6.5 an empty file yields nothing', parseCorpusFile(''), []);
  check(
    'C6.6 a wrapped body is rejoined',
    parseCorpusFile('Sample 3 — Wrapped\nfirst half\nsecond half\n')[0].text,
    'first half second half',
  );
  check(
    'C6.7 text before any header is ignored',
    parseCorpusFile('stray preamble\nSample 1 — A\nbody\n').length,
    1,
  );
}

report();
