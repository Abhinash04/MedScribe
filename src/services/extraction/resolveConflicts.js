import { FIELD_MARKERS } from '../../constants/fieldMarkers.js';

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

    if (combinesAsSentences(candidate.field, current, candidate)) {
      byField[candidate.field] = combineSentences(current, candidate);
      continue;
    }

    if (shouldReplace(current, candidate)) {
      byField[candidate.field] = candidate;
    }
  }

  return byField;
}

const combinesAsSentences = (field, current, next) =>
  FIELD_MARKERS[field]?.combine === 'sentences' &&
  typeof current.value === 'string' &&
  typeof next.value === 'string';

const bare = value =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const denies = value => /^(?:no|not|never|denies|denied|nothing|negative|non)\b/.test(bare(value));

const restates = (outer, inner) =>
  !!inner && !!outer && ` ${outer} `.includes(` ${inner} `);

function combineSentences(current, next) {
  const [first, second] = next.start > current.start ? [current, next] : [next, current];

  if (second.retracts) {
    return second;
  }

  if (denies(first.value) === denies(second.value)) {
    const firstBare = bare(first.value);
    const secondBare = bare(second.value);
    if (restates(secondBare, firstBare)) {
      const end = second.start - first.end < 100 ? second.end : first.end;
      return { ...second, start: first.start, end };
    }
    if (restates(firstBare, secondBare)) {
      const end = second.start - first.end < 100 ? second.end : first.end;
      return { ...first, start: first.start, end };
    }
  }

  const value = [first.value, second.value]
    .map(part => String(part ?? '').trim().replace(/[.\s]+$/, ''))
    .filter(Boolean)
    .join('. ');

  const end = Math.abs(second.start - first.end) < 100 ? Math.max(current.end, next.end) : first.end;

  return {
    ...(next.confidence > current.confidence ? next : current),
    value,
    start: Math.min(current.start, next.start),
    end,
  };
}

function dropRestatements(items) {
  const bares = items.map(bare);
  return items.filter(
    (_, index) =>
      !bares.some(
        (other, position) =>
          position !== index &&
          restates(other, bares[index]) &&
          (other.length > bares[index].length || position < index),
      ),
  );
}

function accumulate(current, next) {
  const [first, second] = next.start > current.start ? [current, next] : [next, current];
  const seen = new Set();
  const merged = [...first.value, ...second.value].filter(item => {
    const key = String(item).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const value = dropRestatements(merged);

  const winner = shouldReplace(current, next) ? next : current;
  return {
    ...winner,
    value,
    start: Math.min(current.start, next.start),
    end: Math.max(current.end, next.end),
  };
}

function shouldReplace(current, next) {
  if (Math.abs(next.confidence - current.confidence) > 0.001) {
    return next.confidence > current.confidence;
  }
  return next.start > current.start;
}
