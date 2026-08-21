// Re-derive the two headline numbers from the capture on disk, plus the field tally,
// in the exact shape dictation-current.json records.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXPECTED, SAMPLE_IDS } from './fixtures/dictation-samples.mjs';
import { gradeReport, runPipeline } from './lib/dictation-grade.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const capture = JSON.parse(
  readFileSync(join(HERE, 'fixtures', 'pravah-dictation-capture.json'), 'utf8'),
);

const fieldFailures = {};
let graded = 0;
let clean = 0;
let fileable = 0;

for (const [code, samples] of Object.entries(capture)) {
  if (code === 'en') {
    continue;
  }
  for (const id of SAMPLE_IDS) {
    const english = samples[id]?.english;
    if (!english) {
      continue;
    }
    graded += 1;

    const result = gradeReport(english, EXPECTED[id], { translated: true });
    if (!result.failures.length) {
      clean += 1;
    }
    for (const failure of result.failures) {
      fieldFailures[failure.name] = (fieldFailures[failure.name] ?? 0) + 1;
    }

    if (runPipeline(english, { translated: true }).completeness.isComplete) {
      fileable += 1;
    }
  }
}

const ordered = Object.fromEntries(
  Object.entries(fieldFailures).sort((a, b) => b[1] - a[1]),
);

console.log(`graded   ${graded}`);
console.log(`clean    ${clean} (${((clean / graded) * 100).toFixed(1)}%)`);
console.log(`fileable ${fileable} (${((fileable / graded) * 100).toFixed(1)}%)`);
console.log(ordered);

if (process.argv.includes('--write')) {
  const path = join(HERE, 'fixtures', 'dictation-current.json');
  const existing = JSON.parse(readFileSync(path, 'utf8'));
  const next = {
    ...existing,
    recordedAt: new Date().toISOString().slice(0, 10),
    graded,
    clean,
    fileable,
    fieldFailures: ordered,
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log('wrote scripts/fixtures/dictation-current.json');
}
