globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { ERROR_KIND } from '../src/services/anuvadini/proxyContract.js';
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
import { translateTexts } from '../src/services/pravah/translationClient.js';
import { gradeReport } from './lib/dictation-grade.mjs';

import { check, report } from './lib/fixture-harness.mjs';

const KEY = 'test-key';
const URL = 'https://example.invalid/translatebulk';

const fake = (status, body) => async () => ({ status, body });

const run = transport =>
  translateTexts({ texts: ['one'], to: 'en', key: KEY, url: URL, transport });

{
  const source = 'ପ୍ରତିକ୍ରିୟା ୧୦ ଅଗଷ୍ଟ ୨୦୨୬ ରେ ଆରମ୍ଭ ହୋଇ ୧୨ ଅଗଷ୍ଟ ୨୦୨୬ ରେ ଶେଷ ହେଲା।';
  const { masked, entities } = protect(source);

  check('R1.1 no year is sent', /\b(19|20)\d\d\b/.test(masked), false);
  check('R1.2 both years are held back', entities.length, 2);

  const returned = 'The reaction started on 10 August [A] and ended on 12 August [B].';
  const restored = repairOrphanedYears(stripSentinels(restore(returned, entities).text));

  check(
    'R1.3 the report gets the dictated years',
    restored,
    'The reaction started on 10 August 2026 and ended on 12 August 2026.',
  );
  check('R1.4 reconciliation confirms it', reconcile(source, restored).matched, true);
}

check(
  'R2.1 the Malayalam shape is repaired',
  repairOrphanedYears('The response 2026 began on 10 August and 2026 improved by 12 August.'),
  'The response began on 10 August 2026 and improved by 12 August 2026.',
);
check(
  'R2.2 a correct sentence is left alone',
  repairOrphanedYears('The reaction started on 10 August 2026 and ended on 12 August 2026.'),
  'The reaction started on 10 August 2026 and ended on 12 August 2026.',
);
check(
  'R2.3 a year-first date that stayed together is left alone',
  repairOrphanedYears('The reaction began on 2026 August 8.'),
  'The reaction began on 2026 August 8.',
);
check(
  'R2.4 a date with no year anywhere is not invented',
  repairOrphanedYears('The reaction began on 3 August. It ended on 9 August.'),
  'The reaction began on 3 August. It ended on 9 August.',
);
check(
  'R2.5 an age is not mistaken for an orphaned year',
  repairOrphanedYears('He is 34 years old and weighs 70 kg.'),
  'He is 34 years old and weighs 70 kg.',
);
check(
  'R2.6 repair does not cross a sentence boundary',
  repairOrphanedYears('It was 2026. The reaction began on 3 August.'),
  'It was 2026. The reaction began on 3 August.',
);

{
  const mangled =
    'the primary case. The patient has been identified as Rahul Sharma, 34 years old. ' +
    'Sex male. Weight 70 kg. The patient experienced fever, itching and skin rashes. ' +
    'The response 2026 began on 10 August and 2026 improved by 12 August.';

  const before = gradeReport(mangled, {
    caseType: 'Initial',
    initials: 'RS',
    age: '34 Years',
    gender: 'Male',
    weight: '70',
    reactionStartDate: '10/08/2026',
    reactionStopDate: '12/08/2026',
  });
  check(
    'R3.1 the torn sentence fails before repair',
    before.failures.some(entry => entry.name === 'reactionStartDate'),
    true,
  );

  const after = gradeReport(repairOrphanedYears(mangled), {
    caseType: 'Initial',
    initials: 'RS',
    age: '34 Years',
    gender: 'Male',
    weight: '70',
    reactionStartDate: '10/08/2026',
    reactionStopDate: '12/08/2026',
  });
  check('R3.2 and passes after it', after.failures, []);
}

