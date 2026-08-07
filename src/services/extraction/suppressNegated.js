import { ABSENCE_MARKER_SOURCES } from '../../constants/fieldMarkers.js';
import { negatedRanges } from './detectNegation.js';

const CANCEL_INSTRUCTION =
  /\b(?:do\s+not|dont|don't|not|no|never)\s+(?:start|give|take|continue|use|prescribe)\b/i;

export const CORRECTION_CUE = /\b(?:correction|sorry|actually|i\s+mean|scratch\s+that)\b/i;
export const LOOKBACK = 24;

const INSTRUCTION_WORDS = new Set([
  'start', 'give', 'take', 'continue', 'use', 'prescribe', 'stop', 'with',
  'that', 'this', 'correction', 'patient', 'daily', 'twice', 'once', 'thrice',
  'tablet', 'tablets', 'syrup', 'injection', 'milligrams', 'milligram',
  'history', 'medical', 'significant', 'known', 'case',
]);

const stem = word => word.slice(0, 6);

const drugTokens = slice =>
  (slice.toLowerCase().match(/[a-z]{4,}/g) || []).filter(
    word => !INSTRUCTION_WORDS.has(word),
  );

const isCancelled = (value, cancelled) => {
  const stems = new Set(
    (String(value ?? '').toLowerCase().match(/[a-z]{4,}/g) || []).map(stem),
  );
  return cancelled.some(drug => stems.has(drug));
};

const NEGATION_SENSITIVE = new Set([
  'medicalHistory',
  'diagnosis',
  'prescriptionNotes',
]);

export function markRetractions(candidates, original, toOriginal) {
  return candidates.map(candidate => {
    const from = candidate.markerStart ?? candidate.start;
    const at = from > 0 ? toOriginal(from) : 0;
    if (!(at > 0)) {
      return candidate;
    }
    const before = original.slice(Math.max(0, at - LOOKBACK), at);
    return CORRECTION_CUE.test(before) ? { ...candidate, retracts: true } : candidate;
  });
}

export function suppressNegated(text, candidates) {
  const ranges = negatedRanges(text);
  if (!ranges.length) {
    return { candidates, negatedHistory: null };
  }

  const cancelled = [];
  for (const range of ranges) {
    const slice = text.slice(range.start, range.end);
    const before = text.slice(Math.max(0, range.start - LOOKBACK), range.start);
    if (CANCEL_INSTRUCTION.test(slice) || CORRECTION_CUE.test(before)) {
      cancelled.push(...drugTokens(slice).map(stem));
    }
  }

  const kept = [];
  let negatedHistory = null;

  for (const candidate of candidates) {
    const range = ranges.find(
      item => candidate.start >= item.start && candidate.start < item.end,
    );

    const absence = ABSENCE_MARKER_SOURCES.has(candidate.source);

    if (range && NEGATION_SENSITIVE.has(candidate.field) && !absence) {
      if (candidate.field === 'medicalHistory' && !negatedHistory) {
        negatedHistory = {
          text: text.slice(range.start, range.end).trim(),
          start: range.start,
          end: range.end,
        };
      }
      continue;
    }

    if (
      cancelled.length &&
      !absence &&
      (candidate.field === 'prescriptionNotes' || candidate.field === 'medicalHistory')
    ) {
      if (Array.isArray(candidate.value)) {
        const surviving = candidate.value.filter(entry => !isCancelled(entry, cancelled));
        if (!surviving.length) {
          continue;
        }
        kept.push({ ...candidate, value: surviving });
        continue;
      }

      if (isCancelled(candidate.value, cancelled)) {
        continue;
      }
    }

    kept.push(candidate);
  }

  return { candidates: kept, negatedHistory };
}
