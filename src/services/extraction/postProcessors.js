import {
  DIAGNOSIS_HEDGE_PATTERN,
  LEADING_TRIM_PATTERN,
  RESTATED_LABEL_PATTERN,
  TRAILING_TRIM_PATTERN,
} from '../../constants/fieldMarkers.js';
import { splitFindings } from './detectNegation.js';
import {
  digitGroups,
  normalizeIndianMobile,
  pickPin,
  spokenDigits,
} from './parseNumbers.js';
import { splitMedications } from './parseMedication.js';

/** Stage 5 — turn a raw segment into the value the report displays. */

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

/**
 * Words that cannot be part of a patient name, used as the right-hand
 * boundary when no punctuation is available.
 */
const NAME_STOPWORDS = new Set([
  'she', 'he', 'they', 'her', 'his', 'their', 'hers', 'him', 'them',
  // Contractions survive normalization and would otherwise be taken as a
  // third name token: "her name is Hema Sharma she's been…"
  "she's", "he's", "they're", "she'll", "he'll", "i'll", "we'll", "let's",
  "it's", "don't", "doesn't", 'sorry', 'actually', 'female.', 'male.',
  // Hinglish copula: "patient ka naam Hema Sharma hai"
  'hai', 'hain', 'tha', 'thi',
  'is', 'was', 'are', 'were', 'has', 'have', 'had', 'been', 'being',
  'a', 'an', 'the', 'and', 'or', 'but', 'who', 'that', 'this', 'which',
  'patient', 'complains', 'complaining', 'reports', 'presents', 'aged',
  'again', 'named', 'called',
  'age', 'years', 'year', 'old', 'gender', 'sex', 'male', 'female',
  'lives', 'living', 'resides', 'residing', 'address', 'contact', 'phone',
  'mobile', 'diagnosis', 'diagnosed', 'history', 'known', 'suffering',
  'with', 'from', 'of', 'in', 'at', 'on', 'for', 'to',
]);

/**
 * Cues that mark everything before them as retracted.
 *
 * "Age 32 years... sorry, 22 years" is one segment with one marker, so
 * cross-marker last-wins never fires. Splitting here and keeping the tail is
 * what makes intra-segment self-correction work.
 *
 * Note "actually" is absent — it is stripped as a filler in stage 1, so
 * numeric fields additionally take the LAST value in the segment rather than
 * relying on a cue surviving normalization.
 *
 * "no" requires a following comma; a bare "no" would wrongly truncate
 * "no chest pain".
 */
const CORRECTION_CUE =
  /\b(?:sorry|correction|rather|i\s+mean|make\s+that|scratch\s+that|no\s*,\s*(?:use\s+)?)[\s,]*/gi;

/** Keeps only the text after the final correction cue. */
const afterLastCorrection = value => {
  const withoutLabel = text => text.replace(RESTATED_LABEL_PATTERN, '');
  const text = value || '';
  CORRECTION_CUE.lastIndex = 0;
  let cut = 0;
  let match = CORRECTION_CUE.exec(text);
  while (match) {
    cut = match.index + match[0].length;
    match = CORRECTION_CUE.exec(text);
  }
  return cut ? withoutLabel(text.slice(cut)) : text;
};

const clean = value =>
  (value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:-]+/, '')
    .replace(/[\s,.;:]+$/, '')
    .trim();

/** Strips a leading connective left over from the marker ("is", "of", "the"). */
const trimLeading = value => {
  let out = clean(value);
  let previous = null;
  while (out !== previous) {
    previous = out;
    out = clean(out.replace(LEADING_TRIM_PATTERN, ''));
  }
  return out;
};

/**
 * Strips a dangling connective at the end. A segment cut at the next marker
 * often ends "…for five days and", and that "and" is not content.
 */
const trimTrailing = value => {
  let out = clean(value);
  let previous = null;
  while (out !== previous) {
    previous = out;
    out = clean(out.replace(TRAILING_TRIM_PATTERN, ''));
  }
  return out;
};

