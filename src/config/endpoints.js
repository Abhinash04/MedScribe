/**
 * Where transcription requests go, and how.
 *
 * The transport is declared rather than inferred from whichever URL happens to
 * be populated — a debug default silently winning on a physical device is
 * exactly the kind of surprise that costs a test cycle.
 */

export const TRANSPORT = {
  /** Straight to Anuvadini with the Bearer token built into the app. */
  DIRECT: 'direct',
  /** Through our own service, which holds the credential. */
  PROXY: 'proxy',
  /** No endpoint; the alternative transcription is unavailable. */
  NONE: 'none',
};

/**
 * Internal testing calls Anuvadini directly, with the credential injected at
 * build time. Deploying `server/` later means changing this one value to
 * PROXY and dropping the token from the build — no feature code moves.
 */
export const TRANSCRIPTION_TRANSPORT = TRANSPORT.DIRECT;

/** The upstream service. Public, and not a secret. */
export const ANUVADINI_STT_URL =
  'https://anuvadini-services.aicte-india.org/api/voice-to-text';

/**
 * Speech synthesis, on the same host and behind the same credential.
 *
 * Sharing `resolveTransport` with transcription is deliberate: a build that
 * cannot transcribe cannot speak either, and one switch moves both to the
 * proxy.
 */
export const ANUVADINI_TTS_URL =
  'https://anuvadini-services.aicte-india.org/api/text-to-speech';

/**
 * Our own proxy, for local development and a future production deployment.
 * Only consulted when the transport is PROXY, so this can hold a localhost
 * default without ever affecting a direct-mode build.
 */
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

/**
 * The transport actually usable right now.
 *
 * A declared transport whose requirement is missing — a direct build with no
 * token, a proxy build with no URL — degrades to NONE rather than sending a
 * request that cannot succeed.
 */
export function resolveTransport(token) {
  if (TRANSCRIPTION_TRANSPORT === TRANSPORT.DIRECT) {
    return token ? TRANSPORT.DIRECT : TRANSPORT.NONE;
  }
  if (TRANSCRIPTION_TRANSPORT === TRANSPORT.PROXY) {
    return MEDSCRIBE_PROXY_BASE_URL ? TRANSPORT.PROXY : TRANSPORT.NONE;
  }
  return TRANSPORT.NONE;
}
