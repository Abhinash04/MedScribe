import { Pressable, Text, View } from 'react-native';
import { RECORDING_STATE } from '../constants/recordingStates';
import { typography } from '../theme';
import styles from './styles/PermissionGate.styles';

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

export default PermissionGate;
