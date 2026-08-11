
import {
  DEFAULT_LANGUAGE_CODE,
  DICTATION_LANGUAGES,
  LANGUAGE_BY_CODE,
  LANGUAGE_BY_TAG,
  displayFor,
  isKnownLanguage,
  isLatinScript,
  recognizerTag,
  resolveLegacyCode,
  translationCodeFor,
} from '../src/constants/languages.js';
import { isPravahLanguage } from '../src/services/pravah/translationContract.js';
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  normalizeAnuvadiniLanguage,
} from '../src/services/anuvadini/language.js';
import { voiceFor } from '../src/services/anuvadini/speechContract.js';
import {
  RECOGNIZER,
  capabilitiesFor,
  capabilityList,
} from '../src/services/languageCapabilities.js';

import { check, report } from './lib/fixture-harness.mjs';

const codes = DICTATION_LANGUAGES.map(language => language.code);
const tags = DICTATION_LANGUAGES.map(language => language.tag);

check('L1.1 codes are unique', new Set(codes).size, codes.length);

// A tag may be shared, but only by a deliberate script split: Pravah serves
// some languages once per script while Android has one recogniser locale.
const byTag = DICTATION_LANGUAGES.reduce((map, language) => {
  (map[language.tag] ??= []).push(language);
  return map;
}, {});
check(
  'L1.2 a shared tag is always a two-row script split',
  Object.entries(byTag)
    .filter(([, rows]) => rows.length > 1)
    .filter(
      ([, rows]) =>
        rows.length !== 2 ||
        new Set(rows.map(row => row.script)).size !== rows.length,
    )
    .map(([tag]) => tag),
  [],
);
check('L1.3 default code is present', isKnownLanguage(DEFAULT_LANGUAGE_CODE), true);
check('L1.4 English is first', codes[0], 'en');
check(
  'L1.5 every tag is an Indian tag',
  tags.filter(tag => !/^[a-z]{2,3}-IN$/.test(tag)),
  [],
);
check(
  'L1.6 every tag derives from its base code',
  DICTATION_LANGUAGES.filter(
    l => l.tag !== `${l.code.split('-')[0]}-IN`,
  ).map(l => l.code),
  [],
);
check(
  'L1.7 every row is fully populated',
  DICTATION_LANGUAGES.filter(
    l =>
      !l.englishName ||
      !l.nativeName ||
      !l.script ||
      typeof l.confirmed !== 'boolean',
  ).map(l => l.code),
  [],
);
check(
  'L1.8 a voice always carries a gender',
  DICTATION_LANGUAGES.filter(l => Boolean(l.voice) !== Boolean(l.gender)).map(
    l => l.code,
  ),
  [],
);
check('L1.9 indexed by code', LANGUAGE_BY_CODE.hi.tag, 'hi-IN');
check('L1.10 indexed by tag', LANGUAGE_BY_TAG['hi-IN'].code, 'hi');
check(
  'L1.11 22 Indian languages plus English, Kashmiri split by script',
  codes.length,
  24,
);
check(
  'L1.12 no non-Indian codes',
  codes.filter(code => ['fr', 'de', 'es', 'en-US', 'xx'].includes(code)),
  [],
);

for (const code of [
  'en',
  'hi',
  'mr',
  'bn',
  'ta',
  'te',
  'kn',
  'ml',
  'gu',
  'pa',
  'or',
  'as',
  'ur',
]) {
  check(`L2.1 ${code} → ${code}-IN`, normalizeAnuvadiniLanguage(code), `${code}-IN`);
}

check('L2.2 default export unchanged', DEFAULT_LANGUAGE, 'en');
check('L2.3 already tagged', normalizeAnuvadiniLanguage('hi-IN'), 'hi-IN');
check('L2.4 underscore separator', normalizeAnuvadiniLanguage('hi_IN'), 'hi-IN');
check('L2.5 case insensitive', normalizeAnuvadiniLanguage('HI'), 'hi-IN');
check('L2.6 empty string falls back', normalizeAnuvadiniLanguage(''), 'en-IN');
check('L2.7 null falls back', normalizeAnuvadiniLanguage(null), 'en-IN');
check('L2.8 no argument falls back', normalizeAnuvadiniLanguage(), 'en-IN');
check('L2.9 unknown code rejected', normalizeAnuvadiniLanguage('xx'), null);
check('L2.10 non-Indian rejected', normalizeAnuvadiniLanguage('fr'), null);
check('L2.11 three-letter code', normalizeAnuvadiniLanguage('kok'), 'kok-IN');
check('L2.12 three-letter tagged', normalizeAnuvadiniLanguage('sat-IN'), 'sat-IN');
check('L2.13 newly added code supported', isSupportedLanguage('sa'), true);
check('L2.14 unsupported check', isSupportedLanguage('xx'), false);
check('L3.1 English voice unchanged', voiceFor('en-IN'), {
  voice: 'en-IN-PrabhatNeural',
  gender: 'Female',
});
check('L3.2 non-Indian tag has no voice', voiceFor('fr-FR'), null);
check('L3.3 unknown tag has no voice', voiceFor('zz-IN'), null);
check(
  'L3.4 voiceFor matches the table exactly',
  DICTATION_LANGUAGES.filter(l => Boolean(voiceFor(l.tag)) !== Boolean(l.voice)).map(
    l => l.code,
  ),
  [],
);

