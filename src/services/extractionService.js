import { FIELD_MARKERS } from '../constants/fieldMarkers.js';
import { PATIENT_FIELDS } from '../constants/patientFields.js';
import { detectMarkers } from './extraction/detectMarkers.js';
import {
  normalizeTranscript,
  toOriginalRange,
} from './extraction/normalizeTranscript.js';
import { applyPostProcessor } from './extraction/postProcessors.js';
import { resolveConflicts } from './extraction/resolveConflicts.js';
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

  const { text, indexMap } = normalizeTranscript(transcript);
  if (!text) {
    return empty;
  }

  const markers = detectMarkers(text);
  const segments = segmentTranscript(text, markers);

  const candidates = [];

  for (const segment of segments) {
    const config = FIELD_MARKERS[segment.field];
    const value = applyPostProcessor(config.postProcessor, segment.value);

    if (!isValid(config.validator, value)) {
      continue;
    }

    candidates.push({ ...segment, value });
  }

  // Unmarked fallbacks run last and only over text no marker claimed, so a
  // bare "female" inside an address cannot be mistaken for the gender field.
  candidates.push(...collectFallbacks(text, markers));

  const resolved = resolveConflicts(candidates);
  const record = { ...empty };

  for (const [field, candidate] of Object.entries(resolved)) {
    const range = toOriginalRange(indexMap, candidate.start, candidate.end);
    record[field] = {
      value: candidate.value,
      confidence: candidate.confidence,
      source: candidate.source,
      start: range.start,
      end: range.end,
    };
  }

  return record;
}

function collectFallbacks(text, markers) {
  const found = [];
  const gaps = unclaimedRanges(text, markers);

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
