import { FIELD_MARKERS } from '../../constants/fieldMarkers.js';
import { PATIENT_FIELDS } from '../../constants/patientFields.js';
import { classifyText } from './scoreField.js';
import { findSentenceEnd } from './segmentTranscript.js';

const STOP_WORDS = new Set(
  ('the a an is are was were be been being has have had he she it they them his her him ' +
    'this that these those of for and or to in on at with as from by so also i am we you ' +
    'patient patients today now then there here which who whom what will would should ' +
    'can could may might do does did not no any all some more most very just about')
    .split(' '),
);

const SCAFFOLDING = new Set(
  Object.values(FIELD_MARKERS)
    .flatMap(config => [...(config.markers ?? []), ...(config.fallbacks ?? [])])
    .flatMap(marker => String(marker.source ?? '').toLowerCase().match(/[a-z]+/g) || []),
);

const contentWords = value =>
  (String(value ?? '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || []
  ).filter(word => word.length > 2 && !STOP_WORDS.has(word));

const meaningWords = value => contentWords(value).filter(word => !SCAFFOLDING.has(word));

const COVERAGE_FLOOR = 0.5;

const MIN_CONTENT_WORDS = 2;

const FIELD_KEYS = new Set(PATIENT_FIELDS.map(field => field.key));

const SUGGEST = { floor: 1, margin: 1 };

export const AUTOFILL = { floor: 3, margin: 2 };

function suggestField(sentence) {
  const field = classifyText(sentence, SUGGEST);
  return field && FIELD_KEYS.has(field) ? field : null;
}

export function splitSentences(transcript) {
  const text = String(transcript ?? '');
  const sentences = [];
  let cursor = 0;

  while (cursor < text.length) {
    const end = findSentenceEnd(text, cursor, text.length);
    const stop = Math.min(text.length, end === text.length ? end : end + 1);
    const raw = text.slice(cursor, stop);
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();

    if (body) {
      sentences.push({ text: body, start: cursor + lead, end: cursor + lead + body.length });
    }
    cursor = stop;
  }

  return sentences;
}

const normalizeForMatch = value =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function collectResidue(transcript, record) {
  const captured = new Set();
  const extractedPhrases = [];

  for (const field of Object.values(record ?? {})) {
    if (!field?.value) {
      continue;
    }
    const entries = Array.isArray(field.value) ? [...field.value] : [field.value];
    if (field.sourceText) {
      entries.push(field.sourceText);
    }
    for (const entry of entries) {
      for (const word of contentWords(entry)) {
        captured.add(word);
      }
      if (meaningWords(entry).length >= 2) {
        extractedPhrases.push(normalizeForMatch(entry));
      }
    }
  }

  const residue = [];

  for (const sentence of splitSentences(transcript)) {
    const words = meaningWords(sentence.text);
    if (words.length < MIN_CONTENT_WORDS) {
      continue;
    }

    const asMatch = normalizeForMatch(sentence.text);
    if (extractedPhrases.some(phrase => asMatch.includes(phrase))) {
      continue;
    }

    const seen = words.filter(word => captured.has(word)).length;
    const coverage = seen / words.length;
    if (coverage >= COVERAGE_FLOOR) {
      continue;
    }

    residue.push({
      text: sentence.text,
      start: sentence.start,
      end: sentence.end,
      suggestedField: suggestField(sentence.text),
      coverage,
    });
  }

  return residue;
}
