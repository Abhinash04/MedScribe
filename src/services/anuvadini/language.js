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
