import {
  CHRONICITY_CUES,
  MEDICATION_FORMS,
  MEDICATION_FREQUENCY,
  MEDICATION_ROUTE,
  MEDICATION_STRENGTH,
  MEDICATION_TIMING,
  PRESENTATION_CUES,
  SYMPTOM_MODIFIERS,
  SYMPTOM_TERMS,
} from '../../constants/clinicalCues.js';
import { CLINICAL_CONDITIONS, CONDITION_NOUN } from '../../constants/fieldMarkers.js';
import { looksLikeMedication } from './parseMedication.js';

const CONDITION_WORDS = new RegExp(`\\b(?:${CLINICAL_CONDITIONS})\\b`, 'i');
const CONDITION_NOUNS = new RegExp(`\\b(?:${CONDITION_NOUN})s?\\b`, 'i');

const NAMED_CONDITIONS =
  /\b(?:diabetes|hypertension|asthma|thyroid|cardiac|cancer|tuberculosis|epilepsy|arthritis|anaemia|anemia|migraine|stroke|infection|fever|blood\s+pressure)\b/i;

const ETIOLOGY = /\b(?:viral|bacterial|fungal|infectious|allergic|acute|chronic)\s+\w+/i;

const ASSERTION_CUES =
  /\b(?:diagnos\w*|impression|assessment|suggest\w*|consistent\s+with|points?\s+to(?:wards?)?|appears?\s+to\s+be|likely|probable|provisional\w*|clinically|call(?:s|ing|ed)?\s+(?:this|it)|infection|syndrome|disease|disorder)\b/i;

const ADVICE_CUES =
  /\b(?:advis\w*|advice|counsell?ed|follow[-\s]?up|review|revisit|return|rest|hydrat\w*|fluids?|avoid|monitor|maintain|plenty|precautions?|diet|lifestyle)\b/i;

const MEDICATION_NOUN =
  /\b(?:medicines?|medications?|drugs?|dosage|doses?|pills?|tablets?|capsules?|syrups?|injections?|inhalers?)\b/i;

const IMPERATIVE_DRUG_CUES =
  /\b(?:start|started|prescrib\w*|give|giving|continue|dispense|rx)\b/i;

const SYMPTOM_ONSET = /\b(?:since|for)\s+(?:the\s+)?(?:last\s+|past\s+)?\w+\s+(?:days?|weeks?|hours?|nights?)\b/i;

const FILLER_ONLY =
  /^(?:\s*(?:also|been|being|has|have|had|is|are|was|were|the|a|an|his|her|their|this|that|and|or|but|to|of|for|with|continue|regular|patient|he|she|it|should|would|will|now|then|tomorrow|yesterday|today|tonight|morning|afternoon|evening|later|soon|again)\b\s*)+$/i;

const has = (pattern, text) => (pattern.test(text) ? 1 : 0);

const containsAny = (terms, text) => {
  const lower = text.toLowerCase();
  return terms.some(term => lower.includes(term)) ? 1 : 0;
};

const words = text => (String(text ?? '').trim().match(/\S+/g) || []).length;

function scoreName(text) {
  if (!text || words(text) > 4) {
    return 0;
  }
  const clinical =
    has(NAMED_CONDITIONS, text) ||
    has(CONDITION_WORDS, text) ||
    has(CONDITION_NOUNS, text) ||
    containsAny(SYMPTOM_TERMS, text) ||
    has(MEDICATION_STRENGTH, text);

  if (clinical) {
    return -3;
  }
  return /^\p{Lu}/u.test(text.trim()) ? 2 : 1;
}

function scorePrescription(text) {
  return (
    2 * has(MEDICATION_STRENGTH, text) +
    2 * (looksLikeMedication(text) ? 1 : 0) +
    has(MEDICATION_FORMS, text) +
    has(MEDICATION_FREQUENCY, text) +
    has(MEDICATION_ROUTE, text) +
    has(MEDICATION_TIMING, text) +
    has(IMPERATIVE_DRUG_CUES, text) -
    2 * (has(NAMED_CONDITIONS, text) && !has(MEDICATION_STRENGTH, text) ? 1 : 0)
  );
}

