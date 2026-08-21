import {
  DEFAULT_LANGUAGE_CODE,
  DICTATION_LANGUAGES,
  LANGUAGE_BY_CODE,
} from '../constants/languages.js';

export const RECOGNIZER = {
  ON_DEVICE: 'on_device',
  CLOUD_ONLY: 'cloud_only',
  UNVERIFIED: 'unverified',
};

const normalizeLocale = value =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');

function recognizerSupport(tag, deviceLocales) {
  if (!Array.isArray(deviceLocales)) {
    return RECOGNIZER.UNVERIFIED;
  }

  const wanted = normalizeLocale(tag);
  const base = wanted.split('-')[0];
  const known = deviceLocales.map(normalizeLocale);

  const supported = known.some(
    locale => locale === wanted || locale.split('-')[0] === base,
  );
  return supported ? RECOGNIZER.ON_DEVICE : RECOGNIZER.CLOUD_ONLY;
}

export function capabilitiesFor(
  code,
  { deviceLocales = null, hasCatalog = () => false } = {},
) {
  const language =
    LANGUAGE_BY_CODE[code] ?? LANGUAGE_BY_CODE[DEFAULT_LANGUAGE_CODE];

  return {
    code: language.code,
    tag: language.tag,
    englishName: language.englishName,
    nativeName: language.nativeName,
    script: language.script,
    confirmed: language.confirmed,
    recognizer: recognizerSupport(language.tag, deviceLocales),
    hasVoice: Boolean(language.voice),
    hasPromptCatalog: Boolean(hasCatalog(language.code)),
  };
}

export function capabilityList(options = {}) {
  return DICTATION_LANGUAGES.map(language =>
    capabilitiesFor(language.code, options),
  );
}

export const DEVANAGARI_VOICE_FALLBACK = 'hi';
export function speechLanguageFor(code) {
  const language = LANGUAGE_BY_CODE[code];

  if (!language) {
    return {
      language: DEFAULT_LANGUAGE_CODE,
      fallbackLanguage: null,
      resolved: false,
    };
  }
  if (language.voice) {
    return { language: language.code, fallbackLanguage: null, resolved: true };
  }

  return {
    language: language.code,
    fallbackLanguage:
      language.script === 'devanagari'
        ? DEVANAGARI_VOICE_FALLBACK
        : DEFAULT_LANGUAGE_CODE,
    resolved: true,
  };
}
