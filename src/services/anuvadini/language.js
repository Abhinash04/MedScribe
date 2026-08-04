/**
 * Language codes for the transcription request, in one place.
 *
 * The working integration appends "-IN", but that is a convention rather than a
 * rule, so the mapping is explicit: a language that turns out to need a
 * different region tag becomes a data change here instead of a string
 * concatenation scattered through the UI.
 */

const LANGUAGES = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  or: 'or-IN',
  as: 'as-IN',
  ur: 'ur-IN',
};

export const DEFAULT_LANGUAGE = 'en';

export function normalizeAnuvadiniLanguage(language = DEFAULT_LANGUAGE) {
  const value = String(language || '').trim();
  if (!value) {
    return LANGUAGES[DEFAULT_LANGUAGE];
  }

  const base = value.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES[base] || null;
}

export function isSupportedLanguage(language) {
  return normalizeAnuvadiniLanguage(language) !== null;
}
