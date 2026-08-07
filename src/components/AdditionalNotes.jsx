import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PATIENT_FIELDS } from '../constants/patientFields';
import { colors, spacing } from '../theme';

const labelFor = key => PATIENT_FIELDS.find(field => field.key === key)?.label ?? null;
const AdditionalNotes = ({ notes = [], onKeep, onChangeText }) => {
  if (!notes.length) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Not captured in any field</Text>
      <Text style={styles.hint}>
        Dictated but matched no report field. Keep what belongs in the report.
      </Text>

      {notes.map((note, index) => {
        const suggestion = labelFor(note.suggestedField);
        return (
          <View
            key={note.id ?? index}
            style={[styles.note, note.kept && styles.noteKept]}
          >
            <View style={styles.noteHeader}>
              <Text style={[styles.suggestion, !suggestion && styles.suggestionMuted]}>
                {suggestion ? `Looks like ${suggestion}` : 'Unclassified'}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.keep,
                  note.kept ? styles.keepOn : styles.keepOff,
                  pressed && styles.keepPressed,
                ]}
                onPress={() => onKeep?.(index, !note.kept)}
                accessibilityRole="switch"
                accessibilityState={{ checked: !!note.kept }}
                accessibilityLabel={
                  note.kept
                    ? `In the report. Tap to leave out: ${note.text}`
                    : `Left out. Tap to keep in the report: ${note.text}`
                }
                hitSlop={8}
              >
                <Text style={[styles.keepText, note.kept ? styles.keepTextOn : styles.keepTextOff]}>
                  {note.kept ? '✓ Kept' : 'Keep'}
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.text}
              value={note.text}
              onChangeText={text => onChangeText?.(index, text)}
              multiline
              accessibilityLabel="Dictated note"
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  hint: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  note: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  noteKept: {
    borderLeftColor: colors.primaryAccent,
    backgroundColor: colors.primaryLight,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingRight: spacing.sm,
    paddingBottom: spacing.sm,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  suggestion: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.primaryAccent,
  },
  suggestionMuted: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  keep: {
    minWidth: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  keepOff: {
    backgroundColor: colors.surface,
    borderColor: colors.primaryAccent,
  },
  keepOn: {
    backgroundColor: colors.primaryAccent,
    borderColor: colors.primaryAccent,
  },
  keepPressed: {
    opacity: 0.75,
  },
  keepText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  keepTextOff: {
    color: colors.primaryAccent,
  },
  keepTextOn: {
    color: colors.onPrimary,
  },
  text: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: colors.textPrimary,
    padding: 0,
    paddingRight: spacing.xs,
  },
});

export default AdditionalNotes;
