import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CHANGE, diffTranscripts, summarizeChanges } from '../services/transcriptDiff';
import { colors, spacing, typography } from '../theme';

/**
 * What the second transcription changed, against the raw recogniser output.
 *
 * Both sides are the frozen originals, never the editable drafts, so a doctor's
 * own correction can never appear here as something the AI did.
 */
const TranscriptDiffView = ({ original, revised }) => {
  const changes = useMemo(() => summarizeChanges(original, revised), [original, revised]);
  const runs = useMemo(() => diffTranscripts(original, revised), [original, revised]);

  if (!original?.trim() || !revised?.trim()) {
    return null;
  }

  if (!changes.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>What AI changed</Text>
        <Text style={styles.empty}>
          Nothing beyond punctuation and capitalisation.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        What AI changed ({changes.length}
        {changes.length === 1 ? ' change' : ' changes'})
      </Text>

      <View style={styles.summary}>
        {changes.map((change, index) => (
          <Text key={`${change.from}-${change.to}-${index}`} style={styles.summaryLine}>
            {change.type === 'replaced' ? (
              <>
                <Text style={styles.removedText}>{change.from}</Text>
                <Text style={styles.arrow}> → </Text>
                <Text style={styles.addedText}>{change.to}</Text>
              </>
            ) : change.type === 'added' ? (
              <>
                <Text style={styles.arrow}>added </Text>
                <Text style={styles.addedText}>{change.to}</Text>
              </>
            ) : (
              <>
                <Text style={styles.arrow}>removed </Text>
                <Text style={styles.removedText}>{change.from}</Text>
              </>
            )}
          </Text>
        ))}
      </View>

      <Text style={styles.inlineLabel}>In context</Text>
      <Text style={styles.inline}>
        {runs.map((run, index) => (
          <Text
            key={`${run.type}-${index}`}
            style={
              run.type === CHANGE.REMOVED
                ? styles.removed
                : run.type === CHANGE.ADDED
                  ? styles.added
                  : styles.equal
            }
          >
            {run.tokens.join(' ')}{' '}
          </Text>
        ))}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
  },
  summary: {
    gap: 4,
    marginTop: spacing.xs,
  },
  summaryLine: {
    fontSize: 15,
    lineHeight: 22,
  },
  arrow: {
    color: colors.textMuted,
    fontSize: 14,
  },
  inlineLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  inline: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 24,
  },
  equal: {
    color: colors.textSecondary,
  },
  removed: {
    color: colors.secondaryAccent,
    textDecorationLine: 'line-through',
  },
  added: {
    color: colors.success,
    fontWeight: '700',
  },
  removedText: {
    color: colors.secondaryAccent,
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  addedText: {
    color: colors.success,
    fontWeight: '700',
  },
});

export default TranscriptDiffView;
