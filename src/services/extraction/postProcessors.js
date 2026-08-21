import {
  DIAGNOSIS_HEDGE_PATTERN,
  LEADING_TRIM_PATTERN,
  RESTATED_LABEL_PATTERN,
  TRAILING_LEAD_IN_PATTERN,
  TRAILING_TRIM_PATTERN,
} from '../../constants/fieldMarkers.js';
import {
  NON_FINDINGS,
  SYMPTOM_MODIFIERS,
  SYMPTOM_TERMS,
} from '../../constants/clinicalCues.js';
import { splitFindings } from './detectNegation.js';
import {
  digitGroups,
  normalizeIndianMobile,
  pickPin,
  spokenDigits,
} from './parseNumbers.js';
import { splitMedications } from './parseMedication.js';

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

const NAME_STOPWORDS = new Set([
  'she', 'he', 'they', 'her', 'his', 'their', 'hers', 'him', 'them',"she's", "he's", "they're", "she'll", "he'll", "i'll", "we'll", "let's", "it's", "don't", "doesn't", 'sorry', 'actually', 'female.', 'male.', 'hai', 'hain', 'tha', 'thi', 'is', 'was', 'are', 'were', 'has', 'have', 'had', 'been', 'being', 'a', 'an', 'the', 'and', 'or', 'but', 'who', 'that', 'this', 'which','patient', 'complains', 'complaining', 'reports', 'presents', 'aged','again', 'named', 'called','age', 'years', 'year', 'old', 'gender', 'sex', 'male', 'female','lives', 'living', 'resides', 'residing', 'address', 'contact', 'phone','mobile', 'diagnosis', 'diagnosed', 'history', 'known', 'suffering','with', 'from', 'of', 'in', 'at', 'on', 'for', 'to',
]);

const CORRECTION_CUE =
  /\b(?:sorry|correction|rather|i\s+mean|make\s+that|scratch\s+that|no\s*,\s*(?:use\s+)?)[\s,]*/gi;

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

const trimLeading = value => {
  let out = clean(value);
  let previous = null;
  while (out !== previous) {
    previous = out;
    out = clean(out.replace(LEADING_TRIM_PATTERN, ''));
  }
  return out;
};

const trimTrailing = value => {
  let out = clean(value);
  let previous = null;
  while (out !== previous) {
    previous = out;
    out = clean(out.replace(TRAILING_LEAD_IN_PATTERN, ''));
    out = clean(out.replace(TRAILING_TRIM_PATTERN, ''));
  }
  return out;
};

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

