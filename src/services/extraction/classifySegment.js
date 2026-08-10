import {
  CHRONICITY_CUES,
  PRESENTATION_CUES,
} from '../../constants/clinicalCues.js';
import { trimTrailingConnectives } from './postProcessors.js';

export function classifySegment(segment) {
  if (segment.field !== 'symptoms') {
    return segment;
  }

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
