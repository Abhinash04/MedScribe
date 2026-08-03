import { setTraceSink } from '../services/extraction/trace.js';

/**
 * A single-run diagnostic dump, shareable from the device.
 *
 * A field can go missing in four different places — the recognizer never heard
 * it, extraction never matched it, the draft merge dropped it, or the form did
 * not render it — and a report from a physical device is otherwise impossible
 * to attribute. Collection is off until `capture` runs, so a normal session
 * stores nothing.
 */

const stages = new Map();

const record = (stage, payload) => {
  stages.set(stage, payload);
};

export function capture(fn) {
  stages.clear();
  setTraceSink(record);
  try {
    return fn();
  } finally {
    setTraceSink(null);
  }
}

export function recordStage(stage, payload) {
  stages.set(stage, payload);
}

const line = '─'.repeat(58);

const show = value => {
  if (value === null || value === undefined) {
    return '(none)';
  }
  if (Array.isArray(value)) {
    return value.length ? value.map(item => `  • ${item}`).join('\n') : '(empty)';
  }
  return String(value) || '(empty)';
};

export function buildDiagnosticText({ segments, transcript, record: extracted, draft, rendered }) {
  const out = [];

  out.push('MedScribe diagnostic dump');
  out.push(new Date().toISOString());

  out.push(`\n${line}\n1. RAW TRANSCRIPT (${segments?.length ?? 0} utterances)`);
  (segments ?? []).forEach((segment, index) => {
    out.push(`  [${index + 1}]${segment.edited ? ' (edited)' : ''} ${segment.text}`);
  });
  out.push(`\n  joined: ${transcript || '(empty)'}`);

  out.push(`\n${line}\n2. TEXT PASSED TO EXTRACTION`);
  const input = stages.get('input');
  out.push(`  raw:        ${input?.transcript ?? '(not captured)'}`);
  out.push(`  normalized: ${input?.normalized ?? '(not captured)'}`);

  out.push(`\n${line}\n3. CANDIDATES`);
  const candidates = stages.get('candidates');
  if (!candidates?.length) {
    out.push('  (none)');
  } else {
    for (const item of candidates) {
      out.push(
        `  ${item.field} @${item.confidence} [${item.marker}] ${item.start}-${item.end}\n      ${JSON.stringify(item.value)}`,
      );
    }
  }

  out.push(`\n${line}\n4. EXTRACTED RECORD`);
  const finalRecord = stages.get('record') ?? extracted ?? {};
  for (const [key, field] of Object.entries(finalRecord)) {
    if (!field) {
      out.push(`  ${key}: (null)`);
      continue;
    }
    out.push(
      `  ${key}: ${JSON.stringify(field.value)}  @${field.confidence} [${field.source}]\n      from: "${field.sourceText ?? ''}"`,
    );
  }

  out.push(`\n${line}\n5. REPORT DRAFT`);
  for (const [key, entry] of Object.entries(draft ?? {})) {
    out.push(`  ${key}: ${JSON.stringify(entry?.value)}${entry?.edited ? ' (edited)' : ''}`);
  }

  out.push(`\n${line}\n6. RENDERED BY THE FORM`);
  for (const [key, value] of Object.entries(rendered ?? {})) {
    out.push(`  ${key}: ${show(value)}`);
  }

  return out.join('\n');
}
