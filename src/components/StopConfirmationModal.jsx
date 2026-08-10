import { Modal, Pressable, Text, View } from 'react-native';
import styles from './styles/StopConfirmationModal.styles';

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

export default StopConfirmationModal;
