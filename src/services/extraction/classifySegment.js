import {
  CHRONICITY_CUES,
  PRESENTATION_CUES,
} from '../../constants/clinicalCues.js';
import { trimTrailingConnectives } from './postProcessors.js';

/**
 * Re-routes a segment when its content contradicts the marker that opened it.
 *
 * "has had diabetes for ten years" opens a symptoms segment, but a duration in
 * years makes it history. A presentation cue in the same span wins, because
 * "known diabetic, today has fever" is both statements at once and the marker
 * that opened the span is the better guide for the acute half.
 */
export function classifySegment(segment) {
  if (segment.field !== 'symptoms') {
    return segment;
  }

  // Test the trimmed value: a segment cut at the next marker ends "…for ten
  // years and today", and that dangling "today" would read as an acute
  // presentation belonging to the following segment, not to this one.
  const value = trimTrailingConnectives(segment.value || '');
  if (!CHRONICITY_CUES.test(value) || PRESENTATION_CUES.test(value)) {
    return segment;
  }

  return {
    ...segment,
    field: 'medicalHistory',
    method: 'contextual',
    source: `${segment.source} + chronicity`,
  };
}
