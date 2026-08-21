import { translationCodeFor } from '../../constants/languages.js';
import { ERROR_KIND } from '../anuvadini/proxyContract.js';

export { ERROR_KIND, translationCodeFor };

export const PRAVAH_TARGET_ENGLISH = 'en';
export const AUTH_SCHEME = 'Bearer';
export const PRAVAH_LANGUAGE_CODES = new Set([
  'as', 'as-IN',
  'bn', 'bn-IN',
  'brx', 'brx-IN',
  'doi', 'doi-IN',
  'en', 'en-IN',
  'gom', 'gom-IN',
  'gu', 'gu-IN',
  'hi', 'hi-IN',
  'kn', 'kn-IN',
  'ks-ar-IN',
  'ks-dn-IN',
  'mai', 'mai-IN',
  'ml', 'ml-IN',
  'mni', 'mni-IN',
  'mr', 'mr-IN',
  'ne', 'ne-IN',
  'or', 'or-IN',
  'pa', 'pa-IN',
  'sa', 'sa-IN',
  'sat', 'sat-IN',
  'sd-dn-IN',
  'ta', 'ta-IN',
  'te', 'te-IN',
  'ur', 'ur-IN',
]);

export const isPravahLanguage = code =>
  PRAVAH_LANGUAGE_CODES.has(String(code ?? ''));

export const authHeaders = key => ({ Authorization: `${AUTH_SCHEME} ${key}` });

const item = (text, to, from) => (from ? { text, to, from } : { text, to });

export function buildDirectTranslateBody(texts, { to, from = '' } = {}) {
  return texts.map(text => item(text, to, from));
}

export function buildProxyTranslateBody(texts, { to, from = '' } = {}) {
  return { items: buildDirectTranslateBody(texts, { to, from }) };
}

export function classifyStatus(status) {
  const code = Number(status ?? 0);
  if (code >= 200 && code < 300) {
    return null;
  }
  if (code === 401 || code === 403) {
    return ERROR_KIND.UNAUTHORIZED;
  }
  if (code === 413) {
    return ERROR_KIND.TEXT_TOO_LARGE;
  }
  if (code === 422) {
    return ERROR_KIND.UNSUPPORTED_LANGUAGE;
  }
  if (code === 429) {
    return ERROR_KIND.QUOTA_EXCEEDED;
  }
  if (code >= 500) {
    return ERROR_KIND.SERVER_ERROR;
  }
  if (code >= 400) {
    return ERROR_KIND.CLIENT_ERROR;
  }
  return ERROR_KIND.MALFORMED;
}

const ARRAY_KEYS = ['results', 'data', 'translations', 'items'];
function resolveItems(body) {
  if (Array.isArray(body)) {
    return body;
  }
  if (!body || typeof body !== 'object') {
    return null;
  }
  for (const key of ARRAY_KEYS) {
    if (Array.isArray(body[key])) {
      return body[key];
    }
  }
  return null;
}

function readItemText(entry) {
  if (typeof entry === 'string') {
    return entry;
  }
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  if (Array.isArray(entry.translations)) {
    const first = entry.translations[0];
    if (first === undefined) {
      return null;
    }
    if (typeof first === 'string') {
      return first;
    }
    return typeof first?.text === 'string' ? first.text : null;
  }
  if (typeof entry.text === 'string') {
    return entry.text;
  }
  if (typeof entry.translatedText === 'string') {
    return entry.translatedText;
  }
  return null;
}

export function readTranslations(body, expectedCount) {
  const items = resolveItems(body);
  if (!items) {
    return { ok: false, texts: [], errorKind: ERROR_KIND.MALFORMED };
  }
  if (items.length !== expectedCount) {
    return { ok: false, texts: [], errorKind: ERROR_KIND.COUNT_MISMATCH };
  }

  const texts = [];
  for (const entry of items) {
    const text = readItemText(entry);
    if (text === null) {
      return { ok: false, texts: [], errorKind: ERROR_KIND.MALFORMED };
    }
    texts.push(text.trim());
  }

  if (texts.every(text => !text)) {
    return { ok: false, texts: [], errorKind: ERROR_KIND.EMPTY_TRANSLATION };
  }

  return { ok: true, texts, errorKind: null };
}

export function readUpstreamError(body) {
  if (body && typeof body === 'object' && typeof body.error === 'string') {
    return body.error;
  }
  return '';
}
