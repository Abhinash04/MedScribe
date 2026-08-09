import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing, typography } from '../theme';

const RefiningOverlay = ({ visible, onSkip, progress }) => {
  const total = progress?.total ?? 0;
  const done = Math.min(progress?.done ?? 0, total);
  const showParts = total > 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.primaryAccent} />

          <Text style={styles.title}>Refining your dictation…</Text>
          <Text style={styles.detail}>
            We’re improving the transcription for better clinical accuracy.
          </Text>

          {showParts ? (
            <View style={styles.progressBlock}>
              <Text style={styles.progressText}>
                Part {Math.min(done + 1, total)} of {total}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(done / total) * 100}%` }]} />
              </View>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Continue with the original transcription"
            hitSlop={8}
          >
            <Text style={styles.skipText}>Continue with original</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    elevation: 10,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
  },
  detail: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  progressBlock: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  track: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceBorder,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.primaryAccent,
  },
  skip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },
});

export default RefiningOverlay;
