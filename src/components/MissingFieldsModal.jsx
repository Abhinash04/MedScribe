import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

const MissingFieldsModal = ({
  visible,
  missing = [],
  invalid = [],
  onAddSpeech,
  onReviewFields,
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
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
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
    ...typography.largeHeading,
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
  list: {
    maxHeight: 220,
  },
  listContent: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bullet: {
    color: colors.secondaryAccent,
    fontSize: 18,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  rowNote: {
    fontSize: 12,
    color: colors.textMuted,
  },
  buttonRow: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primaryAccent,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  pressed: {
    opacity: 0.8,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default MissingFieldsModal;
