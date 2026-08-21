import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import styles from './styles/MissingFieldsModal.styles';

const PROMPT_ERROR_TEXT = {
  not_configured: 'the spoken prompt is not configured in this build',
  network: 'the network could not be reached',
  timeout: 'the speech service timed out',
  client_error: 'the speech service rejected the request',
  server_error: 'the speech service is unavailable',
  malformed: 'the speech service returned no usable audio',
  empty_speech: 'the speech service returned no usable audio',
  unsupported_language: 'this language has no voice',
  playback_failed: 'the audio could not be played on this device',
  cancelled: 'it was interrupted',
  superseded: 'it was interrupted',
  nothing_missing: 'there was nothing to read out',
  language_unknown:
    'the dictation language could not be determined, so this was read out in English',
};

const describePromptError = reason =>
  PROMPT_ERROR_TEXT[reason] || `of an unexpected error (${reason})`;

const MissingFieldsModal = ({
  visible,
  missing = [],
  invalid = [],
  onAddSpeech,
  onReviewFields,
  onReplay,
  onDismiss,
  promptError = null,
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

          {promptError ? (
            <Text style={styles.promptError}>
              The spoken prompt could not play because{' '}
              {describePromptError(promptError)}.
            </Text>
          ) : null}

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
