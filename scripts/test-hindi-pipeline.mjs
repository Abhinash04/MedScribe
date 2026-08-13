globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PATIENT_FIELDS } from '../src/constants/patientFields.js';
import { extractForReport } from '../src/services/extractionService.js';
import { missingFieldPrompt } from '../src/services/missingFieldPrompt.js';
import {
  blockingFields,
  validateReportCompleteness,
} from '../src/services/reportCompleteness.js';
import {
  countRequiredFilled,
  mergeExtraction,
  toDraft,
} from '../src/services/reportDraft.js';
import { HINDI_SAMPLES } from './fixtures/hindi-dictations.mjs';

import { check, report } from './lib/fixture-harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const capture = JSON.parse(
  readFileSync(join(HERE, 'fixtures', 'pravah-hindi-capture.json'), 'utf8'),
);

const valueOf = (record, field) => {
  const raw = record?.[field]?.value;
  return Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
};
const holds = (haystack, needle) =>
  String(haystack).toLowerCase().includes(String(needle).toLowerCase());

const englishFor = id => capture[id]?.english ?? '';
const TRANSLATION_GAPS = {
  1: ['medicalHistory', 'diagnosis'],
  2: ['symptoms', 'medicalHistory', 'diagnosis'],
  3: [],
};

for (const sample of HINDI_SAMPLES) {
  const english = englishFor(sample.id);
  check(`H1.${sample.id}a capture exists`, english.length > 0, true);
  check(
    `H1.${sample.id}b the source really is Devanagari`,
    /[ऀ-ॿ]/.test(capture[sample.id].hindi),
    true,
  );
  check(
    `H1.${sample.id}c the translation carries no Devanagari`,
    /[ऀ-ॿ]/.test(english),
    false,
  );
}

for (const sample of HINDI_SAMPLES) {
  const english = englishFor(sample.id);
  for (const token of sample.preserve) {
    check(
      `H2.${sample.id} "${token}" survives translation`,
      holds(english, token),
      true,
    );
  }
}

for (const sample of HINDI_SAMPLES) {
  const { record } = extractForReport(englishFor(sample.id));
  const gaps = TRANSLATION_GAPS[sample.id] ?? [];

  for (const field of PATIENT_FIELDS) {
    const expected = sample.expect[field.key];
    if (!expected || gaps.includes(field.key)) {
      continue;
    }
    check(
      `H3.${sample.id} ${field.key} = "${expected}"`,
      holds(valueOf(record, field.key), expected),
      true,
    );
  }
}

for (const sample of HINDI_SAMPLES) {
  const { record } = extractForReport(englishFor(sample.id));
  for (const field of TRANSLATION_GAPS[sample.id] ?? []) {
    check(
      `H4.${sample.id} ${field} is still lost in translation`,
      holds(valueOf(record, field), sample.expect[field]),
      false,
    );
  }
}

{
  const { record, residue } = extractForReport(englishFor(3));
  const draft = toDraft(record, residue);
  const completeness = validateReportCompleteness(draft);

  check('H5.1 sample 3 fills every mandatory field', completeness.isComplete, true);
  check('H5.2 nothing blocks the report', blockingFields(completeness), []);
  check('H5.3 all ten required fields present', countRequiredFilled(draft), 10);
  check('H5.4 no invalid values', completeness.invalidFields, []);
}

{
  const trimmed = englishFor(3)
    .replace(/The PIN Code is \d+ and their mobile number is \d+\./i, '')
    .trim();

  const { record, residue } = extractForReport(trimmed);
  const draft = toDraft(record, residue);
  const completeness = validateReportCompleteness(draft);
  const blocking = blockingFields(completeness).map(field => field.key);

  check('H6.1 the report is blocked', completeness.isComplete, false);
  check('H6.2 exactly the two omitted fields block it', blocking.sort(), [
    'contactNumber',
    'pinCode',
  ]);
  check('H6.3 eight of ten required fields remain', countRequiredFilled(draft), 8);
  check(
    'H6.4 an unrelated field is untouched',
    holds(valueOf(record, 'diagnosis'), 'viral fever'),
    true,
  );
}

{
  const trimmed = englishFor(3)
    .replace(/The PIN Code is \d+ and their mobile number is \d+\./i, '')
    .trim();
  const { record, residue } = extractForReport(trimmed);
  const completeness = validateReportCompleteness(toDraft(record, residue));
  const prompt = missingFieldPrompt(blockingFields(completeness), 'hi');

  check('H7.1 a prompt is produced', prompt.length > 0, true);
  check('H7.2 it is Devanagari', /[ऀ-ॿ]/.test(prompt), true);
  check('H7.3 it names the PIN code in Hindi', prompt.includes('पिन कोड'), true);
  check('H7.4 it names the contact number in Hindi', prompt.includes('संपर्क नंबर'), true);
  check(
    'H7.5 no English sentence leaks in',
    /still missing|Please provide/i.test(prompt),
    false,
  );
  check(
    'H7.6 it fits the TTS character cap',
    prompt.length <= 600,
    true,
  );
}

{
  const trimmed = englishFor(3)
    .replace(/The PIN Code is \d+ and their mobile number is \d+\./i, '')
    .trim();

  const first = extractForReport(trimmed);
  let draft = toDraft(first.record, first.residue);

  draft = {
    ...draft,
    diagnosis: {
      ...draft.diagnosis,
      value: 'Viral fever with dehydration',
      edited: true,
    },
  };

  const second = extractForReport(englishFor(3));
  const merged = mergeExtraction(draft, second.record, second.residue);
  const completeness = validateReportCompleteness(merged);

  check(
    'H8.1 the missing PIN is filled by pass 2',
    holds(merged.pinCode?.value ?? '', '110016'),
    true,
  );
  check(
    'H8.2 the missing contact number is filled by pass 2',
    holds(merged.contactNumber?.value ?? '', '9898765432'),
    true,
  );
  check(
    'H8.3 the doctor edit survives pass 2',
    merged.diagnosis.value,
    'Viral fever with dehydration',
  );
  check('H8.4 and is still marked edited', merged.diagnosis.edited, true);
  check(
    'H8.5 an unedited field keeps its value',
    holds(merged.patientName?.value ?? '', 'Amit'),
    true,
  );
  check('H8.6 the report now passes validation', completeness.isComplete, true);
  check('H8.7 nothing blocks it', blockingFields(completeness), []);
}

console.log('\nHindi pipeline, real Pravah translations\n');
for (const sample of HINDI_SAMPLES) {
  const { record } = extractForReport(englishFor(sample.id));
  const expected = Object.keys(sample.expect);
  const got = expected.filter(key => holds(valueOf(record, key), sample.expect[key]));
  const gaps = TRANSLATION_GAPS[sample.id] ?? [];
  console.log(
    `  sample ${sample.id}  fields ${got.length}/${expected.length}` +
      (gaps.length ? `   lost in translation: ${gaps.join(', ')}` : '   (clean)'),
  );
}
console.log(
  '\n  Gaps above are TRANSLATION faults — the English does not contain the\n' +
    '  information, so no extraction marker could recover it. See the report.\n',
);

report();
