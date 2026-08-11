import {
  DEFAULT_LANGUAGE_CODE,
  DICTATION_LANGUAGES,
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

  // Exact match first. Script-variant codes are hyphenated ('ks-deva'), and the
  // base-tag split below would reduce them to 'ks', which is not a row.
  const lowered = value.toLowerCase();
  if (LANGUAGES[lowered]) {
    return LANGUAGES[lowered];
  }

  const base = lowered.split(/[-_]/)[0];
  return LANGUAGES[base] || null;
}

export function isSupportedLanguage(language) {
  return normalizeAnuvadiniLanguage(language) !== null;
}
