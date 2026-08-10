import {
  ANUVADINI_TTS_URL,
  TRANSPORT,
  proxyTextToSpeechUrl,
  resolveTransport,
} from '../../config/endpoints.js';
import { normalizeAnuvadiniLanguage } from './language.js';
import { ERROR_KIND } from './proxyContract.js';
import {
  buildDirectSpeechRequestBody,
  buildSpeechRequestBody,
  readAudio,
  voiceFor,
} from './speechContract.js';

export const SPEECH_TIMEOUT_MS = 15000;

export const MAX_SPEECH_CHARS = 600;

async function fetchTransport({ url, body, headers, signal, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

  const onAbort = () => controller.abort('cancelled');
  signal?.addEventListener?.('abort', onAbort);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
        ...headers,
      },
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

const failed = errorKind => ({ ok: false, audioBase64: '', errorKind });

export async function synthesize({
  text,
  language,
  signal,
  transport = fetchTransport,
  url,
  token = '',
  timeoutMs = SPEECH_TIMEOUT_MS,
}) {
  const spoken = String(text ?? '').trim();
  if (!spoken) {
    return failed(ERROR_KIND.NO_TEXT);
  }
  if (spoken.length > MAX_SPEECH_CHARS) {
    return failed(ERROR_KIND.NO_TEXT);
  }

  if (signal?.aborted) {
    return failed(ERROR_KIND.CANCELLED);
  }

  const normalized = normalizeAnuvadiniLanguage(language);
  const config = normalized ? voiceFor(normalized) : null;
  if (!config) {
    return failed(ERROR_KIND.UNSUPPORTED_LANGUAGE);
  }

  const mode = resolveTransport(token);
  if (mode === TRANSPORT.NONE) {
    return failed(ERROR_KIND.NOT_CONFIGURED);
  }

  const direct = mode === TRANSPORT.DIRECT;
  const endpoint = url || (direct ? ANUVADINI_TTS_URL : proxyTextToSpeechUrl());
  if (!endpoint) {
    return failed(ERROR_KIND.NOT_CONFIGURED);
  }

  let response;
  try {
    response = await transport({
      url: endpoint,
      body: direct
        ? buildDirectSpeechRequestBody(spoken, normalized, config)
        : buildSpeechRequestBody(spoken, normalized, config),
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

  const read = readAudio(response?.body);
  return read.ok
    ? { ok: true, audioBase64: read.audioBase64, errorKind: null }
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
