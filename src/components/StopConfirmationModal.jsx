import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

/**
 * Stop Confirmation Modal.
 *
 * Prevents accidental session termination when the doctor taps Stop.
 */
const StopConfirmationModal = ({ visible, onCancel, onConfirm }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Stop Dictation Session?</Text>
          <Text style={styles.message}>
            Are you sure you want to stop recording? Your dictation will be finalized
            and sent for review.
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Continue Dictation"
            >
              <Text style={styles.cancelText}>Continue Dictation</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                pressed && styles.pressed,
              ]}
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel="Stop and Review"
            >
              <Text style={styles.confirmText}>Stop & Review</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
  cancelButton: {
    backgroundColor: colors.primaryAccent,
  },
  confirmButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.secondaryAccent,
  },
  pressed: {
    opacity: 0.8,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },
});

export default StopConfirmationModal;
