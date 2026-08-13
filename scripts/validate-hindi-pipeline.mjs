import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PATIENT_FIELDS } from '../src/constants/patientFields.js';
import { extractForReport } from '../src/services/extractionService.js';
import { missingFieldPrompt } from '../src/services/missingFieldPrompt.js';
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
  blockingFields,
  validateReportCompleteness,
} from '../src/services/reportCompleteness.js';
import { toDraft } from '../src/services/reportDraft.js';
import { HINDI_SAMPLES, sampleById } from './fixtures/hindi-dictations.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURE_PATH = join(HERE, 'fixtures', 'pravah-hindi-capture.json');

const flag = name => {
  const match = process.argv.find(arg => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : null;
};
const has = name => process.argv.includes(`--${name}`);

const DRY_RUN = has('dry-run');
const CAPTURE = has('capture');
const only = flag('sample');
const samples =
  !only || only === 'all'
    ? HINDI_SAMPLES
    : [sampleById(only)].filter(Boolean);

if (!samples.length) {
  console.error(`No sample matched --sample=${only}. Use 1, 2, 3 or all.`);
  process.exit(1);
}

const BOLD = s => `\x1b[1m${s}\x1b[0m`;
const rule = char => char.repeat(74);
const valueOf = (record, field) => {
  const raw = record?.[field]?.value;
  return Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
};
const holds = (haystack, needle) =>
  String(haystack).toLowerCase().includes(String(needle).toLowerCase());

async function translateHindi(hindi, key) {
  const chunks = splitForTranslation(hindi);
  const batches = planBatches(chunks, {
    maxItems: MAX_BATCH_ITEMS,
    maxChars: MAX_BATCH_CHARS,
  });

  const out = [];
  for (const batch of batches) {
    const result = await translateTexts({
      texts: batch,
      to: PRAVAH_TARGET_ENGLISH,
      key,
      url: process.env.PRAVAH_API_URL || undefined,
    });
    if (!result.ok) {
      return { ok: false, errorKind: result.errorKind };
    }
    out.push(...result.texts);
  }

  return { ok: true, text: joinTranslated(out), chunks: chunks.length };
}

const INFRA_HELP = {
  [ERROR_KIND.UNAUTHORIZED]: 'PRAVAH_API_KEY is missing or was rejected.',
  [ERROR_KIND.QUOTA_EXCEEDED]:
    "This key's translation quota is exhausted. This is an account limit, not a pipeline fault.",
  [ERROR_KIND.NOT_CONFIGURED]: 'No API key, and no proxy URL to fall back to.',
  [ERROR_KIND.NETWORK]: 'The translation host could not be reached.',
  [ERROR_KIND.TIMEOUT]: 'The translation host timed out.',
};

function reportSample(sample, english, chunkCount) {
  console.log(`\n${rule('=')}`);
  console.log(BOLD(`SAMPLE ${sample.id} — ${sample.title}`));
  console.log(rule('='));

  console.log(`\n${BOLD('Hindi (as dictated)')}\n${sample.hindi}`);
  console.log(
    `\n${BOLD('English (returned by Pravah)')}${
      chunkCount ? `   [${chunkCount} chunk(s)]` : ''
    }\n${english}`,
  );

  console.log(`\n${BOLD('Preservation of numbers and identifiers')}`);
  const preserveResults = sample.preserve.map(token => ({
    token,
    kept: holds(english, token),
  }));
  for (const { token, kept } of preserveResults) {
    console.log(`  ${kept ? 'ok  ' : 'LOST'} ${token}`);
  }

  const { record, residue } = extractForReport(english);
  const draft = toDraft(record, residue);
  const completeness = validateReportCompleteness(draft);

  console.log(`\n${BOLD('Structured JSON (extracted)')}`);
  const json = {};
  for (const field of PATIENT_FIELDS) {
    const entry = record[field.key];
    if (entry) {
      json[field.key] = {
        value: entry.value,
        confidence: entry.confidence,
        source: entry.source,
        ...(entry.auto ? { auto: true } : {}),
      };
    }
  }
  console.log(JSON.stringify(json, null, 2));
  console.log(`\n${BOLD('Report fields — expected vs extracted')}`);
  const width = Math.max(...PATIENT_FIELDS.map(f => f.key.length));
  const fieldResults = [];
  for (const field of PATIENT_FIELDS) {
    const expected = sample.expect[field.key];
    const actual = valueOf(record, field.key);
    const ok = expected ? holds(actual, expected) : true;
    fieldResults.push({ key: field.key, expected, actual, ok });
    const mark = !expected ? '--  ' : ok ? 'ok  ' : 'MISS';
    console.log(
      `  ${mark} ${field.key.padEnd(width)}  ${
        actual || '(empty)'
      }${!ok && expected ? `      << expected to contain "${expected}"` : ''}`,
    );
  }

  const blocking = blockingFields(completeness);
  console.log(`\n${BOLD('Mandatory-field validation')}`);
  console.log(`  complete: ${completeness.isComplete}`);
  console.log(
    `  blocking: ${
      blocking.length ? blocking.map(f => f.key).join(', ') : '(none)'
    }`,
  );
  if (blocking.length) {
    console.log(`\n${BOLD('Hindi TTS prompt that would be spoken')}`);
    console.log(`  ${missingFieldPrompt(blocking, 'hi')}`);
  }

  const fieldsOk = fieldResults.filter(r => r.expected && r.ok).length;
  const fieldsTotal = fieldResults.filter(r => r.expected).length;
  const preserved = preserveResults.filter(r => r.kept).length;

  return {
    id: sample.id,
    english,
    fieldsOk,
    fieldsTotal,
    preserved,
    preserveTotal: preserveResults.length,
    complete: completeness.isComplete,
    blocking: blocking.map(f => f.key),
    misses: fieldResults.filter(r => r.expected && !r.ok).map(r => r.key),
    lost: preserveResults.filter(r => !r.kept).map(r => r.token),
  };
}

let cache = {};
if (existsSync(CAPTURE_PATH)) {
  try {
    cache = JSON.parse(readFileSync(CAPTURE_PATH, 'utf8'));
  } catch {
    cache = {};
  }
}

let key = '';
if (!DRY_RUN) {
  key = process.env.PRAVAH_API_KEY || '';
  if (!key) {
    console.error(
      'PRAVAH_API_KEY is not set. Export it, or use --dry-run to replay the\n' +
        'last capture. The key is never printed by this script.',
    );
    process.exit(1);
  }
}

const summaries = [];
const captured = { ...cache };

for (const sample of samples) {
  let english;
  let chunkCount = 0;

  if (DRY_RUN) {
    english = cache[sample.id]?.english;
    if (!english) {
      console.error(
        `No cached translation for sample ${sample.id}. Run without --dry-run first.`,
      );
      process.exit(1);
    }
  } else {
    const result = await translateHindi(sample.hindi, key);
    if (!result.ok) {
      console.error(
        `\nTranslation failed for sample ${sample.id} (${result.errorKind}).\n` +
          (INFRA_HELP[result.errorKind] ?? 'See the error kind above.'),
      );
      process.exit(1);
    }
    english = result.text;
    chunkCount = result.chunks;
    captured[sample.id] = {
      id: sample.id,
      title: sample.title,
      hindi: sample.hindi,
      english,
      capturedAt: new Date().toISOString(),
    };
  }

  summaries.push(reportSample(sample, english, chunkCount));
}

if (CAPTURE && !DRY_RUN) {
  mkdirSync(dirname(CAPTURE_PATH), { recursive: true });
  writeFileSync(CAPTURE_PATH, `${JSON.stringify(captured, null, 2)}\n`, 'utf8');
  console.log(`\nCaptured real translations to ${CAPTURE_PATH}`);
}

console.log(`\n${rule('=')}`);
console.log(BOLD('SUMMARY'));
console.log(rule('='));
for (const s of summaries) {
  console.log(
    `  sample ${s.id}:  fields ${s.fieldsOk}/${s.fieldsTotal}` +
      `   preserved ${s.preserved}/${s.preserveTotal}` +
      `   complete=${s.complete}` +
      (s.misses.length ? `   missed: ${s.misses.join(', ')}` : '') +
      (s.lost.length ? `   LOST: ${s.lost.join(', ')}` : ''),
  );
}

const totalOk = summaries.reduce((n, s) => n + s.fieldsOk, 0);
const total = summaries.reduce((n, s) => n + s.fieldsTotal, 0);
const keptAll = summaries.every(s => s.lost.length === 0);
console.log(`\n  overall fields ${totalOk}/${total}`);
console.log(`  numbers preserved everywhere: ${keptAll ? 'yes' : 'NO'}\n`);
