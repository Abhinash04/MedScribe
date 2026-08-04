import {
  isTranscriptionProxyConfigured,
  voiceToTextUrl,
} from '../../config/endpoints.js';
import { MAX_UPLOAD_BYTES, base64CharsFor } from '../audioBudget.js';
import { normalizeAnuvadiniLanguage } from './language.js';
import {
  buildRequestBody,
  ERROR_KIND,
  readTranscription,
} from './proxyContract.js';

/**
 * Sends captured audio to the MedScribe proxy and returns the transcript.
 *
 * Never throws: every failure becomes `{ ok: false, errorKind }`, because a
 * refinement that fails must leave the consultation exactly as it was. The
 * transport is injected so the whole path is exercisable without a server.
 */

/**
 * Longer than the proxy's own 60 s upstream budget. Giving up first would throw
 * away a transcription the backend had already paid for and completed.
 */
export const REQUEST_TIMEOUT_MS = 75000;

/**
 * Derived from the capture budget rather than declared separately, so the
 * client cannot start rejecting audio the capture layer thought was fine.
 * Provisional until the backend publishes its own limit.
 */
export const MAX_AUDIO_BASE64_CHARS = base64CharsFor(MAX_UPLOAD_BYTES);

async function fetchTransport({ url, body, signal, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

  const onAbort = () => controller.abort('cancelled');
  signal?.addEventListener?.('abort', onAbort);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let parsed = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }

    return { status: response.status, body: parsed };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

const failed = errorKind => ({ ok: false, text: '', errorKind });

export async function transcribe({
  audioBase64,
  language,
  signal,
  transport = fetchTransport,
  url,
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  if (!audioBase64) {
    return failed(ERROR_KIND.NO_AUDIO);
  }
  if (audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
    return failed(ERROR_KIND.AUDIO_TOO_LARGE);
  }

  const normalized = normalizeAnuvadiniLanguage(language);
  if (!normalized) {
    return failed(ERROR_KIND.UNSUPPORTED_LANGUAGE);
  }

  const endpoint = url || (isTranscriptionProxyConfigured() ? voiceToTextUrl() : '');
  if (!endpoint) {
    return failed(ERROR_KIND.NOT_CONFIGURED);
  }

  let response;
  try {
    response = await transport({
      url: endpoint,
      body: buildRequestBody(audioBase64, normalized),
      signal,
      timeoutMs,
    });
  } catch (error) {
    return failed(classifyThrown(error, signal));
  }

  const status = response?.status ?? 0;
  if (status >= 500) {
    return failed(ERROR_KIND.SERVER_ERROR);
  }
  if (status >= 400) {
    return failed(ERROR_KIND.CLIENT_ERROR);
  }

  const read = readTranscription(response?.body);
  return read.ok ? { ok: true, text: read.text, errorKind: null } : failed(read.errorKind);
}

/**
 * An abort is either our timeout or the doctor leaving, and the two mean
 * different things to the UI — one offers Retry, the other says nothing.
 */
function classifyThrown(error, signal) {
  if (signal?.aborted) {
    return ERROR_KIND.CANCELLED;
  }
  const reason = String(error?.message || error?.name || error || '').toLowerCase();
  if (reason.includes('timeout') || reason.includes('abort')) {
    return ERROR_KIND.TIMEOUT;
  }
  return ERROR_KIND.NETWORK;
}
