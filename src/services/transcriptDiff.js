export const CHANGE = {
  EQUAL: 'equal',
  REMOVED: 'removed',
  ADDED: 'added',
};

const tokenize = text =>
  String(text || '')
    .split(/\s+/)
    .filter(Boolean);

export const normalizeToken = token =>
  String(token || '')
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '');

function longestCommonSubsequence(left, right) {
  const rows = left.length;
  const columns = right.length;
  const table = Array.from({ length: rows + 1 }, () =>
    new Array(columns + 1).fill(0),
  );

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
