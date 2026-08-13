globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DICTATION_LANGUAGES } from '../src/constants/languages.js';
import {
  ERROR_KIND,
  PRAVAH_LANGUAGE_CODES,
  authHeaders,
  buildDirectTranslateBody,
  buildProxyTranslateBody,
  classifyStatus,
  isPravahLanguage,
  readTranslations,
  readUpstreamError,
} from '../src/services/pravah/translationContract.js';
import {
  MAX_BATCH_CHARS,
  MAX_BATCH_ITEMS,
  MAX_ITEM_CHARS,
  translateTexts,
} from '../src/services/pravah/translationClient.js';
import {
  DEFAULT_CHUNK_CHARS,
  joinTranslated,
  planBatches,
  splitForTranslation,
} from '../src/services/pravah/chunkText.js';

import { check, report } from './lib/fixture-harness.mjs';

const KEY = 'pravah-key-do-not-log';
const HI = ['बुखार है।', 'खांसी भी है।', 'तीन दिन से।'];
const EN = ['Fever is there.', 'Cough is also there.', 'For three days.'];

const wrap = texts => texts.map(text => ({ translations: [{ text }] }));

const fake = (status, body, { throws = null } = {}) => {
  const calls = [];
  const impl = async args => {
    calls.push(args);
    if (throws) {
      throw throws;
    }
    return { status, body };
  };
  impl.calls = calls;
  return impl;
};

const run = (transport, extra = {}) =>
  translateTexts({ texts: HI, to: 'en', key: KEY, transport, ...extra });

{
  const transport = fake(200, wrap(EN));
  const result = await run(transport);

  check('PR1.1 ok', result.ok, true);
  check('PR1.2 texts come back in order', result.texts, EN);
  check('PR1.3 no error kind on success', result.errorKind, null);
  check('PR1.4 one request', transport.calls.length, 1);

  const sent = transport.calls[0];
  check(
    'PR1.5 posts to translatebulk',
    sent.url.endsWith('/api/translatebulk'),
    true,
  );
  check('PR1.6 bearer attached in direct mode', sent.headers.Authorization, `Bearer ${KEY}`);
  check('PR1.7 the body is a BARE ARRAY', Array.isArray(sent.body), true);
  check('PR1.8 one array item per text', sent.body.length, 3);
  check('PR1.9 no `from` when it is not supplied', Object.keys(sent.body[0]).sort(), [
    'text',
    'to',
  ]);
  check('PR1.10 target is English', sent.body[0].to, 'en');
  check('PR1.11 source text is sent verbatim', sent.body[0].text, HI[0]);
}

{
  const transport = fake(200, wrap(EN));
  await run(transport, { from: 'hi-IN' });
  check(
    'PR1.12 `from` is sent when supplied',
    Object.keys(transport.calls[0].body[0]).sort(),
    ['from', 'text', 'to'],
  );
  check('PR1.13 and carries the pravah code', transport.calls[0].body[0].from, 'hi-IN');
}

{
  const transport = fake(200, wrap(['first', '', 'third']));
  const result = await run(transport);
  check('PR2.1 a blank in the middle holds its slot', result.texts, [
    'first',
    '',
    'third',
  ]);
  check('PR2.2 and the run still succeeds', result.ok, true);
}

for (const [label, body] of [
  ['bare array', wrap(EN)],
  ['results wrapper', { results: wrap(EN) }],
  ['data wrapper', { data: wrap(EN) }],
  ['translations wrapper', { translations: wrap(EN) }],
  ['items wrapper', { items: wrap(EN) }],
  ['flat text', EN.map(text => ({ text }))],
  ['translatedText', EN.map(text => ({ translatedText: text }))],
  ['bare strings', EN],
]) {
  const result = await run(fake(200, body));
  check(`PR3 ${label} reads`, result.texts, EN);
}

check(
  'PR3.9 whitespace is trimmed',
  (await run(fake(200, wrap(['  a  ', ' b ', 'c'])))).texts,
  ['a', 'b', 'c'],
);