{
  const { entities } = protect('reaction ended 12 August 2026, weight 61.5 kg');
  const partial = restore('reaction ended 12 August, weight [B] kg', entities);

  check('R4.1 the loss is reported', partial.missing.length, 1);
  check('R4.2 the surviving value is restored', partial.text.includes('61.5'), true);
  check(
    'R4.3 no sentinel reaches the report',
    /\[[A-Z]{1,3}\]/.test(stripSentinels(partial.text)),
    false,
  );
  check(
    'R4.4 reconciliation reports the shortfall rather than hiding it',
    reconcile('12 August 2026, 61.5 kg', stripSentinels(partial.text)).matched,
    false,
  );
}
check(
  'R7.1 a dateless second date inherits the dictated year',
  inferMissingYears('The response began on 9 August 2026 and ended on 11 August.', ['2026', '2026']),
  'The response began on 9 August 2026 and ended on 11 August 2026.',
);
check(
  'R7.2 it works without punctuation',
  inferMissingYears('Started on 9th August 2026 Response Stopped on 11th August', ['2026', '2026']),
  'Started on 9th August 2026 Response Stopped on 11th August 2026',
);
check(
  'R7.3 nothing is inferred when the dictation spans two years',
  inferMissingYears('began on 3 August 2026 and ended on 2 January 2027.', ['2026', '2027']),
  'began on 3 August 2026 and ended on 2 January 2027.',
);
check(
  'R7.4 nothing is inferred when the source gave no year',
  inferMissingYears('began on 3 August and ended on 9 August.', []),
  'began on 3 August and ended on 9 August.',
);
check(
  'R7.5 a complete date is left alone',
  inferMissingYears('began on 10 August 2026 and ended on 12 August 2026.', ['2026', '2026']),
  'began on 10 August 2026 and ended on 12 August 2026.',
);
check(
  'R7.6 an age is not mistaken for a date',
  inferMissingYears('He is 34 years old and weighs 70 kg.', ['2026']),
  'He is 34 years old and weighs 70 kg.',
);

{
  const expected = {
    caseType: 'Initial',
    initials: 'AP',
    age: '38 Years',
    gender: 'Male',
    weight: '74',
    reactionStartDate: '09/08/2026',
    reactionStopDate: '11/08/2026',
  };
  const dropped =
    'The patient has been identified as Arjun Patel, aged 38 years. The gender is male. ' +
    'It weighs 74 kg. There was fever, cough and itching. ' +
    'The response began on 9 August 2026 and ended on 11 August. ' +
    'The primary case.';

  check(
    'R7.7 the stop date is missing before inference',
    gradeReport(dropped, expected).failures.some(f => f.name === 'reactionStopDate'),
    true,
  );
  check(
    'R7.8 and present after it',
    gradeReport(inferMissingYears(dropped, ['2026', '2026']), expected).failures,
    [],
  );
}

const STATUS_MAP = [
  [401, ERROR_KIND.UNAUTHORIZED],
  [403, ERROR_KIND.UNAUTHORIZED],
  [413, ERROR_KIND.TEXT_TOO_LARGE],
  [422, ERROR_KIND.UNSUPPORTED_LANGUAGE],
  [429, ERROR_KIND.QUOTA_EXCEEDED],
  [500, ERROR_KIND.SERVER_ERROR],
];

for (const [status, kind] of STATUS_MAP) {
  const result = await run(fake(status, { error: 'upstream detail' }));
  check(`R5.1 HTTP ${status} maps to ${kind}`, result.errorKind, kind);
  check(`R5.2 HTTP ${status} surfaces the upstream message`, result.upstream, 'upstream detail');
}

{
  const result = await run(fake(422, null));
  check('R5.3 an empty error body is survivable', result.errorKind, ERROR_KIND.UNSUPPORTED_LANGUAGE);
  check('R5.4 and reports no upstream detail', result.upstream, '');
}

{
  const secret = 'super-secret-key-value';
  const leaky = await translateTexts({
    texts: ['one'],
    to: 'en',
    key: secret,
    url: URL,
    transport: fake(422, { error: `rejected ${secret}` }),
  });
  check(
    'R5.5 an upstream echo of the key is redacted',
    JSON.stringify(leaky).includes(secret),
    false,
  );
  check('R5.6 but the rest of the message survives', leaky.upstream.includes('rejected'), true);
}

{
  const noItems = await run(fake(200, { unexpected: true }));
  check('R6.1 a body with no items is malformed', noItems.errorKind, ERROR_KIND.MALFORMED);

  const wrongCount = await run(fake(200, { results: ['a', 'b'] }));
  check('R6.2 too many items is a count mismatch', wrongCount.errorKind, ERROR_KIND.COUNT_MISMATCH);

  const empty = await run(fake(200, { results: [''] }));
  check('R6.3 an empty translation is reported', empty.errorKind, ERROR_KIND.EMPTY_TRANSLATION);
}

report();
