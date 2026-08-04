import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RECORDING_STATE } from '../constants/recordingStates';
import { colors, spacing } from '../theme';

const ControlButton = ({ label, onPress, variant = 'primary', disabled, hint, style }) => (
  <Pressable
    style={({ pressed }) => [
      styles.button,
      styles[variant],
      disabled && styles.disabled,
      pressed && !disabled && styles.pressed,
      style,
    ]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={hint}
    accessibilityState={{ disabled: !!disabled }}
  >
    <Text
      style={[
        styles.label,
        variant === 'primary' && styles.labelOnAccent,
        disabled && styles.labelDisabled,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

/**
 * State-aware control row for the recording session.
 */
const RecordingControls = ({
  status,
  hasTranscript,
  onPause,
  onResume,
  onStop,
  onRestart,
  onRetry,
  onContinue,
}) => {
  if (status === RECORDING_STATE.LISTENING) {
    return (
      <View style={styles.row}>
        <ControlButton
          label="Pause"
          variant="secondary"
          onPress={onPause}
          hint="Pauses speech recognition"
          style={styles.flexButton}
        />
        <ControlButton
          label="Stop dictation"
          variant="danger"
          onPress={onStop}
          hint="Ends recording and finalizes transcript"
          style={styles.flexButton}
        />
      </View>
    );
  }

  if (status === RECORDING_STATE.PAUSED) {
    return (
      <View style={styles.row}>
        <ControlButton
          label="Resume"
          variant="primary"
          onPress={onResume}
          hint="Resumes speech recognition"
          style={styles.flexButton}
        />
        <ControlButton
          label="Stop dictation"
          variant="danger"
          onPress={onStop}
          hint="Ends recording and finalizes transcript"
          style={styles.flexButton}
        />
      </View>
    );
  }

  if (status === RECORDING_STATE.SUCCESS) {
    return (
      <View style={styles.column}>
        <ControlButton
          label="Review Transcript"
          onPress={onContinue}
          disabled={!hasTranscript}
          hint="Opens the transcript review screen before report generation"
        />
        {!hasTranscript ? (
          <Text style={styles.phaseNote}>
            Nothing was transcribed — record again to build a report
          </Text>
        ) : null}
        <ControlButton
          label="Record again"
          variant="secondary"
          onPress={onRestart}
          hint="Discards this transcript and starts a new dictation"
        />
      </View>
    );
  }

  if (status === RECORDING_STATE.ERROR) {
    return (
      <View style={styles.column}>
        {hasTranscript ? (
          <ControlButton
            label="Review Transcript"
            onPress={onContinue}
            hint="Review text captured before error"
          />
        ) : null}
        <ControlButton
          label={hasTranscript ? 'Record again' : 'Try again'}
          variant={hasTranscript ? 'secondary' : 'primary'}
          onPress={onRetry}
          hint="Restarts speech recognition"
        />
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  column: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    minWidth: 140,
    alignItems: 'center',
  },
  flexButton: {
    flex: 1,
    maxWidth: 180,
  },
  primary: {
    backgroundColor: colors.primaryAccent,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  danger: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.secondaryAccent,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    backgroundColor: colors.surface,
    opacity: 0.6,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  // Filled blue button: ink-on-blue fails contrast, so the label flips.
  labelOnAccent: {
    color: colors.onPrimary,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
  phaseNote: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
});

export default RecordingControls;