for (const [status, kind] of [
  [400, ERROR_KIND.CLIENT_ERROR],
  [401, ERROR_KIND.UNAUTHORIZED],
  [403, ERROR_KIND.UNAUTHORIZED],
  [413, ERROR_KIND.TEXT_TOO_LARGE],
  [422, ERROR_KIND.UNSUPPORTED_LANGUAGE],
  [429, ERROR_KIND.QUOTA_EXCEEDED],
  [500, ERROR_KIND.SERVER_ERROR],
  [503, ERROR_KIND.SERVER_ERROR],
]) {
  const result = await run(fake(status, { error: `boom ${KEY}` }));
  check(`PR4.${status} maps to ${kind}`, result.errorKind, kind);
  check(`PR4.${status} is not ok`, result.ok, false);
  check(`PR4.${status} returns no texts`, result.texts, []);
  check(
    `PR4.${status} never leaks the key`,
    JSON.stringify(result).includes(KEY),
    false,
  );
}

check(
  'PR4.net a thrown network error',
  (await run(fake(0, null, { throws: new Error('connection refused') })))
    .errorKind,
  ERROR_KIND.NETWORK,
);
check(
  'PR4.timeout a thrown timeout',
  (await run(fake(0, null, { throws: new Error('timeout') }))).errorKind,
  ERROR_KIND.TIMEOUT,
);
check(
  'PR4.abort an abort with no signal is a timeout',
  (await run(fake(0, null, { throws: new Error('Aborted') }))).errorKind,
  ERROR_KIND.TIMEOUT,
);
check(
  'PR4.cancel an abort with a raised signal is a cancellation',
  (
    await run(
      options => {
        if (options.signal) {
          options.signal._aborted = true;
        }
        throw new Error('Aborted');
      },
      {
        signal: {
          _aborted: false,
          get aborted() {
            return this._aborted;
          },
          addEventListener() {},
          removeEventListener() {},
        },
      },
    )
  ).errorKind,
  ERROR_KIND.CANCELLED,
);

check('PR5.1 null body', (await run(fake(200, null))).errorKind, ERROR_KIND.MALFORMED);
check(
  'PR5.2 an error object at 200',
  (await run(fake(200, { error: 'Invalid API key' }))).errorKind,
  ERROR_KIND.MALFORMED,
);
{
  const result = await run(fake(200, { error: `rejected key ${KEY}` }));
  check(
    'PR5.3 the upstream message never reaches the result',
    JSON.stringify(result).includes(KEY),
    false,
  );
}
check(
  'PR5.4 too few items',
  (await run(fake(200, wrap(['a', 'b'])))).errorKind,
  ERROR_KIND.COUNT_MISMATCH,
);
check(
  'PR5.5 too many items',
  (await run(fake(200, wrap(['a', 'b', 'c', 'd'])))).errorKind,
  ERROR_KIND.COUNT_MISMATCH,
);
check(
  'PR5.6 an item with an empty translations array',
  (await run(fake(200, [{ translations: [] }, ...wrap(['b', 'c'])]))).errorKind,
  ERROR_KIND.MALFORMED,
);
check(
  'PR5.7 an item with no readable text',
  (await run(fake(200, [{ nope: 1 }, ...wrap(['b', 'c'])]))).errorKind,
  ERROR_KIND.MALFORMED,
);
check(
  'PR5.8 every item blank',
  (await run(fake(200, wrap(['', '  ', ''])))).errorKind,
  ERROR_KIND.EMPTY_TRANSLATION,
);
check('PR5.9 readUpstreamError reads the message', readUpstreamError({ error: 'x' }), 'x');
check('PR5.10 and tolerates a non-object', readUpstreamError(null), '');

const big = 'x'.repeat(MAX_ITEM_CHARS + 1);
const many = Array.from({ length: MAX_BATCH_ITEMS + 1 }, () => 'a');
const heavy = Array.from({ length: 4 }, () => 'y'.repeat(MAX_BATCH_CHARS / 3));

