import { CONFIDENCE, FIELD_MARKERS } from '../constants/fieldMarkers.js';
import { PATIENT_FIELDS } from '../constants/patientFields.js';
import { classifySegment } from './extraction/classifySegment.js';
import { inferGender } from './extraction/collectEvidence.js';
import { splitFindings } from './extraction/detectNegation.js';
import { looksLikeMedication } from './extraction/parseMedication.js';
import {
  markRetractions,
  suppressNegated,
} from './extraction/suppressNegated.js';
import { detectMarkers } from './extraction/detectMarkers.js';
import {
  normalizeTranscript,
  toOriginalRange,
} from './extraction/normalizeTranscript.js';
import {
  applyPostProcessor,
  retractionTail,
} from './extraction/postProcessors.js';
import { resolveConflicts } from './extraction/resolveConflicts.js';
import { classifyText, reroute } from './extraction/scoreField.js';
import { AUTOFILL, collectResidue } from './extraction/residue.js';
import { emit } from './extraction/trace.js';
import {
  segmentTranscript,
  unclaimedRanges,
} from './extraction/segmentTranscript.js';
import { isValid } from './extraction/validators.js';

export function extractPatientFields(transcript) {
  const empty = emptyRecord();

  if (!transcript || typeof transcript !== 'string') {
    return empty;
  }

  const { text, indexMap, original } = normalizeTranscript(transcript);
  if (!text) {
    return empty;
  }

  emit('input', () => ({ transcript, normalized: text }));

  const markers = detectMarkers(text);
  const segments = segmentTranscript(text, markers, classifySegment);

  const candidates = [];

  const denied = [];

  for (const segment of segments) {
    const config = FIELD_MARKERS[segment.field];
    const value = applyPostProcessor(config.postProcessor, segment.value);

    if (segment.field === 'symptoms') {
      denied.push(...splitFindings(retractionTail(segment.value)).negative);
    }

    if (
      segment.field === 'prescriptionNotes' &&
      Array.isArray(value) &&
      segment.confidence <= CONFIDENCE.WEAK &&
      !value.some(looksLikeMedication)
    ) {
      const asText = applyPostProcessor('text', segment.value);
      if (isValid('nonEmptyText', asText)) {
        candidates.push({
          ...segment,
          field: 'additionalRemarks',
          value: asText,
          method: 'contextual',
        });
      }
      continue;
    }
    candidates.push(...routeByEvidence(segment, value));
  }

  candidates.push(...collectFallbacks(text, markers, segments));

  const gender = inferGender(text, candidates);
  if (gender && isValid('gender', gender.value)) {
    candidates.push(gender);
  }

  const { candidates: asserted, negatedHistory } = suppressNegated(
    text,
    candidates,
  );

  if (negatedHistory) {
    const value = applyPostProcessor('text', negatedHistory.text);
    if (isValid('nonEmptyText', value)) {
      asserted.push({
        field: 'medicalHistory',
        value,
        confidence: CONFIDENCE.STRONG,
        source: 'negated history',
        method: 'contextual',
        start: negatedHistory.start,
        end: negatedHistory.end,
      });
    }
  }

  emit('candidates', () =>
    asserted.map(item => ({
      field: item.field,
      value: item.value,
      marker: item.source,
      confidence: item.confidence,
      start: item.start,
      end: item.end,
    })),
  );

  const resolved = resolveConflicts(
    markRetractions(
      asserted,
      original,
      at => toOriginalRange(indexMap, at, at).start,
    ),
  );
  appendDenials(resolved, denied);
  const record = { ...empty };

  for (const [field, candidate] of Object.entries(resolved)) {
    const range = toOriginalRange(indexMap, candidate.start, candidate.end);
    record[field] = {
      value: candidate.value,
      confidence: candidate.confidence,
      source: candidate.source,
      sourceText: original.slice(range.start, range.end),
      start: range.start,
      end: range.end,
    };
  }

  emit('record', () => record);

  return record;
}
export function applyClassifiedResidue(record, residue) {
  const filled = { ...record };
  const claimed = [];

  for (const item of residue ?? []) {
    const field = classifyText(item.text, AUTOFILL);
    if (!field || filled[field]) {
      continue;
    }

    const value = applyPostProcessor(
      FIELD_MARKERS[field].postProcessor,
      item.text,
    );
    if (!isValid(FIELD_MARKERS[field].validator, value)) {
      continue;
    }

    filled[field] = {
      value,
      confidence: CONFIDENCE.FALLBACK,
      source: 'classified',
      sourceText: item.text,
      start: item.start,
      end: item.end,
      auto: true,
    };
    claimed.push(item);
  }

  return { record: filled, claimed };
}
export function extractForReport(transcript) {
  const extracted = extractPatientFields(transcript);
  const residue = collectResidue(transcript, extracted);
  const { record, claimed } = applyClassifiedResidue(extracted, residue);

  return {
    record,
    residue: residue.filter(item => !claimed.includes(item)),
  };
}
function routeByEvidence(segment, value) {
  const asCandidate = (field, fieldValue) => {
    if (!isValid(FIELD_MARKERS[field].validator, fieldValue)) {
      return [];
    }
    return [
      {
        ...segment,
        field,
        value: fieldValue,
        ...(field === segment.field
          ? {}
          : { method: 'contextual', source: `${segment.source} + evidence` }),
      },
    ];
  };

  const moveTo = (field, text) =>
    asCandidate(
      field,
      applyPostProcessor(FIELD_MARKERS[field].postProcessor, text),
    );

  if (!Array.isArray(value)) {
    const destination = reroute(segment.field, value);
    if (destination === null) {
      return [];
    }
    return destination === undefined
      ? asCandidate(segment.field, value)
      : moveTo(destination, segment.value);
  }

  const staying = [];
  const moved = new Map();

  for (const entry of value) {
    const destination = reroute(segment.field, entry);
    if (destination === null) {
      continue;
    }
    if (destination === undefined) {
      staying.push(entry);
      continue;
    }
    moved.set(destination, [...(moved.get(destination) ?? []), entry]);
  }

  return [
    ...(staying.length ? asCandidate(segment.field, staying) : []),
    ...[...moved].flatMap(([field, entries]) =>
      moveTo(field, entries.join(', ')),
    ),
  ];
}

