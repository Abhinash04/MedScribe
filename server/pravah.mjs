// Upstream caller for the Pravah translatebulk API.
//
// Deliberately a sibling of anuvadini.mjs's callUpstream rather than an
// extension of it. That helper folds 422 into a generic UPSTREAM_ERROR and
// assumes an object payload; teaching it a status map and a bare-array body
// would put test-proxy.mjs at risk for no gain. ~40 duplicated lines is the
// cheaper trade.
//
// The response reader is IMPORTED from the app so the proxy and the app agree
// byte-for-byte on what a valid response is. That module is dependency-free and
// uses explicit .js extensions, so it loads cleanly under plain Node.

import {
  ERROR_KIND,
  readTranslations,
  readUpstreamError,
} from '../src/services/pravah/translationContract.js';

export const PRAVAH_TIMEOUT_MS = 60000;

export const PRAVAH_ERROR = {
  NOT_CONFIGURED: 'not_configured',
  UNAUTHORIZED: 'unauthorized',
  QUOTA_EXCEEDED: 'quota_exceeded',
  UNSUPPORTED_LANGUAGE: 'unsupported_language',
  BAD_REQUEST: 'bad_request',
  UPSTREAM_ERROR: 'upstream_error',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  MALFORMED: 'malformed',
  COUNT_MISMATCH: 'count_mismatch',
  EMPTY_TRANSLATION: 'empty_translation',
};

export function readPravahConfig(env = process.env) {
  return {
    url:
      env.PRAVAH_TRANSLATE_URL ||
      'https://pravahai.aicte-india.org/api/translatebulk',
    key: env.PRAVAH_API_KEY || '',
  };
}

const READ_ERROR_TO_PRAVAH = {
  [ERROR_KIND.COUNT_MISMATCH]: PRAVAH_ERROR.COUNT_MISMATCH,
  [ERROR_KIND.EMPTY_TRANSLATION]: PRAVAH_ERROR.EMPTY_TRANSLATION,
  [ERROR_KIND.MALFORMED]: PRAVAH_ERROR.MALFORMED,
};

function statusError(status) {
  if (status === 401 || status === 403) {
    return PRAVAH_ERROR.UNAUTHORIZED;
  }
  if (status === 429) {
    return PRAVAH_ERROR.QUOTA_EXCEEDED;
  }
  if (status === 422) {
    return PRAVAH_ERROR.UNSUPPORTED_LANGUAGE;
  }
  if (status === 400) {
    return PRAVAH_ERROR.BAD_REQUEST;
  }
  return PRAVAH_ERROR.UPSTREAM_ERROR;
}

export async function translateBulk(
  { items },
  {
    config = readPravahConfig(),
    fetchImpl = fetch,
    timeoutMs = PRAVAH_TIMEOUT_MS,
  } = {},
) {
  const startedAt = Date.now();
  const done = extra => ({ ms: Date.now() - startedAt, ...extra });

  if (!config.url || !config.key) {
    return done({ ok: false, error: PRAVAH_ERROR.NOT_CONFIGURED });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

  // The documented body is a bare array. `from` is omitted when absent so the
  // upstream auto-detects rather than being told something possibly wrong.
  const payload = items.map(({ text, to, from }) =>
    from ? { text, to, from } : { text, to },
  );

  let response;
  try {
    response = await fetchImpl(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    const aborted = controller.signal.aborted;
    return done({
      ok: false,
      error: aborted ? PRAVAH_ERROR.TIMEOUT : PRAVAH_ERROR.NETWORK,
    });
  } finally {
    clearTimeout(timer);
  }

  const status = response.status;

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    // Logged, never forwarded: the upstream message can quote the request,
    // which includes the API key.
    const detail = readUpstreamError(body);
    if (detail) {
      console.warn(`[proxy] pravah ${status}: ${detail}`);
    }
    return done({ ok: false, error: statusError(status), status });
  }

  const read = readTranslations(body, items.length);
  if (!read.ok) {
    return done({
      ok: false,
      error: READ_ERROR_TO_PRAVAH[read.errorKind] ?? PRAVAH_ERROR.MALFORMED,
      status,
    });
  }

  return done({ ok: true, texts: read.texts, status });
}
