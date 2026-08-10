import { Modal, Pressable, Text, View } from 'react-native';
import styles from './styles/SessionRecoveryModal.styles';

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

export default SessionRecoveryModal;