function appendDenials(resolved, denied) {
  const unique = [
    ...new Set(denied.map(item => item.trim().toLowerCase())),
  ].filter(item => item.length > 1);
  if (!unique.length) {
    return;
  }

  const line = `Denies: ${unique.join(', ')}`;
  const existing = resolved.additionalRemarks;

  if (existing) {
    existing.value = `${existing.value}; ${line}`;
    return;
  }

  resolved.additionalRemarks = {
    field: 'additionalRemarks',
    value: line,
    confidence: CONFIDENCE.STRONG,
    source: 'negated findings',
    method: 'contextual',
    start: 0,
    end: 0,
  };
}

function collectFallbacks(text, markers, segments) {
  const found = [];
  const gaps = unclaimedRanges(text, markers, segments);

  for (const [field, config] of Object.entries(FIELD_MARKERS)) {
    if (!config.fallbacks?.length) {
      continue;
    }

    for (const gap of gaps) {
      const slice = text.slice(gap.start, gap.end);

      for (const fallback of config.fallbacks) {
        const match = slice.match(fallback.pattern);
        if (!match) {
          continue;
        }

        const value = applyPostProcessor(config.postProcessor, match[0]);
        if (!isValid(config.validator, value)) {
          continue;
        }

        found.push({
          field,
          value,
          confidence: fallback.confidence,
          source: fallback.source,
          start: gap.start + match.index,
          end: gap.start + match.index + match[0].length,
        });
      }
    }
  }

  return found;
}

function emptyRecord() {
  return PATIENT_FIELDS.reduce((acc, field) => {
    acc[field.key] = null;
    return acc;
  }, {});
}

export function isRecordEmpty(record) {
  return PATIENT_FIELDS.every(field => !record?.[field.key]);
}

export function countCapturedFields(record) {
  return PATIENT_FIELDS.filter(field => !!record?.[field.key]).length;
}
