import { DICTATION_LANGUAGES } from '../../constants/languages.js';
import { ERROR_KIND } from './proxyContract.js';

export const SPEECH_REQUEST_FIELDS = {
  TEXT: 'text',
  LANGUAGE: 'lang',
  VOICE: 'language_voice',
  GENDER: 'gender',
};

export const DIRECT_SPEECH_REQUEST_FIELDS = {
  TEXT: 'text',
  LANGUAGE: 'lang',
  VOICE: 'languageVoice',
  GENDER: 'gender',
};

const VOICES = Object.fromEntries(
  DICTATION_LANGUAGES.filter(language => language.voice).map(language => [
    language.tag,
    { voice: language.voice, gender: language.gender },
  ]),
);

export function voiceFor(normalizedLanguage) {
  return VOICES[normalizedLanguage] || null;
}

export function buildSpeechRequestBody(text, normalizedLanguage, config) {
  return {
    [SPEECH_REQUEST_FIELDS.TEXT]: text,
    [SPEECH_REQUEST_FIELDS.LANGUAGE]: normalizedLanguage,
    [SPEECH_REQUEST_FIELDS.VOICE]: config.voice,
    [SPEECH_REQUEST_FIELDS.GENDER]: config.gender,
  };
}

export function buildDirectSpeechRequestBody(text, normalizedLanguage, config) {
  return {
    [DIRECT_SPEECH_REQUEST_FIELDS.TEXT]: text,
    [DIRECT_SPEECH_REQUEST_FIELDS.LANGUAGE]: normalizedLanguage,
    [DIRECT_SPEECH_REQUEST_FIELDS.VOICE]: config.voice,
    [DIRECT_SPEECH_REQUEST_FIELDS.GENDER]: config.gender,
  };
}

const AUDIO_KEYS = ['audio', 'audio_url', 'audioFile'];
const LOOKS_LIKE_URL = /^https?:\/\//i;
const firstString = candidates =>
  candidates.find(value => typeof value === 'string' && value.trim()) ??
  candidates.find(value => typeof value === 'string');

export function readAudio(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, errorKind: ERROR_KIND.MALFORMED };
  }
  if (body.success === false) {
    return { ok: false, errorKind: ERROR_KIND.SERVER_ERROR };
  }

  const found = firstString([
    ...AUDIO_KEYS.map(key => body[key]),
    ...AUDIO_KEYS.map(key => body.data?.[key]),
  ]);

  if (found === undefined) {
    return { ok: false, errorKind: ERROR_KIND.MALFORMED };
  }

  const audioBase64 = found.trim().replace(/^data:[^,]*,/, '');
  if (!audioBase64) {
    return { ok: false, errorKind: ERROR_KIND.EMPTY_SPEECH };
  }
  if (LOOKS_LIKE_URL.test(audioBase64)) {
    return { ok: false, errorKind: ERROR_KIND.MALFORMED };
  }

  return { ok: true, audioBase64 };
}
