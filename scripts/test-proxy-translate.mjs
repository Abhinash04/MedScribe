
// Any real network call from this suite is a bug, not a slow test.
globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import {
  MAX_TRANSLATE_CHARS,
  MAX_TRANSLATE_ITEMS,
  REQUEST_ERROR,
  handleTranslate,
} from '../server/index.mjs';
import { PRAVAH_ERROR, readPravahConfig } from '../server/pravah.mjs';
import { readTranslations } from '../src/services/pravah/translationContract.js';

import { check, report } from './lib/fixture-harness.mjs';

const KEY = 'proxy-key-do-not-log';
const CONFIG = { url: 'https://upstream.test/api/translatebulk', key: KEY };
const ITEMS = [
  { text: 'बुखार है।', to: 'en' },
  { text: 'खांसी भी है।', to: 'en' },
];
const EN = ['Fever is there.', 'Cough is also there.'];

const wrap = texts => texts.map(text => ({ translations: [{ text }] }));

const fakeFetch = (status, body, { throws = null } = {}) => {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    if (throws) {
      throw throws;
    }
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => {
        if (body === 'INVALID') {
          throw new Error('Unexpected token');
        }
        return body;
      },
    };
  };
  impl.calls = calls;
  return impl;
};

const call = (body, fetchImpl) =>
  handleTranslate(body, { config: CONFIG, fetchImpl });

// Silence the deliberate upstream-error logging below.
const originalWarn = console.warn;
console.warn = () => {};

// PT1 — the success path and the upstream wire shape

{
  const fetchImpl = fakeFetch(200, wrap(EN));
  const result = await call({ items: ITEMS }, fetchImpl);

  check('PT1.1 success status', result.status, 200);
  check('PT1.2 success flag', result.body.success, true);
  check('PT1.3 one upstream call', fetchImpl.calls.length, 1);

  const sent = fetchImpl.calls[0];
  const payload = JSON.parse(sent.init.body);
  check('PT1.4 posts to the configured URL', sent.url, CONFIG.url);
  check('PT1.5 the upstream body is a BARE ARRAY', Array.isArray(payload), true);
  check('PT1.6 one item per text', payload.length, 2);
  check('PT1.7 no `from` when absent', Object.keys(payload[0]).sort(), ['text', 'to']);
  check('PT1.8 bearer attached upstream', sent.init.headers.Authorization, `Bearer ${KEY}`);
  check('PT1.9 json content type', sent.init.headers['Content-Type'], 'application/json');
}

{
  const fetchImpl = fakeFetch(200, wrap(EN));
  await call(
    { items: ITEMS.map(item => ({ ...item, from: 'hi-IN' })) },
    fetchImpl,
  );
  const payload = JSON.parse(fetchImpl.calls[0].init.body);
  check('PT1.10 `from` is forwarded when supplied', payload[0].from, 'hi-IN');
}

// PT2 — the round trip that proves the app needs no proxy special-casing
//
// The app's readTranslations must read the proxy's success body exactly as it
// reads the direct bare array. This is requirement satisfied by construction
// rather than by assertion.

{
  const result = await call({ items: ITEMS }, fakeFetch(200, wrap(EN)));
  const viaProxy = readTranslations(result.body, 2);
  const viaDirect = readTranslations(wrap(EN), 2);

  check('PT2.1 the proxy body is readable by the app', viaProxy.ok, true);
  check('PT2.2 with the same texts', viaProxy.texts, EN);
  check('PT2.3 identically to the direct shape', viaProxy, viaDirect);
}

// PT3 — validation, all rejecting before any upstream call

const long = Array.from({ length: MAX_TRANSLATE_ITEMS + 1 }, () => ({
  text: 'a',
  to: 'en',
}));
const heavy = [
  { text: 'x'.repeat(MAX_TRANSLATE_CHARS), to: 'en' },
  { text: 'y'.repeat(10), to: 'en' },
];

for (const [label, body, status, error] of [
  ['no items key', {}, 400, REQUEST_ERROR.MISSING_ITEMS],
  ['items is not an array', { items: 'nope' }, 400, REQUEST_ERROR.MISSING_ITEMS],
  ['items is empty', { items: [] }, 400, REQUEST_ERROR.MISSING_ITEMS],
  ['too many items', { items: long }, 413, REQUEST_ERROR.TOO_LARGE],
  [
    'a blank text',
    { items: [{ text: '   ', to: 'en' }] },
    400,
    REQUEST_ERROR.MISSING_TEXT,
  ],
  [
    'a non-string text',
    { items: [{ text: 7, to: 'en' }] },
    400,
    REQUEST_ERROR.MISSING_TEXT,
  ],
  ['a missing target', { items: [{ text: 'a' }] }, 400, REQUEST_ERROR.MISSING_LANGUAGE],
  [
    'a non-string from',
    { items: [{ text: 'a', to: 'en', from: 7 }] },
    400,
    REQUEST_ERROR.MISSING_LANGUAGE,
  ],
  ['an oversized batch', { items: heavy }, 413, REQUEST_ERROR.TOO_LARGE],
]) {
  const fetchImpl = fakeFetch(200, wrap(EN));
  const result = await call(body, fetchImpl);
  check(`PT3 ${label} -> ${status}`, result.status, status);
  check(`PT3 ${label} error code`, result.body.error, error);
  check(`PT3 ${label} calls nothing upstream`, fetchImpl.calls.length, 0);
}

