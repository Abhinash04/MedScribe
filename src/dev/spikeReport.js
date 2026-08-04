/**
 * The contention matrix as shareable text.
 *
 * The spike answers one question — can the recognizer and AudioRecord hold the
 * microphone at once on this device — and the answer has to leave the phone.
 * `console.log` does not survive a build without Metro attached, so the result
 * is formatted for the share sheet instead.
 */

const pct = value => `${Math.round((value ?? 0) * 100)}%`;

const verdict = score => {
  if (score.meaningful && score.audible === true) {
    return 'BOTH — recognizer usable and capture audible';
  }
  if (score.meaningful) {
    return 'RECOGNIZER ONLY — capture silent or too quiet';
  }
  if (score.audible === true) {
    return 'CAPTURE ONLY — recognizer degraded';
  }
  return 'NEITHER';
};

export function buildSpikeReport(results, scoreOf) {
  const lines = [];
  lines.push('MedScribe mic contention matrix');
  lines.push(new Date().toISOString());
  lines.push('');

  for (const entry of results) {
    const score = scoreOf(entry);
    lines.push('─'.repeat(52));
    lines.push(`${entry.phase.id} · ${entry.phase.label}`);
    lines.push(`  source           ${entry.phase.capture ?? 'none'}`);
    lines.push(`  capture delay    ${entry.phase.captureDelayMs} ms`);
    lines.push(`  word recall      ${pct(score.recall)}`);
    lines.push(
      `  vs baseline      ${score.relative === null ? 'n/a' : pct(score.relative)}${
        score.degraded ? '  DEGRADED' : ''
      }`,
    );
    lines.push(`  begin / ready    ${pct(score.beginRatio)}`);
    // Whether text appears while the doctor is still speaking.
    lines.push(
      `  partials         ${entry.counters.partials}${
        entry.counters.firstPartialAtMs
          ? ` (first at ${entry.counters.firstPartialAtMs} ms)`
          : ' (none — no live text)'
      }`,
    );
    lines.push(`  longest silence  ${entry.counters.longestSilenceMs} ms`);
    lines.push(`  restarts         ${entry.counters.restarts}`);
    lines.push(`  finals           ${entry.counters.finals}`);
    lines.push(
      `  errors           ${JSON.stringify(entry.counters.errorsByCode ?? {})}`,
    );

    if (entry.stats) {
      lines.push(`  isClientSilenced ${entry.stats.silencedSamples > 0 ? 'YES' : 'no'} (${entry.stats.silencedSamples}/${entry.stats.configSamples} samples)`);
      lines.push(`  peak amplitude   ${entry.stats.peakAmplitude}`);
      lines.push(`  silent ratio     ${pct(entry.stats.silentRatio)}`);
      lines.push(`  read errors      ${entry.stats.readErrors}`);
      lines.push(`  longest gap      ${entry.stats.longestGapMs} ms`);
    } else {
      lines.push('  capture          none');
    }

    lines.push(`  VERDICT          ${verdict(score)}`);
  }

  lines.push('─'.repeat(52));
  lines.push('');
  lines.push('Transcripts heard:');
  for (const entry of results) {
    lines.push(`  ${entry.phase.id}: ${entry.counters.text || '(nothing)'}`);
  }

  return lines.join('\n');
}