for (const [label, extra, kind] of [
  ['an empty array', { texts: [] }, ERROR_KIND.NO_TEXT],
  ['a null array', { texts: null }, ERROR_KIND.NO_TEXT],
  ['all-blank texts', { texts: ['', '  '] }, ERROR_KIND.NO_TEXT],
  ['a non-string member', { texts: ['a', 7] }, ERROR_KIND.MALFORMED],
  ['too many items', { texts: many }, ERROR_KIND.TEXT_TOO_LARGE],
  ['an oversized item', { texts: [big] }, ERROR_KIND.TEXT_TOO_LARGE],
  ['an oversized batch', { texts: heavy }, ERROR_KIND.TEXT_TOO_LARGE],
  ['a foreign target', { to: 'fr' }, ERROR_KIND.UNSUPPORTED_LANGUAGE],
  ['an unknown source', { from: 'zz' }, ERROR_KIND.UNSUPPORTED_LANGUAGE],
  ['an already-aborted signal', { signal: { aborted: true } }, ERROR_KIND.CANCELLED],
]) {
  const transport = fake(200, wrap(EN));
  const result = await run(transport, extra);
  check(`PR6 ${label} -> ${kind}`, result.errorKind, kind);
  check(`PR6 ${label} sends nothing`, transport.calls.length, 0);
}

{
  const result = await translateTexts({ texts: HI, to: 'en', key: '' });
  check('PR6.11 no key, no proxy -> NOT_CONFIGURED', result.errorKind, ERROR_KIND.NOT_CONFIGURED);
}

check('PR7.1 empty text yields no chunks', splitForTranslation(''), []);
check('PR7.2 whitespace yields no chunks', splitForTranslation('   \n  '), []);
check(
  'PR7.3 a short transcript is one chunk',
  splitForTranslation('Fever is there. Cough too.'),
  ['Fever is there. Cough too.'],
);

const sentenceLen = Math.floor(DEFAULT_CHUNK_CHARS / 2) + 10;
for (const [label, terminator] of [
  ['danda', '।'],
  ['double danda', '॥'],
  ['urdu full stop', '۔'],
  ['arabic question mark', '؟'],
  ['ol chiki', '᱾'],
  ['ol chiki double', '᱿'],
  ['full stop', '.'],
  ['question mark', '?'],
  ['exclamation', '!'],
]) {
  const a = `${'क'.repeat(sentenceLen)}${terminator}`;
  const b = `${'ख'.repeat(sentenceLen)}${terminator}`;
  check(`PR7.4 ${label} splits sentences`, splitForTranslation(`${a} ${b}`).length, 2);
}

{
  const sentence = `${'शब्द '.repeat(60).trim()}।`;
  const source = Array.from({ length: 8 }, () => sentence).join(' ');
  const chunks = splitForTranslation(source);

  check('PR7.5 a long transcript splits', chunks.length > 1, true);
  check(
    'PR7.6 no chunk exceeds the cap',
    chunks.filter(chunk => chunk.length > DEFAULT_CHUNK_CHARS),
    [],
  );
  check(
    'PR7.7 reassembly is lossless modulo whitespace',
    chunks.join(' ').replace(/\s+/g, ' '),
    source.replace(/\s+/g, ' '),
  );
}

{
  const runOn = 'word '.repeat(400).trim();
  const chunks = splitForTranslation(runOn);
  check('PR7.8 a run-on sentence is hard-split', chunks.length > 1, true);
  check(
    'PR7.9 and no chunk exceeds the cap',
    chunks.filter(chunk => chunk.length > DEFAULT_CHUNK_CHARS),
    [],
  );
  check(
    'PR7.10 without breaking a word',
    chunks.filter(chunk => !/^(?:word)(?: word)*$/.test(chunk)),
    [],
  );
}

