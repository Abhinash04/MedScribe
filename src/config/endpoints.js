/**
 * Non-secret service endpoints.
 *
 * The Anuvadini credential is NOT here and is not in the app at all: the phone
 * talks to the MedScribe proxy, and the proxy is what holds the Bearer token.
 * A base URL is not a secret, so it ships as a plain constant rather than
 * dragging in a native config package.
 */

/**
 * Debug builds talk to the proxy running on the developer's machine, reached
 * through `adb reverse tcp:8787 tcp:8787`. Release stays empty on purpose: a
 * shipped build must never be silently pointed at someone's laptop, and it
 * needs an HTTPS deployment rather than cleartext localhost.
 */
const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;

export const MEDSCRIBE_PROXY_BASE_URL = isDevBuild ? 'http://localhost:8787' : '';

export const VOICE_TO_TEXT_PATH = '/voice-to-text';

/** False until a proxy URL is configured, which keeps the feature dark. */
export function isTranscriptionProxyConfigured() {
  return !!MEDSCRIBE_PROXY_BASE_URL;
}

export function voiceToTextUrl() {
  return `${MEDSCRIBE_PROXY_BASE_URL.replace(/\/+$/, '')}${VOICE_TO_TEXT_PATH}`;
}
