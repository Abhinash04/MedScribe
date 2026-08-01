import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

/**
 * Session Recovery Modal.
 *
 * Prompts doctor to restore an unfinished dictation session if the app crashed
 * or closed unexpectedly.
 */
const SessionRecoveryModal = ({
  visible,
  onRestore,
  onDiscard,
  savedTime,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDiscard}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Unfinished Session Found</Text>
          <Text style={styles.message}>
            An unfinished dictation session was recovered from{' '}
            {savedTime || 'earlier'}. Would you like to restore your text and
            continue dictating?
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.restoreButton,
                pressed && styles.pressed,
              ]}
              onPress={onRestore}
              accessibilityRole="button"
              accessibilityLabel="Restore Session"
            >
              <Text style={styles.restoreText}>Restore Session</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.discardButton,
                pressed && styles.pressed,
              ]}
              onPress={onDiscard}
              accessibilityRole="button"
              accessibilityLabel="Start New Dictation"
            >
              <Text style={styles.discardText}>Start New Dictation</Text>
            </Pressable>
          </View>
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
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    gap: spacing.md,
    elevation: 10,
  },
  title: {
    ...typography.h2,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'column',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreButton: {
    backgroundColor: colors.primaryAccent,
  },
  discardButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  pressed: {
    opacity: 0.8,
  },
  restoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  discardText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
});

export default SessionRecoveryModal;
