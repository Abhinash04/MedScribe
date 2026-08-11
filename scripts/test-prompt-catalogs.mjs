
import { LANGUAGE_BY_CODE } from '../src/constants/languages.js';
import { PATIENT_FIELDS, REQUIRED_FIELDS } from '../src/constants/patientFields.js';
import {
  allCatalogs,
  catalogCodes,
  catalogFor,
  hasCatalog,
} from '../src/constants/prompts/index.js';
import { MAX_SPEECH_CHARS } from '../src/services/anuvadini/speechClient.js';
import { isPravahLanguage } from '../src/services/pravah/translationContract.js';
import { missingFieldPrompt } from '../src/services/missingFieldPrompt.js';

import { check, report } from './lib/fixture-harness.mjs';

const FIELD_KEYS = PATIENT_FIELDS.map(field => field.key).sort();
const asFields = keys =>
  keys.map(key => PATIENT_FIELDS.find(field => field.key === key));

check('P1.1 English is registered', hasCatalog('en'), true);
check('P1.2 an unregistered code is absent', hasCatalog('zz'), false);
check('P1.3 catalogFor returns null for an unknown code', catalogFor('zz'), null);
check(
  'P1.4 every catalog code is a real language',
  catalogCodes().filter(code => !LANGUAGE_BY_CODE[code]),
  [],
);
check(
  'P1.5 every catalog names its own code',
  allCatalogs().filter(catalog => !hasCatalog(catalog.code)).map(c => c.code),
  [],
);

for (const catalog of allCatalogs()) {
  const id = catalog.code;

  check(
    `P2.1 ${id} labels match PATIENT_FIELDS exactly`,
    Object.keys(catalog.labels ?? {}).sort(),
    FIELD_KEYS,
  );
  check(
    `P2.2 ${id} has no empty label`,
    Object.entries(catalog.labels ?? {})
      .filter(([, value]) => !String(value ?? '').trim())
      .map(([key]) => key),
    [],
  );
  check(
    `P2.3 ${id} has all three frames`,
    ['one', 'few', 'many'].filter(name => !catalog.frames?.[name]),
    [],
  );
  check(
    `P2.4 ${id} every frame carries {names}`,
    ['one', 'few', 'many'].filter(
      name => !String(catalog.frames?.[name] ?? '').includes('{names}'),
    ),
    [],
  );
  check(
    `P2.5 ${id} many frame carries {count} and {detailWord}`,
    ['{count}', '{detailWord}'].filter(
      token => !String(catalog.frames?.many ?? '').includes(token),
    ),
    [],
  );
  check(
    `P2.6 ${id} has both detail words`,
    Boolean(catalog.detailWord?.one && catalog.detailWord?.other),
    true,
  );
  check(
    `P2.7 ${id} has both join parts`,
    typeof catalog.join?.separator === 'string' &&
      typeof catalog.join?.and === 'string',
    true,
  );
  check(`P2.8 ${id} declares a review state`, typeof catalog.reviewed, 'boolean');
  check(
    `P2.9 ${id} leaves no unknown placeholder`,
    Object.values(catalog.frames ?? {})
      .flatMap(frame => String(frame).match(/\{(\w+)\}/g) ?? [])
      .filter(token => !['{names}', '{count}', '{detailWord}'].includes(token)),
    [],
  );
}

for (const catalog of allCatalogs()) {
  const language = LANGUAGE_BY_CODE[catalog.code];
  if (!language || language.script === 'latin') {
    continue;
  }

  const strings = [
    ...Object.values(catalog.labels ?? {}),
    ...Object.values(catalog.frames ?? {}).map(frame =>
      String(frame).replace(/\{\w+\}/g, ''),
    ),
    catalog.detailWord?.one,
    catalog.detailWord?.other,
  ];

  check(
    `P3.1 ${catalog.code} has no untranslated Latin runs`,
    strings.filter(value => /[A-Za-z]{4,}/.test(String(value ?? ''))),
    [],
  );
}

check(
  'P4.1 one field',
  missingFieldPrompt(asFields(['pinCode']), 'en'),
  'The PIN code is still missing. Please provide this mandatory detail.',
);
check(
  'P4.2 three fields use "and" before the last',
  missingFieldPrompt(asFields(['patientName', 'age', 'pinCode']), 'en'),
  'The patient name, age and PIN code are still missing. Please provide these mandatory details.',
);
check(
  'P4.3 five fields use the count tail with no "and" before the fourth',
  missingFieldPrompt(
    asFields(['patientName', 'age', 'gender', 'address', 'pinCode']),
    'en',
  ),
  'The patient name, age, gender, address, and 1 other mandatory detail are still missing. Please provide the missing information.',
);
check(
  'P4.4 plural detail word',
  missingFieldPrompt(
    asFields([
      'patientName',
      'age',
      'gender',
      'address',
      'pinCode',
      'contactNumber',
    ]),
    'en',
  ),
  'The patient name, age, gender, address, and 2 other mandatory details are still missing. Please provide the missing information.',
);