const capitalizeToken = token => {
  if (!token) {
    return token;
  }
  if (/^[A-Z]{2,4}$/.test(token)) {
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

const MODIFIERS = new Set(SYMPTOM_MODIFIERS);
const TERMS = [...SYMPTOM_TERMS].sort(
  (a, b) => b.split(' ').length - a.split(' ').length,
);

const splitKnownFindings = value => {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return [value];
  }

  const parts = [];
  let index = 0;

  while (index < words.length) {
    const start = index;
    while (MODIFIERS.has(words[index]?.toLowerCase())) {
      index += 1;
    }

    const term = TERMS.find(candidate => {
      const size = candidate.split(' ').length;
      return (
        words
          .slice(index, index + size)
          .join(' ')
          .toLowerCase() === candidate
      );
    });

    if (!term) {
      return [value];
    }

    index += term.split(' ').length;
    parts.push(words.slice(start, index).join(' '));
  }

  return parts.length > 1 ? parts : [value];
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
  name: raw => {
    const tokens = trimLeading(afterLastCorrection(raw)).split(/\s+/).filter(Boolean);
    const kept = [];

    for (const token of tokens) {
      const word = token.replace(/[^A-Za-z.'-]/g, '');
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

    const plausible = ([, value]) => {
      const parsed = parseInt(value, 10);
      return parsed > 0 && parsed < 130;
    };

    const united = [...text.matchAll(/\b(\d{1,3})\s*(?:-\s*)?(?:years?|yrs?)\b/gi)]
      .filter(plausible)
      .map(match => parseInt(match[1], 10));
    if (united.length) {
      return `${united[united.length - 1]} Years`;
    }

    const digits = [...text.matchAll(/\b(\d{1,3})\b/g)]
      .filter(plausible)
      .map(match => parseInt(match[1], 10));
    if (digits.length) {
      return `${digits[digits.length - 1]} Years`;
    }

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

  gender: (raw, segment) => {
    const text = trimLeading(raw);
    const source = segment?.source || '';
    if (/\btransgender\b/i.test(text) || /\btransgender\b/i.test(source)) {
      return 'Transgender';
    }
    if (/\b(?:female|woman|lady|girl)\b/i.test(text)) {
      return 'Female';
    }
    if (/\b(?:male|man|gentleman|boy)\b/i.test(text)) {
      return 'Male';
    }
    return '';
  },

  pinCode: raw => {
    const text = trimLeading(afterLastCorrection(raw));

    const grouped = pickPin(digitGroups(text).map(group => group.digits));
    if (grouped) {
      return grouped;
    }
    const spoken = spokenDigits(text);
    return spoken.length === 6 ? spoken : '';
  },

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

  symptomList: raw =>
    dedupe(
      splitFindings(trimTrailing(trimLeading(afterLastCorrection(raw))))
        .positive.flatMap(item => splitKnownFindings(item.replace(/\bhai\b/gi, '').trim()))
        .map(item => sentenceCase(item))
        .filter(item => item.length > 1 && !NON_FINDINGS.has(item.toLowerCase())),
    ),

  medicationList: raw =>
    dedupe(
      splitMedications(trimTrailing(trimLeading(afterLastCorrection(raw))))
        .map(entry => sentenceCase(entry))
        .filter(entry => entry.length > 1),
    ),

  diagnosis: raw => {
    let out = processors.text(raw);
    let previous = null;
    while (out !== previous) {
      previous = out;
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

  dateString: raw => {
    if (!raw || typeof raw !== 'string') return '';
    const text = afterLastCorrection(raw).trim();
    if (!text) return '';
    const numericMatch = text.match(/\b([0-3]?\d)[/.-]([0-1]?\d)[/.-](\d{4})\b/);
    if (numericMatch) {
      const day = numericMatch[1].padStart(2, '0');
      const month = numericMatch[2].padStart(2, '0');
      const year = numericMatch[3];
      return `${day}/${month}/${year}`;
    }
    const MONTHS = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
      aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10', october: '10',
      nov: '11', november: '11', dec: '12', december: '12',
    };
    const wordMatch = text.match(/\b([0-3]?\d)(?:st|nd|rd|th)?(?:\s+of)?\s+([a-zA-Z]+)\s+(\d{4})\b/i);
    if (wordMatch) {
      const day = wordMatch[1].padStart(2, '0');
      const monthKey = wordMatch[2].toLowerCase();
      const month = MONTHS[monthKey] || MONTHS[monthKey.slice(0, 3)];
      const year = wordMatch[3];
      if (month) return `${day}/${month}/${year}`;
    }
    const wordMatchAlt = text.match(/\b([a-zA-Z]+)\s+([0-3]?\d)(?:st|nd|rd|th)?[\s,]+(\d{4})\b/i);
    if (wordMatchAlt) {
      const monthKey = wordMatchAlt[1].toLowerCase();
      const month = MONTHS[monthKey] || MONTHS[monthKey.slice(0, 3)];
      const day = wordMatchAlt[2].padStart(2, '0');
      const year = wordMatchAlt[3];
      if (month) return `${day}/${month}/${year}`;
    }
    const yearFirst = text.match(/\b(\d{4})\s+([a-zA-Z]+)\s+([0-3]?\d)(?:st|nd|rd|th)?\b/i);
    if (yearFirst) {
      const monthKey = yearFirst[2].toLowerCase();
      const month = MONTHS[monthKey] || MONTHS[monthKey.slice(0, 3)];
      const day = yearFirst[3].padStart(2, '0');
      if (month) return `${day}/${month}/${yearFirst[1]}`;
    }
    return text;
  },

  weight: raw => {
    if (!raw || typeof raw !== 'string') return '';
    const text = afterLastCorrection(raw).trim();
    const match = text.match(/(\d+(?:\.\d+)?)\s*(?:kilos?|kilograms?|kg)?/i);
    if (match) return match[1];

    const words = text.toLowerCase().split(/[\s-]+/).filter(Boolean);
    for (let start = 0; start < words.length; start += 1) {
      for (let take = Math.min(3, words.length - start); take >= 1; take -= 1) {
        const parsed = wordsToNumber(words.slice(start, start + take).join(' '));
        if (parsed !== null && parsed > 0 && parsed < 500) {
          return `${parsed}`;
        }
      }
    }
    return text;
  },

  caseType: (raw, segment) => {
    const text = ((raw || '') + ' ' + (segment?.source || '')).toLowerCase();
    if (/\b(?:follow[- ]up)\b/i.test(text)) {
      return 'Follow-up';
    }
    if (/\b(?:initial|first|first-time|new)\b/i.test(text)) {
      return 'Initial';
    }
    return '';
  },

  reactionManagement: (raw, segment) => {
    const rawStr = typeof raw === 'string' ? raw.trim() : '';
    const srcStr = typeof segment?.source === 'string' ? segment.source.trim() : '';
    const combined = rawStr ? `${srcStr} ${rawStr}` : srcStr;
    return trimTrailing(sentenceCase(combined.trim()));
  },
};

export const retractionTail = raw => afterLastCorrection(raw || '');
export const trimTrailingConnectives = trimTrailing;
export function applyPostProcessor(name, raw, segment) {
  const processor = processors[name] || processors.text;
  return processor(raw, segment);
}
