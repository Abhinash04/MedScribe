/**
 * What the alternative transcription changed.
 *
 * Word-level LCS over a normalized key: comparison ignores casing and edge
 * punctuation while the original tokens are what get displayed. A recogniser
 * that only added a comma or a capital letter has not corrected anything
 * clinically, and surfacing that alongside "so thought → sore throat" would
 * bury the correction that matters.
 *
 * Pure — no React Native imports — so the rules are testable under plain Node.
 */

export const CHANGE = {
  EQUAL: 'equal',
  REMOVED: 'removed',
  ADDED: 'added',
};

const tokenize = text =>
  String(text || '')
    .split(/\s+/)
    .filter(Boolean);

/** Casing and surrounding punctuation are formatting, not content. */
export const normalizeToken = token =>
  String(token || '')
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '');

/** Classic LCS table. Transcripts are short enough that O(n·m) is fine. */
function longestCommonSubsequence(left, right) {
  const rows = left.length;
  const columns = right.length;
  const table = Array.from({ length: rows + 1 }, () => new Array(columns + 1).fill(0));

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row][column] =
        left[row] === right[column]
          ? table[row + 1][column + 1] + 1
          : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }

  return table;
}

/**
 * @returns {Array<{type: string, tokens: string[]}>} runs in reading order
 */
export function diffTranscripts(original, revised) {
  const originalTokens = tokenize(original);
  const revisedTokens = tokenize(revised);
  const left = originalTokens.map(normalizeToken);
  const right = revisedTokens.map(normalizeToken);

  const table = longestCommonSubsequence(left, right);
  const runs = [];

  const push = (type, token) => {
    const last = runs[runs.length - 1];
    if (last && last.type === type) {
      last.tokens.push(token);
    } else {
      runs.push({ type, tokens: [token] });
    }
  };

  let row = 0;
  let column = 0;
  while (row < left.length && column < right.length) {
    if (left[row] === right[column]) {
      // Displayed from the revised side so formatting improvements survive.
      push(CHANGE.EQUAL, revisedTokens[column]);
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      push(CHANGE.REMOVED, originalTokens[row]);
      row += 1;
    } else {
      push(CHANGE.ADDED, revisedTokens[column]);
      column += 1;
    }
  }
  while (row < left.length) {
    push(CHANGE.REMOVED, originalTokens[row]);
    row += 1;
  }
  while (column < right.length) {
    push(CHANGE.ADDED, revisedTokens[column]);
    column += 1;
  }

  return runs;
}

/**
 * Adjacent removed/added runs read as one correction — "so thought" becoming
 * "sore throat" is a single thing the doctor needs to judge, not two.
 */
export function summarizeChanges(original, revised) {
  const runs = diffTranscripts(original, revised);
  const changes = [];

  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    if (run.type === CHANGE.EQUAL) {
      continue;
    }

    const next = runs[index + 1];
    if (run.type === CHANGE.REMOVED && next?.type === CHANGE.ADDED) {
      changes.push({
        type: 'replaced',
        from: run.tokens.join(' '),
        to: next.tokens.join(' '),
      });
      index += 1;
    } else if (run.type === CHANGE.REMOVED) {
      changes.push({ type: 'removed', from: run.tokens.join(' '), to: '' });
    } else {
      changes.push({ type: 'added', from: '', to: run.tokens.join(' ') });
    }
  }

  return changes;
}

export function hasChanges(original, revised) {
  return summarizeChanges(original, revised).length > 0;
}
