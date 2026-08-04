import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LOW_CONFIDENCE_THRESHOLD } from '../constants/fieldMarkers';
import { NOT_AVAILABLE } from '../constants/patientFields';
import { colors, spacing, typography } from '../theme';

/**
 * One labelled row of the structured report (SRS FR-6).
 *
 * Takes a draft entry ({ value, original, confidence, source, edited }).
 *
 * With `onChange` the row is editable: the value renders as a TextInput, so
 * tapping it enters edit mode with no separate toggle, and a field the
 * dictation never captured can be filled in by typing over the "Not Available"
 * placeholder (FR-7 still shows the doctor what is missing). Without
 * `onChange` the row is read-only.
 *
 * Values captured from a hedged phrase ("probably dengue") are flagged
 * UNCERTAIN, and anything the doctor changed is flagged EDITED, so the report
 * always shows what came from the machine and what came from the human.
 */
const ReportField = ({
  label,
  entry,
  isList = false,
  multiline = false,
  keyboard,
  onChange,
}) => {
  const value = entry?.value;
  const editable = typeof onChange === 'function';
  const hasValue = isList ? value?.length > 0 : !!value;
  const isUncertain =
    hasValue && !entry?.edited && entry?.confidence < LOW_CONFIDENCE_THRESHOLD;

  const items = isList && Array.isArray(value) ? value : [];

  const replaceItem = (index, text) =>
    onChange(items.map((item, position) => (position === index ? text : item)));

  const removeItem = index =>
    onChange(items.filter((_, position) => position !== index));

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {isUncertain ? (
          <Text
            style={styles.uncertainBadge}
            accessibilityLabel={`Low confidence, inferred from "${entry.source}"`}
          >
            UNCERTAIN
          </Text>
        ) : null}
        {entry?.edited ? (
          <Text
            style={styles.editedBadge}
            accessibilityLabel="Edited by the doctor"
          >
            EDITED
          </Text>
        ) : null}
      </View>

      {isList ? (
        <View>
          {items.map((item, index) => (
            <View key={`item-${index}`} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              {editable ? (
                <>
                  <TextInput
                    style={[styles.value, styles.input, styles.bulletText]}
                    value={item}
                    onChangeText={text => replaceItem(index, text)}
                    placeholder={label}
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel={`${label} item ${index + 1}`}
                  />
                  <Pressable
                    onPress={() => removeItem(index)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${label} item ${index + 1}`}
                  >
                    <Text style={styles.removeItem}>✕</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.value, styles.bulletText]}>{item}</Text>
              )}
            </View>
          ))}

          {items.length === 0 ? (
            <Text style={[styles.value, styles.missing]}>{NOT_AVAILABLE}</Text>
          ) : null}

          {editable ? (
            <Pressable
              onPress={() => onChange([...items, ''])}
              accessibilityRole="button"
              accessibilityLabel={`Add ${label} item`}
              style={styles.addRow}
            >
              <Text style={styles.addText}>+ Add item</Text>
            </Pressable>
          ) : null}
        </View>
      ) : editable ? (
        <TextInput
          style={[styles.value, styles.input, multiline && styles.multiline]}
          value={value ?? ''}
          onChangeText={onChange}
          placeholder={NOT_AVAILABLE}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          keyboardType={keyboard}
          accessibilityLabel={label}
        />
      ) : hasValue ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        <Text style={[styles.value, styles.missing]}>{NOT_AVAILABLE}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.smallCaption,
    textAlign: 'left',
    color: colors.textMuted,
  },
  uncertainBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onPrimary,
    backgroundColor: colors.textMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  editedBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onPrimary,
    // primaryAccent, not secondaryAccent: white on #0284C7 is ~4:1, which
    // fails AA for 10pt text. #2563EB reaches ~5.2:1 with the same white.
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  value: {
    ...typography.body,
    textAlign: 'left',
  },
  input: {
    // Keeps the row height stable between read and edit, so tapping a field
    // does not shift the rest of the report under the doctor's finger.
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.primaryBackground,
  },
  multiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  missing: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  bullet: {
    ...typography.body,
    color: colors.secondaryAccent,
  },
  bulletText: {
    flex: 1,
  },
  removeItem: {
    ...typography.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  addRow: {
    paddingVertical: spacing.sm,
  },
  addText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },
});

export default ReportField;
