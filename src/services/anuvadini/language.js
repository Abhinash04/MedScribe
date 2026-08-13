import {
  DEFAULT_LANGUAGE_CODE,
  DICTATION_LANGUAGES,
  resolveLegacyCode,
} from '../../constants/languages.js';

const LANGUAGES = Object.fromEntries(
  DICTATION_LANGUAGES.map(language => [language.code, language.tag]),
);

export const DEFAULT_LANGUAGE = DEFAULT_LANGUAGE_CODE;

export function normalizeAnuvadiniLanguage(language = DEFAULT_LANGUAGE) {
  const value = String(language || '').trim();
  if (!value) {
    return LANGUAGES[DEFAULT_LANGUAGE];
  }

  const rawLower = value.toLowerCase();
  const lowered = resolveLegacyCode(rawLower);
  if (LANGUAGES[lowered]) {
    return LANGUAGES[lowered];
  }

  const base = lowered.split(/[-_]/)[0];
  return LANGUAGES[base] || null;
}

export function isSupportedLanguage(language) {
  return normalizeAnuvadiniLanguage(language) !== null;
}
