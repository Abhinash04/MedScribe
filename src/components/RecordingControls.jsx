import { Pressable, Text, View } from 'react-native';
import { RECORDING_STATE } from '../constants/recordingStates';
import styles from './styles/RecordingControls.styles';

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

const RecordingControls = ({
  status,
  hasTranscript,
  onPause,
  onResume,
  onStart,
  onStop,
  onRestart,
  onRetry,
  onContinue,
}) => {
  if (status === RECORDING_STATE.IDLE) {
    return (
      <View style={styles.column}>
        <ControlButton
          label="Start dictation"
          onPress={onStart}
          hint="Begins speech recognition, keeping any restored transcript"
        />
        {hasTranscript ? (
          <ControlButton
            label="Review Transcript"
            variant="secondary"
            onPress={onContinue}
            hint="Opens the transcript review screen before report generation"
          />
        ) : null}
      </View>
    );
  }

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

export default RecordingControls;
