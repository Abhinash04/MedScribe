const LEXICONS = {};

export function registerLexicon(lexicon) {
  if (lexicon?.code) {
    LEXICONS[lexicon.code] = lexicon;
  }
  return lexicon;
}

export function lexiconFor(code) {
  const lexicon = LEXICONS[code];
  return lexicon?.reviewed ? lexicon : null;
}

export function allLexicons() {
  return Object.values(LEXICONS);
}

export function lexiconCodes() {
  return Object.keys(LEXICONS);
}

export const reviewedCodes = () =>
  Object.values(LEXICONS)
    .filter(lexicon => lexicon.reviewed)
    .map(lexicon => lexicon.code);

export function findingsInSource(text, code) {
  const lexicon = lexiconFor(code);
  if (!lexicon || !text) {
    return [];
  }

  const haystack = String(text);
  return Object.entries(lexicon.forms)
    .filter(([, forms]) =>
      (forms ?? []).some(form => form && haystack.includes(form)),
    )
    .map(([term]) => term);
}

import as_ from './as.js';
import bn from './bn.js';
import hi from './hi.js';
import ml from './ml.js';
import or from './or.js';
import ta from './ta.js';

[as_, bn, hi, ml, or, ta].forEach(registerLexicon);
