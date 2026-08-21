globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import {
  isDigitChar,
  numeralTokens,
  sameNumerals,
  toLatinDigits,
} from '../src/utils/numerals.js';
import {
  protect,
  reconcile,
  restore,
  sentinelFor,
  stripSentinels,
} from '../src/services/pravah/protectNumerals.js';
import {
  planBatches,
  splitForTranslation,
} from '../src/services/pravah/chunkText.js';
import { MAX_BATCH_CHARS, MAX_BATCH_ITEMS } from '../src/services/pravah/translationClient.js';

import { check, report } from './lib/fixture-harness.mjs';

const BLOCKS = {
  ascii: '0123456789',
  arabic: '٠١٢٣٤٥٦٧٨٩',
  extendedArabic: '۰۱۲۳۴۵۶۷۸۹',
  devanagari: '०१२३४५६७८९',
  bengali: '০১২৩৪৫৬৭৮৯',
  gurmukhi: '੦੧੨੩੪੫੬੭੮੯',
  gujarati: '૦૧૨૩૪૫૬૭૮૯',
  odia: '୦୧୨୩୪୫୬୭୮୯',
  tamil: '௦௧௨௩௪௫௬௭௮௯',
  telugu: '౦౧౨౩౪౫౬౭౮౯',
  kannada: '೦೧೨೩೪೫೬೭೮೯',
  malayalam: '൦൧൨൩൪൫൬൭൮൯',
};

for (const [name, digits] of Object.entries(BLOCKS)) {
  check(`N1.1 ${name} maps to ASCII`, toLatinDigits(digits), '0123456789');
  check(
    `N1.2 ${name} digits are recognised`,
    [...digits].filter(char => !isDigitChar(char)),
    [],
  );
}

check('N1.3 letters are untouched', toLatinDigits('August'), 'August');
check('N1.4 an empty value is safe', toLatinDigits(''), '');
check('N1.5 null is safe', toLatinDigits(null), '');
check(
  'N1.6 an Odia date becomes readable',
  toLatinDigits('୧୨ ଅଗଷ୍ଟ ୨୦୨୬'),
  '12 ଅଗଷ୍ଟ 2026',
);
check('N1.7 a letter is not a digit', isDigitChar('A'), false);
check('N2.1 reading order is preserved', numeralTokens('10 August 2026'), ['10', '2026']);
check('N2.2 a decimal stays whole', numeralTokens('61.5 kg'), ['61.5']);
check(
  'N2.3 Odia numerals tokenise like ASCII',
  numeralTokens('୧୦ ଅଗଷ୍ଟ ୨୦୨୬'),
  ['10', '2026'],
);
check('N2.4 no numbers yields nothing', numeralTokens('no digits here'), []);
check(
  'N2.5 mixed scripts in one string',
  numeralTokens('34 years, ୭୦ kg'),
  ['34', '70'],
);
check('N2.6 sameNumerals is order sensitive', sameNumerals('10 2026', '2026 10'), false);
check('N2.7 sameNumerals across scripts', sameNumerals('୧୨', '12'), true);

{
  const source = 'ପ୍ରତିକ୍ରିୟା ୧୦ ଅଗଷ୍ଟ ୨୦୨୬ ରେ ଆରମ୍ଭ ହୋଇ ୧୨ ଅଗଷ୍ଟ ୨୦୨୬ ରେ ଶେଷ ହେଲା। ଓଜନ ୬୧.୫ କିଲୋ।';
  const { masked, entities } = protect(source);

  check('N3.1 years and decimals are masked', entities.length, 3);
  check(
    'N3.2 the masked values are the two years and the decimal weight',
    entities.map(entry => entry.value),
    ['2026', '2026', '61.5'],
  );
  check('N3.3 the days stay in place beside their month', /\b10\b.*\b12\b/s.test(masked), true);
  check('N3.4 tokens are unique', new Set(entities.map(e => e.token)).size, 3);
  check('N3.5 masked values are ASCII-normalised', /[୦-୯]/.test(masked), false);

  const translated =
    'The reaction started on 10 August [A] and ended on 12 August [B]. Weight [C] kg.';
  const { text, restored, missing, duplicated } = restore(translated, entities);

  check('N3.6 every token is restored', restored, 3);
  check('N3.7 nothing went missing', missing, []);
  check('N3.8 nothing was duplicated', duplicated, []);
  check(
    'N3.9 the real numbers come back in a parseable date',
    text,
    'The reaction started on 10 August 2026 and ended on 12 August 2026. Weight 61.5 kg.',
  );
  check('N3.10 reconciliation agrees', reconcile(source, text).matched, true);
}

