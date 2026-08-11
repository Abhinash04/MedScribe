export const TRANSPORT = {
  DIRECT: 'direct',
  PROXY: 'proxy',
  // Prefer a baked key, fall back to the dev proxy. Lets a developer swap the
  // Pravah key in server/.env with no rebuild and no code edit, while a release
  // build (where MEDSCRIBE_PROXY_BASE_URL is '') still goes direct.
  AUTO: 'auto',
  NONE: 'none',
};

export const TRANSCRIPTION_TRANSPORT = TRANSPORT.DIRECT;
export const ANUVADINI_STT_URL =
  'https://anuvadini-services.aicte-india.org/api/voice-to-text';
export const ANUVADINI_TTS_URL =
  'https://anuvadini-services.aicte-india.org/api/text-to-speech';
export const TRANSLATION_TRANSPORT = TRANSPORT.AUTO;
export const PRAVAH_TRANSLATE_URL =
  'https://pravahai.aicte-india.org/api/translatebulk';

const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;

export const MEDSCRIBE_PROXY_BASE_URL = isDevBuild ? 'http://localhost:8787' : '';
export const VOICE_TO_TEXT_PATH = '/voice-to-text';
export const TEXT_TO_SPEECH_PATH = '/text-to-speech';
export const TRANSLATE_PATH = '/translate';

const proxyUrl = path => `${MEDSCRIBE_PROXY_BASE_URL.replace(/\/+$/, '')}${path}`;

export function proxyVoiceToTextUrl() {
  return proxyUrl(VOICE_TO_TEXT_PATH);
}

export function proxyTextToSpeechUrl() {
  return proxyUrl(TEXT_TO_SPEECH_PATH);
}

export function proxyTranslateUrl() {
  return proxyUrl(TRANSLATE_PATH);
}

export function resolveTransport(token) {
  if (TRANSCRIPTION_TRANSPORT === TRANSPORT.DIRECT) {
    return token ? TRANSPORT.DIRECT : TRANSPORT.NONE;
  }
  if (TRANSCRIPTION_TRANSPORT === TRANSPORT.PROXY) {
    return MEDSCRIBE_PROXY_BASE_URL ? TRANSPORT.PROXY : TRANSPORT.NONE;
  }
  return TRANSPORT.NONE;
}

export function resolveTranslationTransport(key) {
  if (TRANSLATION_TRANSPORT === TRANSPORT.DIRECT) {
    return key ? TRANSPORT.DIRECT : TRANSPORT.NONE;
  }
  if (TRANSLATION_TRANSPORT === TRANSPORT.PROXY) {
    return MEDSCRIBE_PROXY_BASE_URL ? TRANSPORT.PROXY : TRANSPORT.NONE;
  }
  if (TRANSLATION_TRANSPORT === TRANSPORT.AUTO) {
    if (key) {
      return TRANSPORT.DIRECT;
    }
    if (MEDSCRIBE_PROXY_BASE_URL) {
      return TRANSPORT.PROXY;
    }
  }
  return TRANSPORT.NONE;
}
