import {
  ANUVADINI_STT_URL,
  TRANSPORT,
  proxyVoiceToTextUrl,
  resolveTransport,
} from '../../config/endpoints.js';
import { MAX_UPLOAD_BYTES, base64CharsFor } from '../audioBudget.js';
import { normalizeAnuvadiniLanguage } from './language.js';
import {
  buildDirectRequestBody,
  buildRequestBody,
  ERROR_KIND,
  readTranscription,
} from './proxyContract.js';

export const REQUEST_TIMEOUT_MS = 75000;
export const MAX_AUDIO_BASE64_CHARS = base64CharsFor(MAX_UPLOAD_BYTES);

async function fetchTransport({ url, body, headers, signal, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

  const onAbort = () => controller.abort('cancelled');
  signal?.addEventListener?.('abort', onAbort);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
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
  token = '',
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

  const mode = resolveTransport(token);
  if (mode === TRANSPORT.NONE) {
    return failed(ERROR_KIND.NOT_CONFIGURED);
  }

  const direct = mode === TRANSPORT.DIRECT;
  const endpoint = url || (direct ? ANUVADINI_STT_URL : proxyVoiceToTextUrl());
  if (!endpoint) {
    return failed(ERROR_KIND.NOT_CONFIGURED);
  }

  let response;
  try {
    response = await transport({
      url: endpoint,
      body: direct
        ? buildDirectRequestBody(audioBase64, normalized)
        : buildRequestBody(audioBase64, normalized),
      headers: direct ? { Authorization: `Bearer ${token}` } : undefined,
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
  return read.ok
    ? { ok: true, text: read.text, errorKind: null }
    : failed(read.errorKind);
}

function classifyThrown(error, signal) {
  if (signal?.aborted) {
    return ERROR_KIND.CANCELLED;
  }
  const reason = String(
    error?.message || error?.name || error || '',
  ).toLowerCase();
  if (reason.includes('timeout') || reason.includes('abort')) {
    return ERROR_KIND.TIMEOUT;
  }
  return ERROR_KIND.NETWORK;
}
