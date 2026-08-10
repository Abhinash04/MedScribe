export const TRANSPORT = {
  DIRECT: 'direct',
  PROXY: 'proxy',
  NONE: 'none',
};

export const TRANSCRIPTION_TRANSPORT = TRANSPORT.DIRECT;
export const ANUVADINI_STT_URL =
  'https://anuvadini-services.aicte-india.org/api/voice-to-text';
export const ANUVADINI_TTS_URL =
  'https://anuvadini-services.aicte-india.org/api/text-to-speech';

const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;

export const MEDSCRIBE_PROXY_BASE_URL = isDevBuild ? 'http://localhost:8787' : '';
export const VOICE_TO_TEXT_PATH = '/voice-to-text';
export const TEXT_TO_SPEECH_PATH = '/text-to-speech';

const proxyUrl = path => `${MEDSCRIBE_PROXY_BASE_URL.replace(/\/+$/, '')}${path}`;

export function proxyVoiceToTextUrl() {
  return proxyUrl(VOICE_TO_TEXT_PATH);
}

export function proxyTextToSpeechUrl() {
  return proxyUrl(TEXT_TO_SPEECH_PATH);
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
