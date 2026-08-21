globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CORPUS_LANGUAGES,
  EXPECTED,
  SAMPLE_IDS,
  STYLES,
  sampleFor,
} from './fixtures/dictation-samples.mjs';

import { check, report } from './lib/fixture-harness.mjs';
import { gradeReport, holds, runPipeline, valueOf } from './lib/dictation-grade.mjs';

function assertFields(label, transcript, expected, options = {}) {
  const graded = gradeReport(transcript, expected, options);

  for (const entry of graded.checks) {
    check(`${label} ${entry.name}`, entry.actual, entry.want);
  }
  check(
    `${label} names the export file`,
    graded.doc.fileName.endsWith('.pdf'),
    true,
  );

  return graded;
}

for (const id of SAMPLE_IDS) {
  const sample = sampleFor('en', id);
  check(`P1.${id} the corpus has "${STYLES[id]}"`, sample.title, STYLES[id]);
  assertFields(`P1.${id} [${STYLES[id]}]`, sample.text, EXPECTED[id], {
    strictName: true,
  });
}

{
  const { record, doc } = runPipeline(sampleFor('en', 11).text);
  check('P2.1 the correction wins over the first age', valueOf(record, 'age'), '35 Years');
  check(
    'P2.2 the retracted age is nowhere in the payload',
    JSON.stringify(doc).includes('45 Years'),
    false,
  );
}

{
  const { doc } = runPipeline(sampleFor('en', 14).text);
  const description = String(doc.sectionB.description ?? '');
  check('P2.3 a denied symptom is not reported as present', holds(description, 'no chest pain'), false);
  check(
    'P2.4 denials do not leak into the reaction description as symptoms',
    ['chest pain', 'breathing difficulty'].filter(
      word => new RegExp(`(?<!no )${word}`, 'i').test(description),
    ),
    [],
  );
}

{
  const { doc } = runPipeline(sampleFor('en', 19).text);
  const description = String(doc.sectionB.description ?? '');
  check('P2.5 today\'s reaction is what section B describes', holds(description, 'itching'), true);
  check(
    'P2.6 the standing conditions are not reported as the reaction',
    ['diabet', 'blood pressure'].filter(word => holds(description, word)),
    [],
  );
}

{
  const { doc, completeness } = runPipeline(sampleFor('en', 18).text);
  check('P2.7 clinical synonyms still complete the report', completeness.isComplete, true);
  check(
    'P2.8 at least one clinical term reaches the description',
    ['pruritus', 'urticaria', 'edema', 'dyspnea', 'nausea'].some(word =>
      holds(doc.sectionB.description, word),
    ),
    true,
  );
}

{
  const { record, doc } = runPipeline(sampleFor('en', 20).text);
  check('P2.9 repetition does not duplicate the name', valueOf(record, 'patientName'), 'Simran Kaur');
  check(
    'P2.10 repetition does not duplicate the start date',
    doc.sectionB.reactionStartDate,
    '12/08/2026',
  );
}

{
  const source = sampleFor('en', 16).text;
  check('P2.11 the run-on sample really has no sentence breaks', source.includes('. '), false);
  const { completeness } = runPipeline(source);
  check('P2.12 the run-on sample still completes', completeness.isComplete, true);
}

{
  const six = sampleFor('en', 6).text;
  const seven = sampleFor('en', 7).text;
  check('P2.13 sample 6 never states the gender outright', /\bfemale\b/i.test(six), false);
  check('P2.14 sample 7 never states the gender outright', /\bmale\b/i.test(seven), false);
  check('P2.15 female is inferred from "she"', valueOf(runPipeline(six).record, 'gender'), 'Female');
  check('P2.16 male is inferred from "he"', valueOf(runPipeline(seven).record, 'gender'), 'Male');
}

