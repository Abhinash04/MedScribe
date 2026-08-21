globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import {
  DEFAULT_LANGUAGE_CODE,
  DICTATION_LANGUAGES,
  LANGUAGE_BY_CODE,
  isKnownLanguage,
  recognizerTag,
  resolveLegacyCode,
  translationCodeFor,
} from '../src/constants/languages.js';
import { hasCatalog } from '../src/constants/prompts/index.js';
import {
  DEFAULT_LANGUAGE,
  normalizeAnuvadiniLanguage,
} from '../src/services/anuvadini/language.js';
import { voiceFor } from '../src/services/anuvadini/speechContract.js';
import { needsTranslation } from '../src/services/consultationTranslation.js';
import { speechLanguageFor } from '../src/services/languageCapabilities.js';
import { isPravahLanguage } from '../src/services/pravah/translationContract.js';

import { check, report } from './lib/fixture-harness.mjs';

const CODES = DICTATION_LANGUAGES.map(language => language.code);

check('L1.1 twenty-four languages', CODES.length, 24);
check('L1.2 every code is unique', new Set(CODES).size, 24);
check('L1.3 English is the default', DEFAULT_LANGUAGE_CODE, 'en');
check('L1.4 the Anuvadini default agrees', DEFAULT_LANGUAGE, DEFAULT_LANGUAGE_CODE);

for (const language of DICTATION_LANGUAGES) {
  const code = language.code;

  check(`L2.1 ${code} is a known language`, isKnownLanguage(code), true);

  check(`L2.2 ${code} survives the legacy alias step`, resolveLegacyCode(code), code);

  check(`L2.3 ${code} has a recognizer tag`, recognizerTag(code), language.tag);
  check(
    `L2.4 ${code} recognizer tag is BCP-47 shaped`,
    /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(language.tag),
    true,
  );

  check(`L2.5 ${code} normalizes to its tag`, normalizeAnuvadiniLanguage(code), language.tag);

  check(
    `L2.6 ${code} has a translation code the API accepts`,
    isPravahLanguage(translationCodeFor(code)),
    true,
  );

  const speech = speechLanguageFor(code);
  check(`L2.7 ${code} speaks in its own language`, speech.language, code);
  check(
    `L2.8 ${code} ends at a voice, its own or a fallback`,
    Boolean(
      voiceFor(normalizeAnuvadiniLanguage(speech.language)) ||
        voiceFor(normalizeAnuvadiniLanguage(speech.fallbackLanguage)),
    ),
    true,
  );
  check(
    `L2.9 ${code} ends at a prompt catalog, its own or a fallback`,
    hasCatalog(code) || hasCatalog(speech.fallbackLanguage),
    true,
  );

  check(`L2.10 ${code} translation need`, needsTranslation(code), code !== 'en');
}

check(
  'L3.1 no known language resolves to the English recognizer tag',
  DICTATION_LANGUAGES.filter(
    language => language.code !== 'en' && recognizerTag(language.code) === 'en-IN',
  ).map(language => language.code),
  [],
);
check(
  'L3.2 no known language normalizes to the English tag',
  DICTATION_LANGUAGES.filter(
    language => language.code !== 'en' && normalizeAnuvadiniLanguage(language.code) === 'en-IN',
  ).map(language => language.code),
  [],
);
check(
  'L3.3 no known language translates as English',
  DICTATION_LANGUAGES.filter(
    language => language.code !== 'en' && translationCodeFor(language.code) === 'en-IN',
  ).map(language => language.code),
  [],
);
check(
  'L3.4 no known language is spoken as English unless it is English',
  DICTATION_LANGUAGES.filter(
    language => language.code !== 'en' && speechLanguageFor(language.code).language === 'en',
  ).map(language => language.code),
  [],
);

for (const bogus of ['zz', 'klingon', '', null, undefined, 'en-US-x-private']) {
  const label = JSON.stringify(bogus);
  check(`L4.1 ${label} is not a known language`, isKnownLanguage(bogus), false);
  check(`L4.2 ${label} still yields a recognizer tag`, recognizerTag(bogus), 'en-IN');
  check(
    `L4.3 ${label} still yields a speakable language`,
    speechLanguageFor(bogus).language,
    'en',
  );
}

check('L5.1 an empty translation code is rejected by the API guard', isPravahLanguage(''), false);
check(
  'L5.2 an unknown code has no translation code',
  translationCodeFor('zz'),
  '',
);

check('L6.1 the legacy code migrates', resolveLegacyCode('ks'), 'ks-arab');
check('L6.2 the migration target is real', isKnownLanguage(resolveLegacyCode('ks')), true);
check(
  'L6.3 the two Kashmiri variants share a recognizer tag',
  [LANGUAGE_BY_CODE['ks-deva'].tag, LANGUAGE_BY_CODE['ks-arab'].tag],
  ['ks-IN', 'ks-IN'],
);
check(
  'L6.4 but they translate differently',
  translationCodeFor('ks-deva') === translationCodeFor('ks-arab'),
  false,
);

check('L7.1 Konkani translates as gom-IN', translationCodeFor('kok'), 'gom-IN');
check('L7.2 Sindhi translates as sd-dn-IN', translationCodeFor('sd'), 'sd-dn-IN');
check(
  'L7.3 both are accepted by the API guard',
  ['kok', 'sd'].filter(code => !isPravahLanguage(translationCodeFor(code))),
  [],
);

report();
