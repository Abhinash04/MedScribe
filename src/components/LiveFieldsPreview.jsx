import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

/**
 * Live Fields Preview Component.
 *
 * Displays live structured fields extracted in real time as the doctor dictates.
 */

/**
 * The subset worth glancing at mid-dictation, in display order. Keys match
 * `PATIENT_FIELDS`; the rest of the eleven fields are left for the report
 * screen so this strip stays a glance, not a second form.
 */
const PREVIEW_FIELDS = [
  ['patientName', 'Patient'],
  ['age', 'Age'],
  ['gender', 'Gender'],
  ['symptoms', 'Symptoms'],
  ['diagnosis', 'Diagnosis'],
];

const LiveFieldsPreview = ({ fields = {}, style }) => {
  const entries = PREVIEW_FIELDS.map(([key, label]) => [
    key,
    label,
    fields?.[key],
  ]).filter(([, , val]) => {
    if (!val || !val.value) return false;
    if (Array.isArray(val.value)) return val.value.length > 0;
    return String(val.value).trim().length > 0;
  });

  if (entries.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.headerLabel}>LIVE EXTRACTED DETAILS</Text>
      <View style={styles.pillsRow}>
        {entries.map(([key, label, item]) => {
          const displayVal = Array.isArray(item.value)
            ? item.value.join(', ')
            : String(item.value);
          return (
            <View key={key} style={styles.pill}>
              <Text style={styles.pillLabel}>{label}:</Text>
              <Text style={styles.pillValue} numberOfLines={1}>
                {displayVal}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.sm,
    gap: 6,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryAccent,
    letterSpacing: 0.8,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  pillValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    maxWidth: 140,
  },
});

export default LiveFieldsPreview;