// PT4 — upstream status mapping
//
// 429 passing through unchanged is the load-bearing case: it is what makes the
// app's quota latch fire on the proxy path exactly as it does on the direct one.

for (const [status, error, mapped] of [
  [401, PRAVAH_ERROR.UNAUTHORIZED, 502],
  [403, PRAVAH_ERROR.UNAUTHORIZED, 502],
  [429, PRAVAH_ERROR.QUOTA_EXCEEDED, 429],
  [422, PRAVAH_ERROR.UNSUPPORTED_LANGUAGE, 422],
  [400, PRAVAH_ERROR.BAD_REQUEST, 502],
  [500, PRAVAH_ERROR.UPSTREAM_ERROR, 502],
  [503, PRAVAH_ERROR.UPSTREAM_ERROR, 502],
]) {
  const result = await call(
    { items: ITEMS },
    fakeFetch(status, { error: `upstream said ${KEY}` }),
  );
  check(`PT4.${status} maps to ${mapped}`, result.status, mapped);
  check(`PT4.${status} error code`, result.body.error, error);
  check(`PT4.${status} is not a success`, result.body.success, false);
  check(
    `PT4.${status} never forwards the key`,
    JSON.stringify(result.body).includes(KEY),
    false,
  );
  check(
    `PT4.${status} never forwards the upstream message`,
    JSON.stringify(result.body).includes('upstream said'),
    false,
  );
}

check(
  'PT4.timeout',
  (
    await call(
      { items: ITEMS },
      fakeFetch(0, null, { throws: new Error('aborted') }),
    )
  ).status,
  502,
);

{
  // A genuine abort maps to TIMEOUT/504; the fake above cannot set
  // controller.signal.aborted, so it lands on NETWORK/502. Assert the code path
  // rather than the status.
  const result = await call(
    { items: ITEMS },
    fakeFetch(0, null, { throws: new Error('socket hang up') }),
  );
  check('PT4.network error code', result.body.error, PRAVAH_ERROR.NETWORK);
}

// PT5 — malformed upstream responses

check(
  'PT5.1 unparseable body',
  (await call({ items: ITEMS }, fakeFetch(200, 'INVALID'))).body.error,
  PRAVAH_ERROR.MALFORMED,
);
check(
  'PT5.2 wrong item count',
  (await call({ items: ITEMS }, fakeFetch(200, wrap(['only one'])))).body.error,
  PRAVAH_ERROR.COUNT_MISMATCH,
);
check(
  'PT5.3 a count mismatch is a 502',
  (await call({ items: ITEMS }, fakeFetch(200, wrap(['only one'])))).status,
  502,
);
check(
  'PT5.4 an all-blank response',
  (await call({ items: ITEMS }, fakeFetch(200, wrap(['', ' '])))).body.error,
  PRAVAH_ERROR.EMPTY_TRANSLATION,
);
check(
  'PT5.5 a partially blank response still succeeds',
  (await call({ items: ITEMS }, fakeFetch(200, wrap(['Fever.', ''])))).body
    .success,
  true,
);

// PT6 — configuration

{
  const fetchImpl = fakeFetch(200, wrap(EN));
  const result = await handleTranslate(
    { items: ITEMS },
    { config: { url: CONFIG.url, key: '' }, fetchImpl },
  );
  check('PT6.1 a missing key is not configured', result.body.error, PRAVAH_ERROR.NOT_CONFIGURED);
  check('PT6.2 and yields 503', result.status, 503);
  check('PT6.3 and calls nothing upstream', fetchImpl.calls.length, 0);
}

check(
  'PT6.4 the endpoint defaults when the env is empty',
  readPravahConfig({}).url,
  'https://pravahai.aicte-india.org/api/translatebulk',
);
check('PT6.5 no key by default', readPravahConfig({}).key, '');
check(
  'PT6.6 the env overrides the endpoint',
  readPravahConfig({ PRAVAH_TRANSLATE_URL: 'https://x.test/t' }).url,
  'https://x.test/t',
);
check(
  'PT6.7 and supplies the key',
  readPravahConfig({ PRAVAH_API_KEY: 'k' }).key,
  'k',
);

console.warn = originalWarn;

report();
