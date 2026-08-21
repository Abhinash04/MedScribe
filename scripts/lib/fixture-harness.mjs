let passed = 0;
let failed = 0;
const failures = [];

export const valueOf = field => (field ? field.value : null);

export function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `  ${name}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`,
    );
  }
}

export function expectFields(extract, label, transcript, expected) {
  const record = extract(transcript);
  for (const [key, want] of Object.entries(expected)) {
    check(`${label} → ${key}`, valueOf(record[key]), want);
  }
  return record;
}

export function report() {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    console.log('FAILURES:\n' + failures.join('\n\n'));
    process.exit(1);
  }
}
