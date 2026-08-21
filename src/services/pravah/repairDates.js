const MONTH =
  'january|february|march|april|may|june|july|august|september|october|november|december' + '|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';

const YEAR = String.raw`(?:19|20)\d{2}`;
const DATELESS =
  new RegExp(
    String.raw`(?<!${YEAR}\s)\b(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH})\b(?!\s*,?\s*${YEAR})` +
      String.raw`|(?<!${YEAR}\s)\b(${MONTH})\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!\s*,?\s*${YEAR})`,
    'gi',
  );

const ORPHAN_YEAR = new RegExp(
  String.raw`\b${YEAR}\b(?!\s*,?\s*(?:${MONTH}))`,
  'gi',
);

const nearMonth = (text, index) => {
  const before = text.slice(Math.max(0, index - 12), index);
  return new RegExp(String.raw`(?:${MONTH})[\s,]*$`, 'i').test(before);
};

const SENTENCE = /[^.;?!]+[.;?!]?/g;

function repairSentence(sentence) {
  const dateless = [...sentence.matchAll(DATELESS)];
  if (!dateless.length) {
    return sentence;
  }

  const orphans = [...sentence.matchAll(ORPHAN_YEAR)].filter(
    match => !nearMonth(sentence, match.index),
  );
  if (!orphans.length) {
    return sentence;
  }

  const pairs = Math.min(dateless.length, orphans.length);
  const edits = [];

  for (let index = 0; index < pairs; index += 1) {
    const date = dateless[index];
    const year = orphans[index];
    edits.push({ start: date.index, end: date.index + date[0].length, text: `${date[0]} ${year[0]}` });
    edits.push({ start: year.index, end: year.index + year[0].length, text: '' });
  }

  edits.sort((a, b) => b.start - a.start);
  let out = sentence;
  for (const edit of edits) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

export function inferMissingYears(text, sourceYears) {
  const unique = [...new Set((sourceYears ?? []).map(String))].filter(year =>
    /^(?:19|20)\d{2}$/.test(year),
  );
  if (unique.length !== 1) {
    return String(text ?? '');
  }

  const year = unique[0];
  return String(text ?? '').replace(DATELESS, match => `${match} ${year}`);
}

export function repairOrphanedYears(text) {
  const source = String(text ?? '');
  if (!source) {
    return source;
  }
  return source
    .replace(SENTENCE, repairSentence)
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}
