globalThis.fetch = () => {
  throw new Error('analyze-dictation-capture must not perform network calls');
};

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { numeralTokens, toLatinDigits } from '../src/utils/numerals.js';
import {
  inferMissingYears,
  repairOrphanedYears,
} from '../src/services/pravah/repairDates.js';
import { EXPECTED, SAMPLE_IDS } from './fixtures/dictation-samples.mjs';
import { flag } from './lib/cli-flags.mjs';
import { gradeReport } from './lib/dictation-grade.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURE_PATH = join(HERE, 'fixtures', 'pravah-dictation-capture.json');

if (!existsSync(CAPTURE_PATH)) {
  console.error(
    'No capture at scripts/fixtures/pravah-dictation-capture.json.\n' +
      'Record one with: npm run validate:dictation -- --capture',
  );
  process.exit(1);
}

const capture = JSON.parse(readFileSync(CAPTURE_PATH, 'utf8'));

const BOLD = s => `\x1b[1m${s}\x1b[0m`;
const rule = char => char.repeat(74);

const rejoinSplitDigits = text => String(text).replace(/(\d)\s*-\s*(\d)/g, '$1$2');

function restoreNumerals(source, english) {
  const wanted = numeralTokens(source);
  const joined = rejoinSplitDigits(english);
  const got = numeralTokens(joined);
  if (wanted.length !== got.length) {
    return joined;
  }
  let index = 0;
  return joined.replace(/\d+(?:\.\d+)?/g, () => wanted[index++]);
}

function repairedDates(source, english) {
  const years = numeralTokens(source).filter(value => /^(?:19|20)\d{2}$/.test(value));
  return inferMissingYears(repairOrphanedYears(rejoinSplitDigits(english)), years);
}

const TRANSFORMS = {
  live: (source, english) => english,
  rejoin: (source, english) => rejoinSplitDigits(english),
  masked: restoreNumerals,
  repaired: repairedDates,
};

// Everything graded here is Pravah output, so extraction is told so — the same thing
// the app does for a translated consultation. It changes how much a pronoun is
// trusted, not what is extracted.
const TRANSLATED = { translated: true };

const only = flag('transform');
const fieldFilter = flag('field');
const show = flag('show');
const limit = Number(flag('limit') ?? 10);

const rows = [];
for (const [code, samples] of Object.entries(capture)) {
  for (const id of SAMPLE_IDS) {
    const entry = samples[id];
    if (entry?.english) {
      rows.push({ code, id, source: entry.source, english: entry.english });
    }
  }
}

if (show) {
  const [code, rawId] = show.split('/');
  const row = rows.find(item => item.code === code && item.id === Number(rawId));
  if (!row) {
    console.error(`No captured translation for ${show}`);
    process.exit(1);
  }
  console.log(rule('='));
  console.log(BOLD(`${show} — ${EXPECTED[row.id].fullSpokenName}`));
  console.log(rule('='));
  console.log(`\n${BOLD('source')}\n${row.source}`);
  for (const [name, fn] of Object.entries(TRANSFORMS)) {
    if (only && only !== name) {
      continue;
    }
    const text = fn(row.source, row.english);
    const graded = gradeReport(text, EXPECTED[row.id], TRANSLATED);
    console.log(`\n${BOLD(name)}\n${text}`);
    console.log(`  numerals source : ${numeralTokens(row.source).join(' ')}`);
    console.log(`  numerals result : ${numeralTokens(text).join(' ')}`);
    for (const check of graded.checks) {
      console.log(
        `  ${check.ok ? 'ok  ' : 'FAIL'} ${check.name.padEnd(20)} ` +
          `got=${JSON.stringify(check.actual)}` +
          (check.ok ? '' : ` want=${JSON.stringify(check.want)}`),
      );
    }
  }
  process.exit(0);
}

