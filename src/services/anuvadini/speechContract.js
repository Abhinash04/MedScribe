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

const VOICES = {
  'en-IN': { voice: 'en-IN-PrabhatNeural', gender: 'Female' },
};

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

/**
 * `audio_url` carries base64 in every response observed, but the name says it
 * may not, and decoding a link yields bytes that reach the player as noise.
 * A value that is actually a link is refused rather than decoded.
 */
const LOOKS_LIKE_URL = /^https?:\/\//i;

/**
 * Prefers a candidate with content, then settles for any string.
 *
 * The two-pass shape matters: `{audio: '   ', audioFile: '<real>'}` must still
 * find the real one, while `{audio: '   '}` alone has to reach the trim check
 * below so it reads as an empty result rather than a malformed response.
 */
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
