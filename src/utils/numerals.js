const DIGIT_BASES = [
  0x0030,
  0x0660,
  0x06f0,
  0x0966,
  0x09e6,
  0x0a66,
  0x0ae6,
  0x0b66,
  0x0be6,
  0x0c66,
  0x0ce6,
  0x0d66,
];

const digitValue = codePoint => {
  for (const base of DIGIT_BASES) {
    if (codePoint >= base && codePoint <= base + 9) {
      return codePoint - base;
    }
  }
  return -1;
};

export const isDigitChar = char => digitValue(String(char).codePointAt(0) ?? -1) >= 0;

export function toLatinDigits(text) {
  return [...String(text ?? '')]
    .map(char => {
      const value = digitValue(char.codePointAt(0));
      return value >= 0 ? String(value) : char;
    })
    .join('');
}

export function numeralTokens(text) {
  return toLatinDigits(text).match(/\d+(?:\.\d+)?/g) ?? [];
}

export const sameNumerals = (left, right) => {
  const a = numeralTokens(left);
  const b = numeralTokens(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
};