function scoreHistory(text) {
  return (
    2 * has(CHRONICITY_CUES, text) +
    has(CONDITION_WORDS, text) +
    has(CONDITION_NOUNS, text) +
    has(NAMED_CONDITIONS, text) +
    has(/\b(?:history|known\s+case|previously|background|comorbid\w*)\b/i, text) -
    2 * has(PRESENTATION_CUES, text)
  );
}

function scoreSymptoms(text) {
  return (
    2 * containsAny(SYMPTOM_TERMS, text) +
    containsAny(SYMPTOM_MODIFIERS, text) +
    has(PRESENTATION_CUES, text) +
    has(SYMPTOM_ONSET, text) +
    has(/\b(?:complain\w*|reports?|presents?|troubled|bothered|suffering|experienc\w*)\b/i, text) -
    2 * (has(NAMED_CONDITIONS, text) && !containsAny(SYMPTOM_TERMS, text) ? 1 : 0)
  );
}

function scoreDiagnosis(text) {
  return (
    2 * has(ASSERTION_CUES, text) +
    has(NAMED_CONDITIONS, text) +
    has(ETIOLOGY, text) -
    2 * has(MEDICATION_STRENGTH, text) -
    has(ADVICE_CUES, text)
  );
}

function scoreRemarks(text) {
  return (
    2 * has(ADVICE_CUES, text) -
    2 * has(MEDICATION_STRENGTH, text) -
    (looksLikeMedication(text) ? 1 : 0)
  );
}

const SCORERS = {
  patientName: scoreName,
  symptoms: scoreSymptoms,
  medicalHistory: scoreHistory,
  diagnosis: scoreDiagnosis,
  prescriptionNotes: scorePrescription,
  additionalRemarks: scoreRemarks,
};

export const UNSCORED_FIELDS = new Set(['age', 'gender', 'pinCode', 'contactNumber', 'address']);

export function isScorable(field) {
  return Object.prototype.hasOwnProperty.call(SCORERS, field);
}

export function isFillerOnly(text) {
  const value = String(text ?? '').trim();
  return !value || FILLER_ONLY.test(value);
}

export function scoreField(field, text) {
  const value = String(text ?? '').trim();
  if (!value || !isScorable(field)) {
    return 0;
  }
  if (isFillerOnly(value)) {
    return -1;
  }
  return SCORERS[field](value);
}

export function rankFields(text) {
  return Object.keys(SCORERS)
    .map(field => ({ field, score: scoreField(field, text) }))
    .sort((a, b) => b.score - a.score);
}

export function reroute(field, value) {
  const text = String(value ?? '').trim();
  if (!text || UNSCORED_FIELDS.has(field)) {
    return undefined;
  }

  if (isFillerOnly(text)) {
    return null;
  }

  if (field === 'patientName' && scoreField('patientName', text) < 0) {
    return null;
  }

  const drugEvidence =
    has(MEDICATION_STRENGTH, text) ||
    has(MEDICATION_NOUN, text) ||
    has(MEDICATION_FORMS, text) ||
    (looksLikeMedication(text) ? 1 : 0);
  const namesCondition = has(NAMED_CONDITIONS, text) || has(CONDITION_WORDS, text);

  if (field === 'prescriptionNotes' && !drugEvidence && namesCondition) {
    return 'medicalHistory';
  }

  if (field === 'additionalRemarks' && drugEvidence && has(MEDICATION_STRENGTH, text)) {
    return 'prescriptionNotes';
  }

  if (
    field === 'symptoms' &&
    namesCondition &&
    !containsAny(SYMPTOM_TERMS, text) &&
    !has(PRESENTATION_CUES, text)
  ) {
    return 'medicalHistory';
  }

  return undefined;
}

export function classifyText(text, { floor = 2, margin = 1 } = {}) {
  const ranked = rankFields(text);
  const [best, next] = ranked;
  if (!best || best.score < floor) {
    return null;
  }
  if (next && best.score - next.score < margin) {
    return null;
  }
  return best.field;
}
