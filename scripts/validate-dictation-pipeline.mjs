import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  joinTranslated,
  planBatches,
  splitForTranslation,
} from '../src/services/pravah/chunkText.js';
import {
  MAX_BATCH_CHARS,
  MAX_BATCH_ITEMS,
  translateTexts,
} from '../src/services/pravah/translationClient.js';
import {
  ERROR_KIND,
  PRAVAH_TARGET_ENGLISH,
} from '../src/services/pravah/translationContract.js';
import {
  CORPUS_LANGUAGES,
  EXPECTED,
  SAMPLE_IDS,
  STYLES,
  sampleFor,
} from './fixtures/dictation-samples.mjs';
import {
  protect,
  reconcile,
  restore,
  stripSentinels,
} from '../src/services/pravah/protectNumerals.js';
import {
  inferMissingYears,
  repairOrphanedYears,
} from '../src/services/pravah/repairDates.js';
import { translationCodeFor } from '../src/constants/languages.js';
import { flag } from './lib/cli-flags.mjs';
import { gradeReport } from './lib/dictation-grade.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURE_PATH = join(HERE, 'fixtures', 'pravah-dictation-capture.json');
const has = name => process.argv.includes(`--${name}`);
const DRY_RUN = has('dry-run');
const CAPTURE = has('capture');
const RAW = has('raw');
const SEND_FROM = has('from');
const DELAY_MS = Number(flag('delay') ?? 0);
const BOLD = s => `\x1b[1m${s}\x1b[0m`;
const GREEN = s => `\x1b[32m${s}\x1b[0m`;
const RED = s => `\x1b[31m${s}\x1b[0m`;
const rule = char => char.repeat(74);

const die = message => {
  console.error(message);
  process.exit(1);
};

const onlyLang = flag('lang');
const onlySample = flag('sample');

const languages = CORPUS_LANGUAGES.filter(entry => entry.code !== 'en').filter(
  entry => !onlyLang || onlyLang === 'all' || entry.code === onlyLang,
);
const sampleIds = SAMPLE_IDS.filter(
  id => !onlySample || onlySample === 'all' || String(id) === onlySample,
);

if (!languages.length) {
  die(`No corpus language matched --lang=${onlyLang}.`);
}
if (!sampleIds.length) {
  die(`No sample matched --sample=${onlySample}. Use 1..20 or all.`);
}

const totalCalls = languages.length * sampleIds.length;