if (flag('matrix') !== null || process.argv.includes('--matrix')) {
  const transform = TRANSFORMS[only ?? 'live'];
  const CLASSES = {
    translationLoss: 'Pravah dropped the information — unrecoverable without upstream change',
    translationCorruption: 'Pravah returned a wrong value for information that was dictated',
    extraction: 'the information is in the English but we did not extract it — our bug',
    corpus: 'the corpus expectation disagrees with the corpus source — test-data error',
  };

  // A field that came out empty is only an upstream loss if the value is genuinely
  // absent from the English. Assuming otherwise reported six of OUR OWN bugs as
  // "Pravah dropped it" — Tamil renders the stop clause as "was perfect on 13 August",
  // and `perfect` was simply missing from our vocabulary. Every branch now checks the
  // English before blaming the translator.
  const monthNames =
    'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';

  const dateIsPresent = (english, want) => {
    const [day, month] = String(want).split('/').map(Number);
    if (!day || !month) {
      return false;
    }
    const name = monthNames.split('|')[month - 1];
    const pattern = new RegExp(
      `\\b0?${day}\\b[\\s,]*(?:${name}|${month})|\\b(?:${name})[\\s,]*0?${day}\\b|\\b0?${day}[/.-]0?${month}[/.-]`,
      'i',
    );
    return pattern.test(english);
  };

  const classify = (failure, english) => {
    if (['isComplete', 'blocking', 'capturedCount'].includes(failure.name)) {
      return 'derived';
    }
    if (failure.name === 'keywords') {
      const stillThere = failure.actual.filter(word =>
        english.toLowerCase().includes(word.toLowerCase()),
      );
      return stillThere.length ? 'extraction' : 'translationLoss';
    }
    if (failure.name === 'reactionStartDate' || failure.name === 'reactionStopDate') {
      if (!failure.actual) {
        return dateIsPresent(english, failure.want) ? 'extraction' : 'translationLoss';
      }
      return 'translationCorruption';
    }
    if (failure.name === 'gender') {
      return 'translationCorruption';
    }
    // Age, weight and initials: present in the English means we failed to read it.
    const wanted = String(failure.want ?? '').replace(/[^A-Za-z0-9.]/g, '');
    if (!failure.actual && wanted && english.replace(/[^A-Za-z0-9.]/g, '').includes(wanted)) {
      return 'extraction';
    }
    return failure.actual ? 'translationCorruption' : 'translationLoss';
  };

  const lines = [
    '# Remaining multilingual failures',
    '',
    `Generated by \`npm run analyze:dictation -- --matrix\` over ${rows.length} live`,
    'Pravah translations. Every remaining failure appears here with its cause.',
    '',
    '`isComplete` / `blocking` / `capturedCount` are DERIVED — they fail because one of',
    'the four required ADR fields failed, so they are listed but not counted separately.',
    '',
    '## Legend',
    '',
    ...Object.entries(CLASSES).map(([key, text]) => `- **${key}** — ${text}`),
    '',
    '## Rows',
    '',
    '| sample | field | expected | got | class |',
    '|---|---|---|---|---|',
  ];

  const tally = {};
  for (const row of rows) {
    const text = transform(row.source, row.english);
    const graded = gradeReport(text, EXPECTED[row.id], TRANSLATED);
    for (const failure of graded.failures) {
      const cls = classify(failure, text);
      tally[cls] = (tally[cls] ?? 0) + 1;
      const cell = value => `\`${JSON.stringify(value).slice(0, 40).replace(/\|/g, '\\|')}\``;
      lines.push(
        `| ${row.code}/${row.id} | ${failure.name} | ${cell(failure.want)} | ${cell(failure.actual)} | ${cls} |`,
      );
    }
  }

  lines.splice(
    lines.indexOf('## Rows'),
    0,
    '## Totals',
    '',
    ...Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([cls, count]) => `- ${cls}: ${count}`),
    '',
  );

  writeFileSync(join(HERE, '..', 'docs', 'failure-matrix.md'), `${lines.join('\n')}\n`, 'utf8');
  console.log(`wrote docs/failure-matrix.md — ${Object.values(tally).reduce((a, b) => a + b, 0)} rows`);
  for (const [cls, count] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cls.padEnd(24)} ${count}`);
  }
  process.exit(0);
}

console.log(rule('='));
console.log(BOLD(`Dictation capture analysis — ${rows.length} translations`));
console.log(rule('='));

const summaries = [];
for (const [name, fn] of Object.entries(TRANSFORMS)) {
  if (only && only !== name) {
    continue;
  }

  let clean = 0;
  const fieldFailures = {};
  const examples = {};

  for (const row of rows) {
    const text = fn(row.source, row.english);
    const graded = gradeReport(text, EXPECTED[row.id], TRANSLATED);
    if (graded.failures.length === 0) {
      clean += 1;
    }
    for (const failure of graded.failures) {
      fieldFailures[failure.name] = (fieldFailures[failure.name] ?? 0) + 1;
      if (!examples[failure.name]) {
        examples[failure.name] = [];
      }
      if (examples[failure.name].length < limit) {
        examples[failure.name].push({ where: `${row.code}/${row.id}`, ...failure, text });
      }
    }
  }

  summaries.push({ name, clean, total: rows.length, fieldFailures, examples });
}

for (const summary of summaries) {
  const pct = ((100 * summary.clean) / summary.total).toFixed(1);
  console.log(
    `\n${BOLD(summary.name.padEnd(10))} ${summary.clean}/${summary.total} clean (${pct}%)`,
  );
  const entries = Object.entries(summary.fieldFailures).sort((a, b) => b[1] - a[1]);
  for (const [field, count] of entries) {
    console.log(`  ${field.padEnd(20)} ${count}`);
  }
}

if (fieldFilter) {
  for (const summary of summaries) {
    const found = summary.examples[fieldFilter] ?? [];
    if (!found.length) {
      continue;
    }
    console.log(`\n${rule('-')}`);
    console.log(BOLD(`${summary.name} — first ${found.length} "${fieldFilter}" failures`));
    console.log(rule('-'));
    for (const item of found) {
      console.log(
        `\n${item.where}: want ${JSON.stringify(item.want)}, got ${JSON.stringify(item.actual)}`,
      );
      console.log(`  ${item.text}`);
    }
  }
}

{
  const transform = TRANSFORMS[only ?? 'live'];
  const SOFT = new Set(['keywords']);
  let filed = 0;

  for (const row of rows) {
    const graded = gradeReport(transform(row.source, row.english), EXPECTED[row.id], TRANSLATED);
    if (graded.failures.every(failure => SOFT.has(failure.name))) {
      filed += 1;
    }
  }

  console.log(`\n${rule('=')}`);
  console.log(BOLD('Reports that could actually be filed'));
  console.log(
    `  complete, all four ADR fields correct : ${filed}/${rows.length} ` +
      `(${((100 * filed) / rows.length).toFixed(1)}%)`,
  );
}

{
  const transform = TRANSFORMS[only ?? 'masked'];
  let lostUpstream = 0;
  let missedByUs = 0;
  const lostWords = {};

  for (const row of rows) {
    const text = transform(row.source, row.english);
    const graded = gradeReport(text, EXPECTED[row.id], TRANSLATED);
    const failure = graded.failures.find(entry => entry.name === 'keywords');
    if (!failure) {
      continue;
    }
    for (const word of failure.actual) {
      if (text.toLowerCase().includes(word.toLowerCase())) {
        missedByUs += 1;
      } else {
        lostUpstream += 1;
        lostWords[word] = (lostWords[word] ?? 0) + 1;
      }
    }
  }

  console.log(`\n${rule('=')}`);
  console.log(BOLD('Missing reaction keywords, by cause'));
  console.log(`  present in the English but not extracted : ${missedByUs}`);
  console.log(`  never produced by the translator         : ${lostUpstream}`);
  const worst = Object.entries(lostWords).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (worst.length) {
    console.log(`  most-lost words: ${worst.map(([w, n]) => `${w} (${n})`).join(', ')}`);
  }
}

const exact = rows.filter(
  row =>
    numeralTokens(row.source).join(',') ===
    numeralTokens(rejoinSplitDigits(row.english)).join(','),
).length;
const sameCount = rows.filter(
  row =>
    numeralTokens(row.source).length ===
    numeralTokens(rejoinSplitDigits(row.english)).length,
).length;

console.log(`\n${rule('=')}`);
console.log(BOLD('Upstream numeral fidelity (before any of our repair)'));
console.log(`  identical numeral sequence : ${exact}/${rows.length}`);
console.log(`  same numeral count         : ${sameCount}/${rows.length}`);
console.log(
  `  years that are not 2026    : ${
    rows.filter(row => toLatinDigits(row.english).match(/\b(19|20)\d\d\b/g)?.some(y => y !== '2026'))
      .length
  }/${rows.length}`,
);
console.log(rule('='));