check('L4.1 recognizerTag for a known code', recognizerTag('or'), 'or-IN');
check('L4.2 recognizerTag falls back to en-IN', recognizerTag('zz'), 'en-IN');
check('L4.3 recognizerTag with no argument', recognizerTag(), 'en-IN');
check('L4.4 displayFor unknown falls back', displayFor('zz').code, 'en');
check('L4.5 English is Latin script', isLatinScript('en'), true);
check('L4.6 Hindi is not Latin script', isLatinScript('hi'), false);
check('L4.7 unknown treated as the default', isLatinScript('zz'), true);
check('L4.8 isKnownLanguage rejects a tag', isKnownLanguage('hi-IN'), false);

const noProbe = capabilitiesFor('hi');
check('L5.1 unprobed is UNVERIFIED', noProbe.recognizer, RECOGNIZER.UNVERIFIED);
check('L5.2 unprobed still knows the tag', noProbe.tag, 'hi-IN');
check('L5.3 Hindi has no voice yet', noProbe.hasVoice, false);
check('L5.4 English has a voice', capabilitiesFor('en').hasVoice, true);

const probed = { deviceLocales: ['en-US', 'hi_IN', 'ta-IN'] };
check(
  'L5.5 exact tag match is ON_DEVICE',
  capabilitiesFor('ta', probed).recognizer,
  RECOGNIZER.ON_DEVICE,
);
check(
  'L5.6 underscore locale match is ON_DEVICE',
  capabilitiesFor('hi', probed).recognizer,
  RECOGNIZER.ON_DEVICE,
);
check(
  'L5.7 base-tag match is ON_DEVICE',
  capabilitiesFor('en', probed).recognizer,
  RECOGNIZER.ON_DEVICE,
);
check(
  'L5.8 absent from a real list is CLOUD_ONLY',
  capabilitiesFor('or', probed).recognizer,
  RECOGNIZER.CLOUD_ONLY,
);
check(
  'L5.9 empty list is a real answer',
  capabilitiesFor('hi', { deviceLocales: [] }).recognizer,
  RECOGNIZER.CLOUD_ONLY,
);
check(
  'L5.10 catalog lookup is injected',
  capabilitiesFor('hi', { hasCatalog: code => code === 'hi' }).hasPromptCatalog,
  true,
);
check('L5.11 no catalog by default', capabilitiesFor('hi').hasPromptCatalog, false);
check('L5.12 unknown code falls back to the default', capabilitiesFor('zz').code, 'en');
check('L5.13 capabilityList covers the table', capabilityList().length, codes.length);
check(
  'L5.14 capabilityList preserves table order',
  capabilityList().map(entry => entry.code),
  codes,
);

// L6 — translation codes
//
// The Pravah API is a separate namespace from the Android recogniser tag. Four
// languages disagree, and those four are pinned literally below because they
// are exactly what a future "helpful" refactor would normalise back to
// `${code}-IN` — killing translation with no other test failing.

check(
  'L6.1 every row has a translation code',
  DICTATION_LANGUAGES.filter(l => !l.translationCode).map(l => l.code),
  [],
);
check(
  'L6.2 every translation code is one the API accepts',
  DICTATION_LANGUAGES.filter(l => !isPravahLanguage(l.translationCode)).map(
    l => l.code,
  ),
  [],
);
check(
  'L6.3 translation codes are unique',
  new Set(DICTATION_LANGUAGES.map(l => l.translationCode)).size,
  DICTATION_LANGUAGES.length,
);
check('L6.4 English translates as en-IN', translationCodeFor('en'), 'en-IN');

check('L6.5a Konkani is gom-IN, not kok-IN', translationCodeFor('kok'), 'gom-IN');
check(
  'L6.5b Kashmiri Devanagari is ks-dn-IN',
  translationCodeFor('ks-deva'),
  'ks-dn-IN',
);
check(
  'L6.5c Kashmiri Perso-Arabic is ks-ar-IN',
  translationCodeFor('ks-arab'),
  'ks-ar-IN',
);
check('L6.5d Sindhi is sd-dn-IN, not sd-IN', translationCodeFor('sd'), 'sd-dn-IN');
check('L6.5e an unknown code has no translation code', translationCodeFor('zz'), '');

check(
  'L6.6 no foreign translation codes',
  DICTATION_LANGUAGES.filter(l =>
    ['fr', 'de', 'es', 'zh-CN', 'ja'].includes(l.translationCode),
  ).map(l => l.code),
  [],
);
check(
  'L6.7 the API code set excludes the 88 foreign languages',
  ['fr', 'de', 'es', 'ja', 'zh-CN'].filter(code => isPravahLanguage(code)),
  [],
);

check(
  'L6.8 a shared tag resolves to the first row in table order',
  LANGUAGE_BY_TAG['ks-IN'].code,
  'ks-deva',
);
check('L6.9a a split legacy code migrates', resolveLegacyCode('ks'), 'ks-arab');
check('L6.9b an unsplit code is untouched', resolveLegacyCode('hi'), 'hi');
check('L6.9c an unknown code is untouched', resolveLegacyCode('zz'), 'zz');
check(
  'L6.9d the migration target is a real row',
  isKnownLanguage(resolveLegacyCode('ks')),
  true,
);

report();