const three = asFields(['patientName', 'age', 'pinCode']);
check(
  'P5.1 no language argument equals English',
  missingFieldPrompt(three),
  missingFieldPrompt(three, 'en'),
);
check(
  'P5.2 an unregistered language falls back to English',
  missingFieldPrompt(three, 'zz'),
  missingFieldPrompt(three, 'en'),
);
check(
  'P5.3 a known language with no catalog falls back to English',
  missingFieldPrompt(three, 'ta'),
  missingFieldPrompt(three, 'en'),
);
check('P5.4 empty field list is silent', missingFieldPrompt([], 'hi'), '');
check('P5.5 a non-array is silent', missingFieldPrompt(null, 'hi'), '');
check(
  'P5.6 a field missing from a catalog still gets a name',
  missingFieldPrompt([{ key: 'unknownKey', label: 'Some Field' }], 'en'),
  'The some field is still missing. Please provide this mandatory detail.',
);

const allRequired = REQUIRED_FIELDS;
for (const catalog of allCatalogs()) {
  const worst = missingFieldPrompt(allRequired, catalog.code);
  check(`P6.1 ${catalog.code} produces a prompt`, worst.length > 0, true);
  check(
    `P6.2 ${catalog.code} worst case fits in ${MAX_SPEECH_CHARS} chars (${worst.length})`,
    worst.length <= MAX_SPEECH_CHARS,
    true,
  );
  check(
    `P6.3 ${catalog.code} leaves no placeholder unfilled`,
    /\{\w+\}/.test(worst),
    false,
  );

  for (const count of [1, 2, 4, 5]) {
    const prompt = missingFieldPrompt(allRequired.slice(0, count), catalog.code);
    check(
      `P6.4 ${catalog.code} ${count}-field prompt is filled`,
      /\{\w+\}/.test(prompt),
      false,
    );
    check(
      `P6.5 ${catalog.code} ${count}-field prompt is non-empty`,
      prompt.length > 0,
      true,
    );
  }
}

const hindiOne = missingFieldPrompt(asFields(['pinCode']), 'hi');
check('P7.1 Hindi uses its own label', hindiOne.includes('पिन कोड'), true);
check('P7.2 Hindi is not English', hindiOne.includes('still missing'), false);
check(
  'P7.3 Hindi joins with और',
  missingFieldPrompt(asFields(['age', 'gender']), 'hi').includes(' और '),
  true,
);
check(
  'P7.4 Hindi singular detail word',
  missingFieldPrompt(allRequired.slice(0, 5), 'hi').includes('जानकारी'),
  true,
);

// P8 — placeholder integrity
//
// P2.4/P2.5 assert a token is PRESENT. That is not enough: machine translation
// duplicates a token as readily as it drops one, and a duplicate would pass
// every assertion above while substituting twice at runtime. These assert
// exactly-once, and that no mangled variant slipped past the seeder's repair.

const TOKENS = {
  one: ['{names}'],
  few: ['{names}'],
  many: ['{names}', '{count}', '{detailWord}'],
};

const occurrences = (text, token) => String(text).split(token).length - 1;

for (const catalog of allCatalogs()) {
  for (const [frame, tokens] of Object.entries(TOKENS)) {
    const text = String(catalog.frames?.[frame] ?? '');
    check(
      `P8.1 ${catalog.code} ${frame} has each token exactly once`,
      tokens.filter(token => occurrences(text, token) !== 1),
      [],
    );
    check(
      `P8.2 ${catalog.code} ${frame} has no token the frame does not own`,
      ['{names}', '{count}', '{detailWord}']
        .filter(token => !tokens.includes(token))
        .filter(token => text.includes(token)),
      [],
    );
  }

  // Braces outside the three exact tokens mean a mangled placeholder:
  // '{ names }', a fullwidth '｛', or a half-restored '{names)'.
  const braces = Object.values(catalog.frames ?? {})
    .map(frame =>
      String(frame).replace(/\{names\}|\{count\}|\{detailWord\}/g, ''),
    )
    .filter(frame => /[{}｛｝]/.test(frame));
  check(`P8.3 ${catalog.code} has no mangled placeholder`, braces, []);

  // Labels are substituted INTO {names}; a placeholder inside one would nest.
  check(
    `P8.4 ${catalog.code} labels carry no placeholders`,
    Object.entries(catalog.labels ?? {})
      .filter(([, value]) => /[{}]/.test(String(value)))
      .map(([name]) => name),
    [],
  );
}

// P9 — a catalog cannot exist for a language we cannot translate

for (const catalog of allCatalogs()) {
  const language = LANGUAGE_BY_CODE[catalog.code];
  check(
    `P9.1 ${catalog.code} has a translation code`,
    Boolean(language?.translationCode),
    true,
  );
  check(
    `P9.2 ${catalog.code} translation code is one the API accepts`,
    isPravahLanguage(language?.translationCode),
    true,
  );
}

const unreviewed = allCatalogs()
  .filter(catalog => !catalog.reviewed)
  .map(catalog => catalog.code);
if (unreviewed.length) {
  console.log(`\nawaiting native-speaker review: ${unreviewed.join(', ')}`);
}

report();
