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
 *   3. List fields accumulate instead. "Complains of fever and cough... she
 *      also complains of headache" is three findings, not one — a doctor
 *      adding to a list is adding, not correcting. Retractions and negations
 *      are already removed before this stage, so nothing the doctor took back
 *      can survive the union.
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

    if (Array.isArray(current.value) && Array.isArray(candidate.value)) {
      byField[candidate.field] = accumulate(current, candidate);
      continue;
    }

    if (shouldReplace(current, candidate)) {
      byField[candidate.field] = candidate;
    }
  }

  return byField;
}

function accumulate(current, next) {
  const [first, second] = next.start > current.start ? [current, next] : [next, current];
  const seen = new Set();
  const value = [...first.value, ...second.value].filter(item => {
    const key = String(item).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  const winner = shouldReplace(current, next) ? next : current;
  return {
    ...winner,
    value,
    start: Math.min(current.start, next.start),
    end: Math.max(current.end, next.end),
  };
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