function keyFromServerEnv() {
  const path = join(HERE, '..', 'server', '.env');
  if (!existsSync(path)) {
    return '';
  }
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^PRAVAH_API_KEY=(.*)$/.exec(line.trim());
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

const key = process.env.PRAVAH_API_KEY || keyFromServerEnv();

if (DRY_RUN) {
  console.log(
    `${languages.length} language(s) x ${sampleIds.length} sample(s) = ` +
      `${totalCalls} translation request(s).`,
  );
  console.log(`languages: ${languages.map(entry => entry.code).join(', ')}`);
  console.log(`numerals:  ${RAW ? 'sent raw' : 'masked before translation'}`);
  console.log(`from:      ${SEND_FROM ? 'declared' : 'auto-detected by Pravah'}`);
  console.log(`delay:     ${DELAY_MS ? `${DELAY_MS}ms between calls` : 'none'}`);
  console.log(`samples:   ${sampleIds.join(', ')}`);
  console.log(`key:       ${key ? 'found' : BOLD('MISSING')}`);
  console.log(`capture:   ${CAPTURE ? CAPTURE_PATH : 'not writing'}`);
  process.exit(0);
}

if (!key) {
  die(
    'PRAVAH_API_KEY is not set and server/.env has no value for it.\n' +
      'Export it before running this validation. The key is never printed.',
  );
}

const FAILURE_HELP = {
  [ERROR_KIND.UNAUTHORIZED]: 'PRAVAH_API_KEY is missing or was rejected.',
  [ERROR_KIND.QUOTA_EXCEEDED]:
    "This key's translation quota is exhausted. An account limit, not a pipeline fault.",
  [ERROR_KIND.NOT_CONFIGURED]: 'No API key, and no proxy URL to fall back to.',
  [ERROR_KIND.NETWORK]: 'The translation host could not be reached.',
  [ERROR_KIND.TIMEOUT]: 'The translation host timed out.',
  [ERROR_KIND.COUNT_MISMATCH]:
    'The API returned a different number of items than were sent.',
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const RETRIES = 3;
const TRANSIENT = new Set([
  ERROR_KIND.NETWORK,
  ERROR_KIND.TIMEOUT,
  ERROR_KIND.SERVER_ERROR,
  ERROR_KIND.EMPTY_TRANSLATION,
  ERROR_KIND.UNSUPPORTED_LANGUAGE,
]);

async function translateToEnglish(text, { from = '' } = {}) {
  const { masked, entities } = RAW ? { masked: text, entities: [] } : protect(text);

  const chunks = splitForTranslation(masked);
  const batches = planBatches(chunks, {
    maxItems: MAX_BATCH_ITEMS,
    maxChars: MAX_BATCH_CHARS,
  });

  const out = [];
  for (const batch of batches) {
    let result;
    for (let attempt = 0; attempt < RETRIES; attempt += 1) {
      result = await translateTexts({
        texts: batch,
        to: PRAVAH_TARGET_ENGLISH,
        from,
        key,
        url: process.env.PRAVAH_API_URL || undefined,
      });
      if (result.ok || !TRANSIENT.has(result.errorKind)) {
        break;
      }
      await sleep(600 * (attempt + 1));
    }
    if (!result.ok) {
      return { ok: false, errorKind: result.errorKind, upstream: result.upstream ?? '' };
    }
    out.push(...result.texts);
    if (DELAY_MS) {
      await sleep(DELAY_MS);
    }
  }

  const joined = joinTranslated(out);
  const { text: putBack, missing } = restore(joined, entities);
  const sourceYears = entities
    .map(entity => entity.value)
    .filter(value => /^(?:19|20)\d{2}$/.test(value));
  const repaired = inferMissingYears(
    repairOrphanedYears(stripSentinels(putBack)),
    sourceYears,
  );
  const numerals = reconcile(text, repaired);

  return {
    ok: true,
    text: repaired,
    chunks: chunks.length,
    numerals: { ...numerals, missing: missing.length },
  };
}

console.log(rule('='));
console.log(BOLD('Multilingual dictation pipeline — live Pravah validation'));
console.log(rule('='));
console.log(
  `${languages.length} language(s) x ${sampleIds.length} sample(s) = ${totalCalls} request(s)\n`,
);

const capture = {};
const perLanguage = [];
let hardStop = null;

for (const entry of languages) {
  const rows = [];
  capture[entry.code] = {};

  for (const id of sampleIds) {
    const sample = sampleFor(entry.code, id);
    const translated = await translateToEnglish(sample.text, {
      from: SEND_FROM ? translationCodeFor(entry.code) : '',
    });

    if (!translated.ok) {
      const help = FAILURE_HELP[translated.errorKind] ?? '';
      rows.push({ id, ok: false, reason: `translation ${translated.errorKind}` });
      console.log(
        `  ${RED('FAIL')} ${entry.code}/${id} — translation ${translated.errorKind}` +
          (help ? `\n       ${help}` : ''),
      );
      if (
        translated.errorKind === ERROR_KIND.UNAUTHORIZED ||
        translated.errorKind === ERROR_KIND.QUOTA_EXCEEDED ||
        translated.errorKind === ERROR_KIND.NOT_CONFIGURED
      ) {
        hardStop = translated.errorKind;
        break;
      }
      continue;
    }

    capture[entry.code][id] = { source: sample.text, english: translated.text };

    const graded = gradeReport(translated.text, EXPECTED[id]);
    const ok = graded.failures.length === 0;
    rows.push({ id, ok, failures: graded.failures, notes: graded.notes });

    if (ok) {
      const note = graded.notes.length
        ? ` (name transliterated "${graded.spokenName}")`
        : '';
      console.log(`  ${GREEN('ok  ')} ${entry.code}/${id} — ${STYLES[id]}${note}`);
    } else {
      console.log(`  ${RED('FAIL')} ${entry.code}/${id} — ${STYLES[id]}`);
      for (const failure of graded.failures) {
        console.log(
          `       ${failure.name}: expected ${JSON.stringify(
            failure.want,
          )}, got ${JSON.stringify(failure.actual)}`,
        );
      }
      console.log(`       english: ${translated.text}`);
    }
  }

  const passedCount = rows.filter(row => row.ok).length;
  perLanguage.push({ code: entry.code, passed: passedCount, total: rows.length });
  console.log(
    `  ${BOLD(entry.code)}: ${passedCount}/${rows.length} samples clean\n`,
  );

  if (hardStop) {
    break;
  }
}

if (CAPTURE) {
  writeFileSync(CAPTURE_PATH, `${JSON.stringify(capture, null, 2)}\n`, 'utf8');
  console.log(`capture written to scripts/fixtures/pravah-dictation-capture.json`);
}

console.log(rule('='));
for (const row of perLanguage) {
  const clean = row.passed === row.total && row.total > 0;
  console.log(
    `${clean ? GREEN('ok  ') : RED('FAIL')} ${row.code.padEnd(4)} ${row.passed}/${row.total}`,
  );
}

const totalPassed = perLanguage.reduce((sum, row) => sum + row.passed, 0);
const totalRun = perLanguage.reduce((sum, row) => sum + row.total, 0);
console.log(rule('='));
console.log(`${totalPassed}/${totalRun} samples clean across ${perLanguage.length} language(s)`);

if (hardStop) {
  console.log(RED(`\nstopped early: ${hardStop}`));
  process.exit(1);
}
process.exit(totalPassed === totalRun ? 0 : 1);
