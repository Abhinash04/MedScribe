import { CONFIDENCE, FIELD_MARKERS } from '../constants/fieldMarkers.js';
import { PATIENT_FIELDS } from '../constants/patientFields.js';
import { classifySegment } from './extraction/classifySegment.js';
import { inferGender } from './extraction/collectEvidence.js';
import { splitFindings } from './extraction/detectNegation.js';
import { looksLikeMedication } from './extraction/parseMedication.js';
import { suppressNegated } from './extraction/suppressNegated.js';
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
import { emit } from './extraction/trace.js';
import {
  segmentTranscript,
  unclaimedRanges,
} from './extraction/segmentTranscript.js';
import { isValid } from './extraction/validators.js';

/**
 * Patient information extraction (SRS FR-5).
 *
 * Deterministic and rule-based — SRS §8 lists AI-assisted extraction under
 * Future Enhancements. This module is only an orchestrator; each pipeline
 * stage lives in ./extraction and can be replaced independently.
 *
 *   normalize -> detect markers -> segment -> post-process
 *             -> validate -> resolve conflicts
 *
 * Segmentation is what makes arbitrary dictation order work: a value ends
 * wherever the next marker begins, whatever field that marker belongs to.
 *
 * No React Native imports anywhere in the pipeline, so the whole thing is
 * runnable and testable under plain Node.
 */

/**
 * @typedef {Object} ExtractedField
 * @property {string|string[]} value
 * @property {number} confidence  marker specificity, NOT probability
 * @property {string} source      which phrase matched, for debugging
 * @property {number} start       offset into the ORIGINAL transcript
 * @property {number} end
 */

/**
 * @param {string} transcript
 * @returns {Object<string, ExtractedField|null>} null = not dictated (FR-7)
 */
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

    // Read the post-retraction text, not the raw segment: a symptom the doctor
    // took back must not resurface as a denial. Collected before validation on
    // purpose — a segment that is nothing but a denial produces no positive
    // symptom, and losing it would drop the denial entirely.
    if (segment.field === 'symptoms') {
      denied.push(...splitFindings(retractionTail(segment.value)).negative);
    }

    // "Advised plenty of oral fluids" carries a prescription marker but no
    // drug. Advice belongs in remarks, not in the medication list.
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

    if (!isValid(config.validator, value)) {
      continue;
    }

    candidates.push({ ...segment, value });
  }

  // Unmarked fallbacks run last and only over text no marker claimed, so a
  // bare "female" inside an address cannot be mistaken for the gender field.
  candidates.push(...collectFallbacks(text, markers, segments));

  const gender = inferGender(text, candidates);
  if (gender && isValid('gender', gender.value)) {
    candidates.push(gender);
  }

  const { candidates: asserted, negatedHistory } = suppressNegated(text, candidates);

  // A cancelled condition still leaves the doctor's statement on the record:
  // "no history of diabetes" is information, just not a positive history.
  if (negatedHistory && !asserted.some(item => item.field === 'medicalHistory')) {
    const value = applyPostProcessor('text', negatedHistory);
    if (isValid('nonEmptyText', value)) {
      asserted.push({
        field: 'medicalHistory',
        value,
        confidence: CONFIDENCE.STRONG,
        source: 'negated history',
        method: 'contextual',
        start: 0,
        end: 0,
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

  const resolved = resolveConflicts(asserted);
  appendDenials(resolved, denied);
  const record = { ...empty };

  for (const [field, candidate] of Object.entries(resolved)) {
    const range = toOriginalRange(indexMap, candidate.start, candidate.end);
    record[field] = {
      value: candidate.value,
      confidence: candidate.confidence,
      source: candidate.source,
      // The dictated words this value came from, for traceability: the report
      // shows "Viral fever", the evidence shows "Looks like viral fever to me".
      sourceText: original.slice(range.start, range.end),
      start: range.start,
      end: range.end,
    };
  }

  emit('record', () => record);

  return record;
}

/**
 * Negated findings are information the doctor stated, so they are recorded —
 * as an explicit denial in remarks, never as a positive symptom.
 */
function appendDenials(resolved, denied) {
  const unique = [...new Set(denied.map(item => item.trim().toLowerCase()))].filter(
    item => item.length > 1,
  );
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

/** True when nothing at all could be extracted. */
export function isRecordEmpty(record) {
  return PATIENT_FIELDS.every(field => !record?.[field.key]);
}

/** How many of the eleven fields were captured. */
export function countCapturedFields(record) {
  return PATIENT_FIELDS.filter(field => !!record?.[field.key]).length;
}
