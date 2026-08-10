import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import styles from './styles/MissingFieldsModal.styles';

const MissingFieldsModal = ({
  visible,
  missing = [],
  invalid = [],
  onAddSpeech,
  onReviewFields,
  onReplay,
  onDismiss,
}) => {
  const total = missing.length + invalid.length;
  const detail = total === 1 ? 'detail is' : 'details are';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Complete Patient Details</Text>
          <Text style={styles.message}>
            {total} required {detail} still needed before this report can be
            generated.
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {missing.map(field => (
              <View key={field.key} style={styles.row}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.rowLabel}>{field.label}</Text>
              </View>
            ))}
            {invalid.map(field => (
              <View key={field.key} style={styles.row}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.rowLabel}>{field.label}</Text>
                <Text style={styles.rowNote}>needs checking</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
              onPress={onAddSpeech}
              accessibilityRole="button"
              accessibilityLabel="Add More Speech"
            >
              <Text style={styles.primaryText}>Add More Speech</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
              onPress={onReviewFields}
              accessibilityRole="button"
              accessibilityLabel="Review Fields"
            >
              <Text style={styles.secondaryText}>Review Fields</Text>
            </Pressable>

            {onReplay ? (
              <Pressable
                style={({ pressed }) => [styles.replay, pressed && styles.pressed]}
                onPress={onReplay}
                accessibilityRole="button"
                accessibilityLabel="Read the missing details aloud again"
                hitSlop={8}
              >
                <Text style={styles.replayText}>🔊 Read aloud again</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default MissingFieldsModal;
