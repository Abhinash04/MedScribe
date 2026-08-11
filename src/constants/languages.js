// The single source of truth for every dictation language MedScribe knows about.
//
// Three identifiers per row, and they are NOT interchangeable:
//   code            what the app carries (settings, session rows, prompt catalogs)
//   tag             BCP-47 for RecognizerIntent.EXTRA_LANGUAGE and Anuvadini STT/TTS
//   translationCode what the Pravah translatebulk API accepts as `to` / `from`
//
// Four rows have a translationCode that is NOT `${code}-IN`. Those four are
// pinned literally in scripts/test-languages.mjs precisely because a future
// "helpful" refactor would normalise them and silently kill translation:
//   kok -> gom-IN, ks-deva -> ks-dn-IN, ks-arab -> ks-ar-IN, sd -> sd-dn-IN
//
// `confirmed` means the tag has been verified against the Anuvadini service.
// `voice` is null until verified with `npm run probe:tts`; a null voice makes
// voiceFor return null, which the TTS path treats as UNSUPPORTED_LANGUAGE.

export const DICTATION_LANGUAGES = [
  {
    code: 'en',
    tag: 'en-IN',
    translationCode: 'en-IN',
    englishName: 'English (India)',
    nativeName: 'English',
    script: 'latin',
    voice: 'en-IN-PrabhatNeural',
    gender: 'Female',
    confirmed: true,
  },
  {
    code: 'as',
    tag: 'as-IN',
    translationCode: 'as-IN',
    englishName: 'Assamese',
    nativeName: 'অসমীয়া',
    script: 'bengali',
    voice: null,
    gender: null,
    confirmed: true,
  },
  {
    code: 'bn',
    tag: 'bn-IN',
    translationCode: 'bn-IN',
    englishName: 'Bengali',
    nativeName: 'বাংলা',
    script: 'bengali',
    voice: null,
    gender: null,
    confirmed: true,
  },
  {
    code: 'brx',
    tag: 'brx-IN',
    translationCode: 'brx-IN',
    englishName: 'Bodo',
    nativeName: 'बड़ो',
    script: 'devanagari',
    voice: null,
    gender: null,
    confirmed: false,
  },
  {
    code: 'doi',
    tag: 'doi-IN',
    translationCode: 'doi-IN',
    englishName: 'Dogri',
    nativeName: 'डोगरी',
    script: 'devanagari',
    voice: null,
    gender: null,
    confirmed: false,
  },
  {
    code: 'gu',
    tag: 'gu-IN',
    translationCode: 'gu-IN',
    englishName: 'Gujarati',
    nativeName: 'ગુજરાતી',
    script: 'gujarati',
    voice: null,
    gender: null,
    confirmed: true,
  },
  {
    code: 'hi',
    tag: 'hi-IN',
    translationCode: 'hi-IN',
    englishName: 'Hindi',
    nativeName: 'हिन्दी',
    script: 'devanagari',
    voice: null,
    gender: null,
    confirmed: true,
  },
  {
    code: 'kn',
    tag: 'kn-IN',
    translationCode: 'kn-IN',
    englishName: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    script: 'kannada',
    voice: null,
    gender: null,
    confirmed: true,
  },
  // Pravah serves Kashmiri as two separate languages, one per script. They share
  // one Android recogniser tag, so LANGUAGE_BY_TAG is not a bijection — see below.
  {
    code: 'ks-deva',
    tag: 'ks-IN',
    translationCode: 'ks-dn-IN',
    englishName: 'Kashmiri (Devanagari)',
    nativeName: 'कॉशुर',
    script: 'devanagari',
    voice: null,
    gender: null,
    confirmed: false,
  },
  {
    code: 'ks-arab',
    tag: 'ks-IN',
    translationCode: 'ks-ar-IN',
    englishName: 'Kashmiri (Perso-Arabic)',
    nativeName: 'کٲشُر',
    script: 'perso-arabic',
    voice: null,
    gender: null,
    confirmed: false,
  },
  {
    code: 'kok',
    tag: 'kok-IN',
    translationCode: 'gom-IN',
    englishName: 'Konkani',
    nativeName: 'कोंकणी',
    script: 'devanagari',
    voice: null,
    gender: null,
    confirmed: false,
  },
  {
    code: 'mai',
    tag: 'mai-IN',
    translationCode: 'mai-IN',
    englishName: 'Maithili',
    nativeName: 'मैथिली',
    script: 'devanagari',
    voice: null,
    gender: null,
    confirmed: false,
  },
  {
    code: 'ml',
    tag: 'ml-IN',
    translationCode: 'ml-IN',
    englishName: 'Malayalam',
    nativeName: 'മലയാളം',
    script: 'malayalam',
    voice: null,
    gender: null,
    confirmed: true,
  },
  {
    code: 'mni',
    tag: 'mni-IN',
    translationCode: 'mni-IN',
    englishName: 'Manipuri',
    nativeName: 'ꯃꯤꯇꯩꯂꯣꯟ',
    script: 'meitei-mayek',
    voice: null,
    gender: null,
    confirmed: false,
  },
  {
    code: 'mr',
    tag: 'mr-IN',
    translationCode: 'mr-IN',
    englishName: 'Marathi',
    nativeName: 'मराठी',
    script: 'devanagari',
    voice: null,
    gender: null,
    confirmed: true,
  },
  {
    code: 'ne',
    tag: 'ne-IN',
    translationCode: 'ne-IN',
    englishName: 'Nepali',
    nativeName: 'नेपाली',
    script: 'devanagari',
    voice: null,
    gender: null,
    confirmed: false,
  },
  {
    code: 'or',
    tag: 'or-IN',
    translationCode: 'or-IN',
    englishName: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    script: 'odia',
    voice: null,
    gender: null,
    confirmed: true,
  },
  {
    code: 'pa',
    tag: 'pa-IN',
    translationCode: 'pa-IN',
    englishName: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    script: 'gurmukhi',
    voice: null,
    gender: null,
    confirmed: true,
  },
  {
    code: 'sa',
    tag: 'sa-IN',
    translationCode: 'sa-IN',
    englishName: 'Sanskrit',
    nativeName: 'संस्कृतम्',
    script: 'devanagari',
    voice: null,
    gender: null,
    confirmed: false,
  },
  {
    code: 'sat',
    tag: 'sat-IN',
    translationCode: 'sat-IN',
    englishName: 'Santali',
    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',
    script: 'ol-chiki',
    voice: null,
    gender: null,
    confirmed: false,
  },
  // Pravah serves Sindhi in Devanagari only. The Android recogniser will
  // realistically emit Perso-Arabic for sd-IN — a mismatch we cannot resolve,
  // and the strongest single reason the runtime omits `from` and lets the API
  // auto-detect. See shouldSendFrom in services/transcriptTranslation.js.
  {
    code: 'sd',
    tag: 'sd-IN',
    translationCode: 'sd-dn-IN',
    englishName: 'Sindhi (Devanagari)',
    nativeName: 'सिन्धी',
    script: 'devanagari',
    voice: null,
    gender: null,
    confirmed: false,
  },
  {
    code: 'ta',
    tag: 'ta-IN',
    translationCode: 'ta-IN',
    englishName: 'Tamil',
    nativeName: 'தமிழ்',
    script: 'tamil',
    voice: null,
    gender: null,
    confirmed: true,
  },
  {
    code: 'te',
    tag: 'te-IN',
    translationCode: 'te-IN',
    englishName: 'Telugu',
    nativeName: 'తెలుగు',
    script: 'telugu',
    voice: null,
    gender: null,
    confirmed: true,
  },
  {
    code: 'ur',
    tag: 'ur-IN',
    translationCode: 'ur-IN',
    englishName: 'Urdu',
    nativeName: 'اردو',
    script: 'perso-arabic',
    voice: null,
    gender: null,
    confirmed: true,
  },
];

