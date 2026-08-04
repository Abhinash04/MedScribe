import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ANUVADINI_STATUS,
  TRANSCRIPT_SOURCE,
} from '../services/consultationTranscripts';
import { colors, spacing, typography } from '../theme';

/**
 * Offers the alternative transcription without ever applying it.
 *
 * Nothing here decides which transcript is better — the doctor does. A failure
 * is a chip with a retry, never a blocking error: the native transcript alone
 * still completes the consultation.
 */
const RefinedTranscriptCard = ({
  status,
  source,
  available,
  onUse,
  onKeepOriginal,
  onRetry,
}) => {
  const usingAnuvadini = source === TRANSCRIPT_SOURCE.ANUVADINI;

  if (status === ANUVADINI_STATUS.IDLE && !available) {
    return null;
  }

  return (
    <View style={available ? styles.readyCard : styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Transcription</Text>
        {status === ANUVADINI_STATUS.PENDING ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.secondaryAccent} />
            <Text style={styles.statusText}>Generating…</Text>
          </View>
        ) : (
          <Text style={styles.statusText}>
            {status === ANUVADINI_STATUS.FAILED
              ? 'Unable to generate'
              : available
                ? 'Ready'
                : 'Same as original'}
          </Text>
        )}
      </View>

      {status === ANUVADINI_STATUS.FAILED ? (
        <View style={styles.actions}>
          <Text style={styles.body}>
            The original transcription is unaffected and can still be used.
          </Text>
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {available ? (
        <>
          <Text style={styles.body}>
            {usingAnuvadini
              ? 'The report will be built from the AI transcription.'
              : 'A second transcription of the same dictation. Compare before choosing.'}
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                usingAnuvadini ? styles.buttonQuiet : styles.buttonPrimary,
                pressed && styles.pressed,
              ]}
              onPress={onUse}
              accessibilityRole="button"
              accessibilityState={{ selected: usingAnuvadini }}
            >
              <Text
                style={
                  usingAnuvadini ? styles.buttonQuietText : styles.buttonPrimaryText
                }
              >
                Use AI Transcription
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                usingAnuvadini ? styles.buttonPrimary : styles.buttonQuiet,
                pressed && styles.pressed,
              ]}
              onPress={onKeepOriginal}
              accessibilityRole="button"
              accessibilityState={{ selected: !usingAnuvadini }}
            >
              <Text
                style={
                  usingAnuvadini ? styles.buttonPrimaryText : styles.buttonQuietText
                }
              >
                Use Original
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
  },
  readyCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.secondaryAccent,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryAccent,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  buttonPrimary: {
    backgroundColor: colors.primaryAccent,
  },
  buttonQuiet: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  buttonPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  buttonQuietText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.8,
  },
});

export default RefinedTranscriptCard;