/** Recognizer restarts repeat whole phrases; the same finding is one finding. */
const dedupe = items => {
  const seen = new Set();
  return items.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/**
 * Title-cases a name while preserving meaningful internal capitals.
 *
 * Blindly lowercasing after the first letter turns "McDonald" into "Mcdonald"
 * and "O'Brien" into "O'brien". Each apostrophe/hyphen-delimited sub-token is
 * capitalised instead, and existing internal capitals are left alone unless
 * the whole word is upper case (recognizers sometimes emit "HEMA SHARMA").
 */
const capitalizeToken = token => {
  if (!token) {
    return token;
  }
  const normalized = token === token.toUpperCase() ? token.toLowerCase() : token;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const titleCase = value =>
  trimLeading(value)
    .split(' ')
    .filter(Boolean)
    .map(word =>
      word
        .split(/(['’-])/)
        .map(part => (/['’-]/.test(part) ? part : capitalizeToken(part)))
        .join(''),
    )
    .join(' ');

const sentenceCase = value => {
  const text = trimLeading(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};


const wordsToNumber = phrase => {
  const words = clean(phrase).toLowerCase().split(/[\s-]+/).filter(Boolean);
  let total = 0;
  let matched = false;
  for (const word of words) {
    const value = NUMBER_WORDS[word];
    if (value === undefined) {
      return null;
    }
    total += value;
    matched = true;
  }
  return matched ? total : null;
};

const processors = {
  /**
   * Names stop at the first non-name token. Speech has no punctuation, so
   * "her name is Hema Sharma she reports fever" would otherwise run on —
   * a stop-word list is the only available boundary.
   */
  name: raw => {
    const tokens = trimLeading(afterLastCorrection(raw)).split(/\s+/).filter(Boolean);
    const kept = [];

    for (const token of tokens) {
      const word = token.replace(/[^A-Za-z.'-]/g, '');
      // Punctuation left by filler-stripping is not a name boundary:
      // "the patient is, uh, Hema Sharma" normalizes to "the patient is , Hema".
      if (!word && /^[.,;:-]+$/.test(token)) {
        continue;
      }
      if (!word || NAME_STOPWORDS.has(word.toLowerCase())) {
        break;
      }
      kept.push(word);
      if (kept.length === 4) {
        break;
      }
    }

    return kept.length ? titleCase(kept.join(' ')) : '';
  },

  age: raw => {
    const text = trimLeading(afterLastCorrection(raw));

    // LAST plausible number, not the first — "age 32 years... sorry, 22 years"
    // and "age 21 years... actually 22 years" both mean the later value.
    const digits = [...text.matchAll(/\b(\d{1,3})\b/g)]
      .map(m => parseInt(m[1], 10))
      .filter(n => n > 0 && n < 130);
    if (digits.length) {
      return `${digits[digits.length - 1]} Years`;
    }

    // Spoken: "twenty-two". Longest-first — a lazy read stops at "twenty".
    const words = text.toLowerCase().split(/[\s-]+/).filter(Boolean);
    for (let start = 0; start < words.length; start += 1) {
      for (let take = Math.min(3, words.length - start); take >= 1; take -= 1) {
        const parsed = wordsToNumber(words.slice(start, start + take).join(' '));
        if (parsed !== null && parsed > 0 && parsed < 130) {
          return `${parsed} Years`;
        }
      }
    }
    return '';
  },

  gender: raw => {
    const text = trimLeading(raw);
    // "female" before "male" — "male" is a substring of "female".
    if (/\b(?:female|woman|lady|girl)\b/i.test(text)) {
      return 'Female';
    }
    if (/\b(?:male|man|gentleman|boy)\b/i.test(text)) {
      return 'Male';
    }
    if (/\btransgender\b/i.test(text)) {
      return 'Transgender';
    }
    return '';
  },

  pinCode: raw => {
    const text = trimLeading(afterLastCorrection(raw));

    const grouped = pickPin(digitGroups(text).map(group => group.digits));
    if (grouped) {
      return grouped;
    }

    // Spoken: "one one zero zero seven eight".
    const spoken = spokenDigits(text);
    return spoken.length === 6 ? spoken : '';
  },

  /**
   * Handles "9876543210", "98765 43210", "+91 …" and spelled-out digits.
   *
   * Takes the LAST valid number so a self-correction wins — "9876543218...
   * correction, 9876543210" — and reduces every form to the bare ten digits
   * the report stores.
   */
  phone: raw => {
    const text = trimLeading(afterLastCorrection(raw));

    const grouped = digitGroups(text)
      .map(group => normalizeIndianMobile(group.digits))
      .filter(Boolean);
    if (grouped.length) {
      return grouped[grouped.length - 1];
    }

    return normalizeIndianMobile(spokenDigits(text));
  },

  /**
   * Splits on commas and "and". Bare spaces are deliberately NOT separators —
   * that would shatter "back pain" and "shortness of breath".
   */
  symptomList: raw =>
    dedupe(
      splitFindings(trimTrailing(trimLeading(afterLastCorrection(raw))))
        .positive.map(item => sentenceCase(item.replace(/\bhai\b/gi, '')))
        .filter(item => item.length > 1),
    ),

  /** One entry per drug, wording untouched. */
  medicationList: raw =>
    dedupe(
      splitMedications(trimTrailing(trimLeading(afterLastCorrection(raw))))
        .map(entry => sentenceCase(entry))
        .filter(entry => entry.length > 1),
    ),

  /**
   * Text fields also honour a bare ellipsis as a retraction:
   * "diagnosis bacterial infection... actually viral infection" loses its
   * "actually" cue to filler-stripping in stage 1, leaving only the "..." to
   * signal that the doctor replaced the value.
   */
  /**
   * Diagnosis carries its own hedge stripping. "Looks like viral fever" is
   * scaffolding; "suspected dengue" is the doctor's degree of certainty and
   * survives untouched.
   */
  diagnosis: raw => {
    let out = processors.text(raw);
    let previous = null;
    while (out !== previous) {
      previous = out;
      // Re-trim after each hedge: "most likely a viral infection" leaves a
      // bare article behind once the hedge goes.
      out = trimLeading(out.replace(DIAGNOSIS_HEDGE_PATTERN, ''));
    }
    return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
  },

  text: raw => {
    const corrected = afterLastCorrection(raw);
    const parts = corrected.split(/\.{2,}/);
    const tail = parts[parts.length - 1];
    return trimTrailing(
      sentenceCase(parts.length > 1 && tail.trim().length > 2 ? tail : corrected),
    );
  },
};

/**
 * The text that survives a retraction, exported so callers reading a segment
 * for anything other than its value — denial collection, for one — see what
 * the doctor actually meant rather than what they took back.
 */
export const retractionTail = raw => afterLastCorrection(raw || '');

/** Shared so `classifySegment` trims a segment exactly as a value is trimmed. */
export const trimTrailingConnectives = trimTrailing;

export function applyPostProcessor(name, raw) {
  const processor = processors[name] || processors.text;
  return processor(raw);
}
