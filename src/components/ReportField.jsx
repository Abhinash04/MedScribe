import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LOW_CONFIDENCE_THRESHOLD } from '../constants/fieldMarkers';
import { NOT_AVAILABLE } from '../constants/patientFields';
import { colors, spacing, typography } from '../theme';

/**
 * One labelled row of the structured report (SRS FR-6).
 *
 * Takes an extracted field object ({ value, confidence, source }) or null.
 * A field the dictation never mentioned renders "Not Available" in muted
 * italics rather than being hidden (FR-7) — the doctor needs to see at a
 * glance what is still missing.
 *
 * Values captured from a hedged phrase ("probably dengue") are flagged, so an
 * uncertain reading is never presented as confidently as an explicit one.
 */
const ReportField = ({ label, field, isList = false }) => {
  const value = field?.value;
  const hasValue = isList ? value?.length > 0 : !!value;
  const isUncertain =
    hasValue && field.confidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {isUncertain ? (
          <Text
            style={styles.uncertainBadge}
            accessibilityLabel={`Low confidence, inferred from "${field.source}"`}
          >
            UNCERTAIN
          </Text>
        ) : null}
      </View>

      {!hasValue ? (
        <Text style={[styles.value, styles.missing]}>{NOT_AVAILABLE}</Text>
      ) : isList ? (
        <View>
          {value.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={[styles.value, styles.bulletText]}>{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.value}>{value}</Text>
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
    color: colors.primaryBackground,
    backgroundColor: colors.textMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  value: {
    ...typography.body,
    textAlign: 'left',
  },
  missing: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    ...typography.body,
    color: colors.secondaryAccent,
  },
  bulletText: {
    flex: 1,
  },
});

export default ReportField;
