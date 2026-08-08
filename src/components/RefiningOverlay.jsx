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

/**
 * Shown while the AI transcript is being generated, before the doctor sees the
 * review screen's editor.
 *
 * Deliberately blocking. The refined transcript replaces what is on screen the
 * moment it lands, so allowing edits underneath it would mean discarding work
 * the doctor had just done — waiting is the honest state.
 *
 * `onSkip` is what keeps that from becoming a trap. Refinement time scales with
 * dictation length (one request per 45 s of audio), so a long consultation has
 * a slow tail, and a doctor with a patient in front of them must always be able
 * to move on. Skipping does not cancel the request: the result still arrives
 * and fills the AI tab, it simply no longer takes over on its own.
 */
const RefiningOverlay = ({ visible, onSkip }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
    <View style={styles.overlay}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primaryAccent} />

        <Text style={styles.title}>Refining your dictation with AI. Please wait…</Text>
        <Text style={styles.detail}>
          Your recording is being transcribed a second time for accuracy. This
          usually takes a few seconds.
        </Text>

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
