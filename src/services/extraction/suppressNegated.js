import { negatedRanges } from './detectNegation.js';

/**
 * Drops candidates the doctor negated or cancelled.
 *
 * Segment markers fire inside a negation just as readily as outside it — the
 * `history of` marker matches "no history of diabetes" and would record
 * diabetes as a positive condition. Symptoms are already handled item-by-item
 * in `splitFindings`; this covers the scalar fields and cancelled medication.
 */

/** "Correction, do not start Paracetamol" cancels an earlier prescription. */
const CANCEL_INSTRUCTION =
  /\b(?:do\s+not|dont|don't|not|no|never)\s+(?:start|give|take|continue|use|prescribe)\b/i;

/** A retraction cue just before a negation makes it cancel what came before. */
const CORRECTION_CUE = /\b(?:correction|sorry|actually|i\s+mean|scratch\s+that)\b/i;
const LOOKBACK = 24;

const INSTRUCTION_WORDS = new Set([
  'start', 'give', 'take', 'continue', 'use', 'prescribe', 'stop', 'with',
  'that', 'this', 'correction', 'patient', 'daily', 'twice', 'once', 'thrice',
  'tablet', 'tablets', 'syrup', 'injection', 'milligrams', 'milligram',
  'history', 'medical', 'significant', 'known', 'case',
]);

/** "diabetes" and "diabetic" are the same condition to a canceller. */
const stem = word => word.slice(0, 6);

const drugTokens = slice =>
  (slice.toLowerCase().match(/[a-z]{4,}/g) || []).filter(
    word => !INSTRUCTION_WORDS.has(word),
  );

const NEGATION_SENSITIVE = new Set([
  'medicalHistory',
  'diagnosis',
  'prescriptionNotes',
]);

export function suppressNegated(text, candidates) {
  const ranges = negatedRanges(text);
  if (!ranges.length) {
    return { candidates, negatedHistory: null };
  }

  // A negation only cancels an EARLIER positive when the doctor signalled a
  // retraction. Without that guard "no chest pain" would delete an unrelated
  // finding that merely shares a word.
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

    if (range && NEGATION_SENSITIVE.has(candidate.field)) {
      if (candidate.field === 'medicalHistory' && !negatedHistory) {
        negatedHistory = text.slice(range.start, range.end).trim();
      }
      continue;
    }

    if (
      cancelled.length &&
      (candidate.field === 'prescriptionNotes' || candidate.field === 'medicalHistory')
    ) {
      const words = new Set(
        String(
          Array.isArray(candidate.value)
            ? candidate.value.join(' ')
            : candidate.value,
        )
          .toLowerCase()
          .match(/[a-z]{4,}/g) || [],
      );
      const stems = new Set([...words].map(stem));
      if (cancelled.some(drug => stems.has(drug))) {
        continue;
      }
    }

    kept.push(candidate);
  }

  return { candidates: kept, negatedHistory };
}