{
  const source = sampleFor('en', 17).text;
  check(
    'P2.17 the stop date really is dictated first',
    source.indexOf('14 August') < source.indexOf('12 August'),
    true,
  );
  const { doc } = runPipeline(source);
  check('P2.18 start and stop are still assigned correctly', [
    doc.sectionB.reactionStartDate,
    doc.sectionB.reactionStopDate,
  ], ['12/08/2026', '14/08/2026']);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURE_PATH = join(HERE, 'fixtures', 'pravah-dictation-capture.json');
const BASELINE_PATH = join(HERE, 'fixtures', 'dictation-baseline.json');
const CURRENT_PATH = join(HERE, 'fixtures', 'dictation-current.json');
const TRANSLATED = CORPUS_LANGUAGES.filter(entry => entry.code !== 'en');

if (!existsSync(CAPTURE_PATH)) {
  console.log(
    `\nno Pravah capture at scripts/fixtures/pravah-dictation-capture.json — ` +
      `${TRANSLATED.length} languages x ${SAMPLE_IDS.length} samples not replayed.\n` +
      `record one with: npm run validate:dictation -- --capture`,
  );
} else {
  const capture = JSON.parse(readFileSync(CAPTURE_PATH, 'utf8'));
  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : null;
  const current = existsSync(CURRENT_PATH)
    ? JSON.parse(readFileSync(CURRENT_PATH, 'utf8'))
    : null;

  const fieldFailures = {};
  let clean = 0;
  let graded = 0;

  for (const entry of TRANSLATED) {
    const perLanguage = capture[entry.code] ?? {};
    const translated = SAMPLE_IDS.filter(id => perLanguage[id]?.english);

    check(
      `P3.1 ${entry.code} capture is present`,
      translated.length > 0 || entry.code === 'ur',
      true,
    );

    for (const id of translated) {
      const english = perLanguage[id].english;
      graded += 1;

      check(
        `P3.2 ${entry.code}/${id} translation left the source script`,
        entry.script.test(english),
        false,
      );

      const result = gradeReport(english, EXPECTED[id], { translated: true });
      if (result.failures.length === 0) {
        clean += 1;
      }
      for (const failure of result.failures) {
        fieldFailures[failure.name] = (fieldFailures[failure.name] ?? 0) + 1;
      }
    }
  }

  console.log(
    `\n${'-'.repeat(66)}\n` +
      `REPLAY OF LIVE PRAVAH OUTPUT — ${clean}/${graded} translations produce a ` +
      `correct ADR report.\nSee docs/multilingual-findings.md. Failures by field:`,
  );
  for (const [field, count] of Object.entries(fieldFailures).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${field.padEnd(20)} ${count}`);
  }
  console.log('-'.repeat(66));

  if (baseline) {
    check(
      `P3.3 better than the recorded baseline of ${baseline.clean}/${baseline.graded}`,
      clean > baseline.clean,
      true,
    );
  } else {
    console.log('no baseline recorded — write scripts/fixtures/dictation-baseline.json');
  }

  if (!current) {
    console.log(
      'no current result recorded — write scripts/fixtures/dictation-current.json',
    );
  } else {
    const rate = (part, whole) => (whole ? part / whole : 0);
    const tolerance = 0.01;

    check(
      'P3.4 the capture still covers nearly the whole corpus',
      graded >= current.graded - 5,
      true,
    );
    check(
      `P3.5 no regression: at least ${(100 * rate(current.clean, current.graded)).toFixed(1)}% produce a correct report`,
      rate(clean, graded) >= rate(current.clean, current.graded) - tolerance,
      true,
    );
    for (const [field, allowed] of Object.entries(current.fieldFailures)) {
      check(
        `P3.6 ${field} failure rate did not increase (allowed ${allowed}/${current.graded})`,
        rate(fieldFailures[field] ?? 0, graded) <=
          rate(allowed, current.graded) + tolerance,
        true,
      );
    }
    check(
      'P3.7 no new failure mode appeared',
      Object.keys(fieldFailures).filter(field => !(field in current.fieldFailures)),
      [],
    );
  }
}

report();
