/**
 * Numeric candidates, shared by every field that reads digits.
 *
 * Speech recognisers group digits arbitrarily — "11 00 70", "955 677 4130",
 * "+91-9556-774130" — so the underlying number has to be recovered from the
 * grouping rather than matched literally. Only whitespace and hyphens join a
 * run; every other character ends it, which is what stops a PIN from swallowing
 * the phone number in the next sentence.
 */

const DIGIT_WORDS = {
  zero: '0', oh: '0', o: '0', nought: '0', one: '1', two: '2', three: '3',
  four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

/** Maximal digit runs, joined only across spaces and hyphens. */
export function digitGroups(text) {
  const source = String(text || '');
  const groups = [];
  const pattern = /\d(?:[\s-]*\d)*/g;

  let match = pattern.exec(source);
  while (match) {
    groups.push({
      digits: match[0].replace(/\D/g, ''),
      raw: match[0],
      index: match.index,
    });
    match = pattern.exec(source);
  }

  return groups;
}

/** Longest run of consecutive spoken digit words anywhere in the text. */
export function spokenDigits(text) {
  const words = String(text || '')
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);

  let best = '';
  let run = '';

  for (const word of words) {
    const digit = DIGIT_WORDS[word];
    if (digit === undefined) {
      if (run.length > best.length) {
        best = run;
      }
      run = '';
      continue;
    }
    run += digit;
  }

  return run.length > best.length ? run : best;
}

/** Indian PIN: exactly six digits, never starting at zero. */
export function pickPin(candidates) {
  const valid = candidates.filter(
    value => value.length === 6 && /^[1-9]/.test(value),
  );
  return valid.length ? valid[valid.length - 1] : '';
}

/**
 * Reduces a dictated Indian mobile number to its ten digits.
 *
 * "+91 9556774130", "91 955 677 4130" and "09556774130" are the same number,
 * and the report stores the bare ten digits. A candidate that cannot be reduced
 * to a plausible ten-digit mobile is rejected rather than stored half-parsed —
 * a country code is only meaningful attached to a real number.
 */
export function normalizeIndianMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return plausible(digits.slice(2));
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return plausible(digits.slice(1));
  }
  return plausible(digits);
}

function plausible(digits) {
  return digits.length === 10 && /^[6-9]/.test(digits) ? digits : '';
}