export const DEFAULT_LANGUAGE_CODE = 'en';

export const LANGUAGE_BY_CODE = Object.fromEntries(
  DICTATION_LANGUAGES.map(language => [language.code, language]),
);

// A convenience reverse index, NOT a bijection: script variants share one
// recogniser tag. First row in table order wins, so the result is deterministic
// rather than an accident of Object.fromEntries being last-wins.
export const LANGUAGE_BY_TAG = DICTATION_LANGUAGES.reduce((map, language) => {
  if (!(language.tag in map)) {
    map[language.tag] = language;
  }
  return map;
}, {});

// Codes that existed before a language was split by script. Applied when a
// stored setting is read, so a doctor's saved choice is migrated rather than
// silently falling back to English.
export const LEGACY_LANGUAGE_ALIAS = {
  ks: 'ks-arab',
};

export const resolveLegacyCode = code => LEGACY_LANGUAGE_ALIAS[code] ?? code;

export const isLatinScript = code =>
  (LANGUAGE_BY_CODE[code] ?? LANGUAGE_BY_CODE[DEFAULT_LANGUAGE_CODE]).script ===
  'latin';

export const isKnownLanguage = code => Boolean(LANGUAGE_BY_CODE[code]);

export const displayFor = code =>
  LANGUAGE_BY_CODE[code] ?? LANGUAGE_BY_CODE[DEFAULT_LANGUAGE_CODE];

// The tag handed to RecognizerIntent.EXTRA_LANGUAGE and sharedMic.start.
export const recognizerTag = code => displayFor(code).tag;

// The code the Pravah translatebulk API accepts. Never derive this from `code`.
export const translationCodeFor = code =>
  LANGUAGE_BY_CODE[code]?.translationCode ?? '';