{
  const chunks = Array.from({ length: 60 }, (_, i) => `chunk ${i}`);
  const batches = planBatches(chunks, { maxItems: 25, maxChars: 12000 });
  check('PR7.11 batches respect the item cap', batches.length, 3);
  check(
    'PR7.12 no batch exceeds the item cap',
    batches.filter(batch => batch.length > 25),
    [],
  );
  check(
    'PR7.13 every chunk survives batching',
    batches.flat(),
    chunks,
  );
}

{
  const chunks = Array.from({ length: 6 }, () => 'z'.repeat(500));
  const batches = planBatches(chunks, { maxItems: 25, maxChars: 1200 });
  check('PR7.14 batches respect the character cap', batches.length, 3);
  check(
    'PR7.15 no batch exceeds the character cap',
    batches.filter(
      batch => batch.reduce((sum, chunk) => sum + chunk.length, 0) > 1200,
    ),
    [],
  );
}

check('PR7.16 no chunks means no batches', planBatches([]), []);

check(
  'PR7.17 joining is single-spaced',
  joinTranslated(['Fever is there.', 'Cough too.']),
  'Fever is there. Cough too.',
);
check(
  'PR7.18 joining drops blanks rather than doubling spaces',
  joinTranslated(['Fever is there.', '', '  ', 'Cough too.']),
  'Fever is there. Cough too.',
);
check('PR7.19 joining nothing is empty', joinTranslated([]), '');
check('PR7.20 joining a non-array is empty', joinTranslated(null), '');
check(
  'PR7.21 no ".X" seam at a chunk join',
  /\.\S/.test(joinTranslated(['A.', 'B.'])),
  false,
);

check(
  'PR8.1 every translation code is one the API accepts',
  DICTATION_LANGUAGES.filter(l => !isPravahLanguage(l.translationCode)).map(
    l => l.code,
  ),
  [],
);
check('PR8.2 foreign languages are not exposed', PRAVAH_LANGUAGE_CODES.has('fr'), false);
check('PR8.3 nor is an unknown code', isPravahLanguage('zz-ZZ'), false);
check('PR8.4 English is accepted', isPravahLanguage('en'), true);
check('PR8.5 Konkani is accepted as gom-IN', isPravahLanguage('gom-IN'), true);

check('PR8.6 2xx is not an error', classifyStatus(200), null);
check('PR8.7 an unknown low status is malformed', classifyStatus(0), ERROR_KIND.MALFORMED);
check('PR8.8 auth header shape', authHeaders(KEY), { Authorization: `Bearer ${KEY}` });
check(
  'PR8.9 the proxy body wraps the same items',
  buildProxyTranslateBody(['a'], { to: 'en' }),
  { items: buildDirectTranslateBody(['a'], { to: 'en' }) },
);
check(
  'PR8.10 readTranslations is shared with the proxy shape',
  readTranslations({ results: wrap(EN) }, 3).texts,
  EN,
);


const SECRET = /apk_[A-Za-z0-9_-]{8,}/;
const SKIP = new Set(['node_modules', '.git', 'build', 'gradle']);
const IGNORED_FILES = new Set(['.env', 'local.properties']);
const SCANNED = /\.(js|jsx|mjs|ts|kt|gradle|json|md|example|properties|ya?ml)$/;

function walk(dir, found = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (SKIP.has(entry)) {
      continue;
    }
    const path = join(dir, entry);
    let info;
    try {
      info = lstatSync(path);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      walk(path, found);
    } else if (!info.isSymbolicLink() && !IGNORED_FILES.has(entry) && SCANNED.test(entry)) {
      try {
        if (SECRET.test(readFileSync(path, 'utf8'))) {
          found.push(path);
        }
      } catch {
        // Unreadable file: nothing to assert.
      }
    }
  }
  return found;
}

check(
  'PR9.1 no committed Pravah API key',
  walk('.'),
  [],
);
check(
  'PR9.2 the scan pattern matches a real key shape',
  SECRET.test(`${'apk'}_0123456789ab`),
  true,
);
check('PR9.3 and not the test key', SECRET.test(KEY), false);

report();
