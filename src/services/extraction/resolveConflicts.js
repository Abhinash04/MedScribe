/**
 * Stage 7 — pick one candidate per field.
 *
 * Policy, in order:
 *   1. Higher confidence wins. Without this a weak late marker ("advised to
 *      undergo CBC") overrides an explicit early one ("prescribing
 *      paracetamol 500mg").
 *   2. At equal confidence, the LATER occurrence wins. A doctor restating a
 *      field is normally correcting themselves ("age 22... sorry, 42"), and a
 *      repeated marker carries equal confidence, so this is what makes
 *      self-correction work.
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
  // Candidates for one field cannot share a start offset, so there is no
  // further tie to break.
  return next.start > current.start;
}
