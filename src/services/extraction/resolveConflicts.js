import { FIELD_MARKERS } from '../../constants/fieldMarkers.js';

/**
 * Stage 7 — pick one candidate per field.
 *
 * Policy, in order:
 *   1. Last occurrence wins. A doctor restating a field is normally correcting
 *      themselves ("age 22... sorry, 42"), so the later value is the intended
 *      one. This is a deliberate choice, not an accident of iteration order.
 *   2. Ties broken by field priority, then by confidence.
 *
 * @param {Array} candidates validated candidates
 * @returns {Object} field key -> winning candidate
 */
export function resolveConflicts(candidates) {
  const byField = {};

  for (const candidate of candidates) {
    const current = byField[candidate.field];

    if (!current) {
      byField[candidate.field] = candidate;
      continue;
    }

    if (shouldReplace(current, candidate)) {
      byField[candidate.field] = candidate;
    }
  }

  return byField;
}

function shouldReplace(current, next) {
  // Confidence first. Position alone would let a weak late marker beat an
  // explicit early one — "advised to undergo CBC" overriding "prescribing
  // paracetamol 500mg". Self-correction is unaffected: a repeated marker has
  // equal confidence, so the position tie-break below still picks the later,
  // corrected value.
  if (Math.abs(next.confidence - current.confidence) > 0.001) {
    return next.confidence > current.confidence;
  }

  // Equal confidence — later in the transcript wins (self-correction).
  if (next.start !== current.start) {
    return next.start > current.start;
  }

  const currentPriority = FIELD_MARKERS[current.field]?.priority ?? 0;
  const nextPriority = FIELD_MARKERS[next.field]?.priority ?? 0;
  return nextPriority > currentPriority;
}
