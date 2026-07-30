import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RECORDING_STATE } from '../constants/recordingStates';
import { colors, spacing } from '../theme';

const ControlButton = ({ label, onPress, variant = 'primary', disabled, hint }) => (
  <Pressable
    style={({ pressed }) => [
      styles.button,
      styles[variant],
      disabled && styles.disabled,
      pressed && !disabled && styles.pressed,
    ]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={hint}
    accessibilityState={{ disabled: !!disabled }}
  >
    <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
  </Pressable>
);

/**
 * State-aware control row for the recording session.
 *
 * "Continue to report" hands the captured transcript to the extraction and
 * report preview flow (SRS FR-5 to FR-8). It is disabled when nothing was
 * transcribed, since there would be nothing to extract.
 */
const RecordingControls = ({
  status,
  hasTranscript,
  onStop,
  onRestart,
  onRetry,
  onContinue,
}) => {
  if (status === RECORDING_STATE.LISTENING) {
    return (
      <View style={styles.row}>
        <ControlButton
          label="Stop dictation"
          variant="danger"
          onPress={onStop}
          hint="Ends recording and finalizes the transcript"
        />
      </View>
    );
  }

  if (status === RECORDING_STATE.SUCCESS) {
    return (
      <View style={styles.column}>
        <ControlButton
          label="Continue to report"
          onPress={onContinue}
          disabled={!hasTranscript}
          hint="Extracts patient details and opens the structured report"
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
    // A failure part-way through must not discard what was already captured.
    // "Try again" resets the store, so when there is text worth keeping the
    // primary action is to carry it forward instead.
    return (
      <View style={styles.column}>
        {hasTranscript ? (
          <ControlButton
            label="Continue to report"
            onPress={onContinue}
            hint="Builds a report from the text captured before the error"
          />
        ) : null}
        <ControlButton
          label={hasTranscript ? 'Record again' : 'Try again'}
          variant={hasTranscript ? 'secondary' : 'primary'}
          onPress={onRetry}
          hint="Discards the current transcript and restarts recognition"
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
    gap: spacing.md,
  },
  column: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.3,
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
