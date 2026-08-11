// HTTP client for the Pravah translatebulk API.
//
// ⚠️ RETURN SHAPE DIFFERS FROM EVERY OTHER CLIENT IN THIS REPO.
// transcriptionClient and speechClient return { ok, text, errorKind }.
// This returns { ok, TEXTS, errorKind } — plural, index-parallel to the input.
// Never hand this result straight to store.setTranslationResult:
// applyTranslation reads `.text` and would mark a good result FAILED.
// Joining happens in transcriptTranslation.runTranslation.
//
// It takes an ARRAY, not a string. The API is inherently bulk; a string-taking
// client would tempt callers into N sequential requests, which is the fastest
// way to burn a key's quota.
//
// It speaks PRAVAH codes ('gom-IN'), not our codes ('kok'). Mapping is the
// caller's job via translationCodeFor, which is what lets the prompt-catalog
// seeder — which runs English -> Indic — reuse this client unchanged.

import {
  PRAVAH_TRANSLATE_URL,
  TRANSPORT,
  proxyTranslateUrl,
  resolveTranslationTransport,
} from '../../config/endpoints.js';
import {
  ERROR_KIND,
  authHeaders,
  buildDirectTranslateBody,
  buildProxyTranslateBody,
  classifyStatus,
  isPravahLanguage,
  readTranslations,
} from './translationContract.js';

export const REQUEST_TIMEOUT_MS = 60000;

export const MAX_ITEM_CHARS = 4000;
export const MAX_BATCH_CHARS = 12000;
export const MAX_BATCH_ITEMS = 25;

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
        Accept: 'application/json',
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

const failed = errorKind => ({ ok: false, texts: [], errorKind });

export async function translateTexts({
  texts,
  to,
  from = '',
  signal,
  transport = fetchTransport,
  url,
  key = '',
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  // Every guard returns before `transport` is called, so a fixture can assert
  // transport.calls.length === 0 — that ordering is what keeps CI offline.
  if (signal?.aborted) {
    return failed(ERROR_KIND.CANCELLED);
  }
  if (!Array.isArray(texts) || texts.length === 0) {
    return failed(ERROR_KIND.NO_TEXT);
  }
  if (texts.some(text => typeof text !== 'string')) {
    return failed(ERROR_KIND.MALFORMED);
  }
  if (texts.every(text => !text.trim())) {
    return failed(ERROR_KIND.NO_TEXT);
  }
  if (texts.length > MAX_BATCH_ITEMS) {
    return failed(ERROR_KIND.TEXT_TOO_LARGE);
  }
  if (texts.some(text => text.length > MAX_ITEM_CHARS)) {
    return failed(ERROR_KIND.TEXT_TOO_LARGE);
  }
  if (texts.reduce((sum, text) => sum + text.length, 0) > MAX_BATCH_CHARS) {
    return failed(ERROR_KIND.TEXT_TOO_LARGE);
  }
  if (!isPravahLanguage(to)) {
    return failed(ERROR_KIND.UNSUPPORTED_LANGUAGE);
  }
  if (from && !isPravahLanguage(from)) {
    return failed(ERROR_KIND.UNSUPPORTED_LANGUAGE);
  }

  const mode = resolveTranslationTransport(key);
  if (mode === TRANSPORT.NONE) {
    return failed(ERROR_KIND.NOT_CONFIGURED);
  }

  const direct = mode === TRANSPORT.DIRECT;
  const endpoint = url || (direct ? PRAVAH_TRANSLATE_URL : proxyTranslateUrl());
  if (!endpoint) {
    return failed(ERROR_KIND.NOT_CONFIGURED);
  }

  let response;
  try {
    response = await transport({
      url: endpoint,
      // Direct is a bare array; the proxy wraps it and holds the key itself.
      body: direct
        ? buildDirectTranslateBody(texts, { to, from })
        : buildProxyTranslateBody(texts, { to, from }),
      headers: direct ? authHeaders(key) : undefined,
      signal,
      timeoutMs,
    });
  } catch (error) {
    return failed(classifyThrown(error, signal));
  }

  const statusError = classifyStatus(response?.status);
  if (statusError) {
    return failed(statusError);
  }

  return readTranslations(response?.body, texts.length);
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
