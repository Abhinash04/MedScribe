// Splits a consultation transcript into translation-sized pieces.
//
// Size is a genuine trade-off, decided at 900 characters:
//
//   Too small (per sentence) strips the cross-sentence context the extractor
//   depends on. Indic dictation drops the subject constantly and establishes
//   gender once, sentences earlier, and several prescriptionNotes /
//   additionalRemarks markers are pronoun-bearing ("give her", "tell him to").
//   MT only sees within one array item.
//
//   Too large risks silent truncation against an undocumented per-item cap.
//   readTranslations cannot detect that: it would return ok with a short string
//   and half the consultation would vanish from the report with no error
//   anywhere. That is the worst failure this app has.
//
// 900 chars is roughly 8-14 sentences of typical Indic dictation — a generous
// context window, an order of magnitude below any plausible engine cap.

export const DEFAULT_CHUNK_CHARS = 900;

// Latin, Devanagari/Bengali/Odia/Gurmukhi/Gujarati danda, Urdu and Perso-Arabic,
// and Ol Chiki for Santali. Omitting the danda would make one enormous
// "sentence" per paragraph and defeat the splitter entirely.
export const SENTENCE_TERMINATORS = '.?!।॥۔؟᱾᱿';

const SENTENCE_SPLIT = /(?<=[.?!।॥۔؟᱾᱿])\s+/u;

const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();

// Never break a word. Only if the window holds no space at all do we cut hard.
function hardSplit(sentence, maxChars) {
  const pieces = [];
  let rest = sentence;

  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars + 1);
    const breakAt = window.lastIndexOf(' ');
    const cut = breakAt > 0 ? breakAt : maxChars;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) {
    pieces.push(rest);
  }
  return pieces;
}

export function splitForTranslation(text, maxChars = DEFAULT_CHUNK_CHARS) {
  const source = normalize(text);
  if (!source) {
    return [];
  }

  const sentences = source
    .split(SENTENCE_SPLIT)
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .flatMap(sentence =>
      sentence.length > maxChars ? hardSplit(sentence, maxChars) : [sentence],
    );

  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if (current.length + 1 + sentence.length <= maxChars) {
      current = `${current} ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }

  if (current) {
    chunks.push(current);
  }
  return chunks;
}

// Packs chunks into requests. Sequential batches rather than one giant array:
// a 429 on batch 3 leaves batches 1-2 translated, progress stays meaningful,
// and supersession between batches makes a re-translate abort cheaply.
export function planBatches(chunks, { maxItems = 25, maxChars = 12000 } = {}) {
  const batches = [];
  let current = [];
  let chars = 0;

  for (const chunk of chunks) {
    const wouldExceed =
      current.length >= maxItems || chars + chunk.length > maxChars;

    if (current.length && wouldExceed) {
      batches.push(current);
      current = [];
      chars = 0;
    }

    current.push(chunk);
    chars += chunk.length;
  }

  if (current.length) {
    batches.push(current);
  }
  return batches;
}

// Same semantics as chunkedUpload.joinChunks: single-space join with empties
// dropped, so a blank chunk cannot produce "fever.Cough".
export function joinTranslated(texts) {
  return (Array.isArray(texts) ? texts : [])
    .map(text => String(text ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
