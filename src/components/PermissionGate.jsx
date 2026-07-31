import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RECORDING_STATE } from '../constants/recordingStates';
import { colors, spacing, typography } from '../theme';

/**
 * Non-happy permission paths (SRS NFR-4).
 *
 * Each state gets one clear action. The copy explains why the microphone is
 * needed — a second request with no rationale is usually denied again.
 */
const GATE_CONTENT = {
  [RECORDING_STATE.PERMISSION_DENIED]: {
    title: 'Microphone access needed',
    body: 'MedScribe records your dictation to build the patient record. Nothing is captured until you tap the microphone.',
    actionLabel: 'Grant microphone access',
  },
  [RECORDING_STATE.PERMISSION_BLOCKED]: {
    title: 'Microphone access is blocked',
    body: 'Microphone permission was permanently denied. Enable it in system settings to dictate patient details.',
    actionLabel: 'Open Settings',
  },
  [RECORDING_STATE.UNAVAILABLE]: {
    title: 'Speech recognition unavailable',
    body: 'This device has no microphone or no speech recognition service available. Dictation cannot start.',
    actionLabel: 'Go back',
  },
};

const PermissionGate = ({ status, onRequestPermission, onOpenSettings, onCancel }) => {
  const content = GATE_CONTENT[status];

  if (!content) {
    return null;
  }

  const handlePress = () => {
    switch (status) {
      case RECORDING_STATE.PERMISSION_DENIED:
        onRequestPermission?.();
        break;
      case RECORDING_STATE.PERMISSION_BLOCKED:
        onOpenSettings?.();
        break;
      default:
        onCancel?.();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconBadge}>
        <View style={styles.iconMicBody} />
        <View style={styles.iconStrike} />
      </View>

      <Text style={typography.largeHeading}>{content.title}</Text>
      <Text style={[typography.mediumSubtitle, styles.body]}>
        {content.body}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.actionButton,
          pressed && styles.actionButtonPressed,
        ]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={content.actionLabel}
      >
        <Text style={styles.actionLabel}>{content.actionLabel}</Text>
      </Pressable>

      {status !== RECORDING_STATE.UNAVAILABLE ? (
        <Pressable
          style={styles.secondaryButton}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Go back to home screen"
        >
          <Text style={styles.secondaryLabel}>Not now</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconMicBody: {
    width: 16,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.textMuted,
  },
  iconStrike: {
    position: 'absolute',
    width: 48,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: colors.textSecondary,
    transform: [{ rotate: '45deg' }],
  },
  body: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  actionButton: {
    backgroundColor: colors.primaryAccent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
  },
  actionButtonPressed: {
    backgroundColor: colors.primaryHover,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});

export default PermissionGate;