check('N3.11 a bare day is not masked', protect('on 10 August').entities, []);
check('N3.12 an age is not masked', protect('aged 34 years').entities, []);
check('N3.13 a whole-number weight is not masked', protect('70 kg').entities, []);
check(
  'N3.14 a decimal weight is masked',
  protect('61.5 kg').entities.map(e => e.value),
  ['61.5'],
);
check(
  'N3.15 a four-digit year is masked',
  protect('in 2026').entities.map(e => e.value),
  ['2026'],
);
check('N3.16 a six-digit PIN is left alone', protect('PIN 411001').entities, []);

{
  const { entities } = protect('started 10 August 2026 weighing 61.5 kg');
  check('N4.0 two values are protected', entities.length, 2);

  const dropped = restore('started 10 August weighing [B] kg', entities);
  check('N4.1 a dropped token is reported', dropped.missing.length, 1);
  check(
    'N4.2 and the survivors are still restored',
    dropped.text,
    'started 10 August weighing 61.5 kg',
  );
  check(
    'N4.3 a dropped token leaves no marker behind',
    /\[[A-Z]\]/.test(stripSentinels(dropped.text)),
    false,
  );

  const doubled = restore('on [A] and again [A], weighing [B]', entities);
  check('N4.4 a duplicated token is reported', doubled.duplicated.length, 1);

  const reordered = restore('weighing [B], during [A]', entities);
  check(
    'N4.5 reordering is harmless because tokens carry identity',
    reordered.text,
    'weighing 61.5, during 2026',
  );
}

check(
  'N4.6 reconcile notices a changed year',
  reconcile('10 August 2026', 'The reaction started on 10 August 2022').matched,
  false,
);
check(
  'N4.7 reconcile reports what was lost',
  reconcile('10 August 2026', '10 August 2022').lost,
  ['2026'],
);
check(
  'N4.8 reconcile accepts a faithful translation',
  reconcile('୧୦ ଅଗଷ୍ଟ ୨୦୨୬', 'on 10 August 2026').matched,
  true,
);

{
  const long = Array.from(
    { length: 40 },
    (unused, index) => `Sentence ${index} recorded ${index * 7} units on 10 August 2026.`,
  ).join(' ');
  const { masked, entities } = protect(long);
  const chunks = splitForTranslation(masked);
  const batches = planBatches(chunks, {
    maxItems: MAX_BATCH_ITEMS,
    maxChars: MAX_BATCH_CHARS,
  });
  const rejoined = batches.flat().join(' ');

  check('N5.1 the text really was split', chunks.length > 1, true);
  check(
    'N5.2 every token survives chunking',
    entities.filter(entry => !rejoined.includes(entry.token)).map(entry => entry.token),
    [],
  );
  check(
    'N5.3 batching preserves chunk order',
    batches.flat().length,
    chunks.length,
  );
}

check('N6.1 the first sentinel', sentinelFor(0), '[A]');
check('N6.2 the twenty-sixth', sentinelFor(25), '[Z]');
check('N6.3 rolls over to two letters', sentinelFor(26), '[AA]');
check(
  'N6.4 no sentinel contains a digit',
  Array.from({ length: 60 }, (unused, i) => sentinelFor(i)).filter(t => /\d/.test(t)),
  [],
);
check(
  'N6.5 sixty sentinels are all distinct',
  new Set(Array.from({ length: 60 }, (unused, i) => sentinelFor(i))).size,
  60,
);

check('N7.1 a stray marker is removed', stripSentinels('weight [A] kg'), 'weight kg');
check(
  'N7.2 spacing around punctuation is repaired',
  stripSentinels('started on [A] , August'),
  'started on, August',
);
check('N7.3 ordinary text is untouched', stripSentinels('no markers here'), 'no markers here');
check(
  'N7.4 parenthesised clinical terms are not brackets',
  stripSentinels('urticaria (hives) and oedema'),
  'urticaria (hives) and oedema',
);

{
  const source = 'Age 34 years, weight 70 kg.';
  const first = protect(source);
  const second = protect(source);
  check('N8.1 masking is deterministic', first.masked, second.masked);
  check(
    'N8.2 and round trips exactly',
    restore(first.masked, first.entities).text,
    source,
  );
  check('N8.3 text with no numbers is unchanged', protect('no digits').masked, 'no digits');
  check('N8.4 and yields no entities', protect('no digits').entities, []);
  check('N8.5 empty input is safe', protect('').masked, '');
}

report();
