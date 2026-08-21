import { CONFIDENCE } from '../../constants/fieldMarkers.js';
import { findingsInSource } from '../../constants/symptomLexicon/index.js';

const asList = value => {
  if (Array.isArray(value)) {
    return value;
  }
  return typeof value === 'string' && value.trim() ? [value.trim()] : [];
};

const sameFinding = (left, right) =>
  String(left).trim().toLowerCase() === String(right).trim().toLowerCase();

const titleCase = term =>
  term.replace(/\b[a-z]/, character => character.toUpperCase());

export function reconcileFindings(record, sourceText, language) {
  const inSource = findingsInSource(sourceText, language);
  if (!inSource.length) {
    return { record, added: [] };
  }

  const existing = asList(record?.symptoms?.value);
  const missing = inSource.filter(
    term => !existing.some(entry => sameFinding(entry, term) || entry.toLowerCase().includes(term)),
  );

  if (!missing.length) {
    return { record, added: [] };
  }

  const merged = [...existing, ...missing.map(titleCase)];

  return {
    record: {
      ...record,
      symptoms: {
        ...(record?.symptoms ?? {}),
        value: merged,
        confidence: CONFIDENCE.FALLBACK,
        origin: existing.length ? 'reconciled' : 'source',
        source: existing.length
          ? `${record?.symptoms?.source ?? 'translation'} + source transcript`
          : 'source transcript',
        recovered: missing.map(titleCase),
      },
    },
    added: missing.map(titleCase),
  };
}
