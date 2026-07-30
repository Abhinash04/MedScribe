import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppHeader from '../components/AppHeader';
import ReportField from '../components/ReportField';
import ScreenContainer from '../components/ScreenContainer';
import { PATIENT_FIELDS } from '../constants/patientFields';
import {
  countCapturedFields,
  extractPatientFields,
} from '../services/extractionService';
import useRecordingStore, {
  selectFullTranscript,
} from '../store/useRecordingStore';
import { colors, spacing, typography } from '../theme';

const TOTAL_FIELDS = PATIENT_FIELDS.length;

/**
 * Structured report preview (SRS FR-6, FR-7, FR-8).
 *
 * Reads the finished transcript straight from the recording store, so it
 * neither re-runs recognition nor needs the transcript threaded through
 * navigation params.
 */
const ReportScreen = ({ navigation }) => {
  const transcript = useRecordingStore(selectFullTranscript);
  const [showTranscript, setShowTranscript] = useState(false);

  // Extraction is pure and deterministic — memoize on the transcript so
  // toggling the raw-transcript panel does not re-parse.
  const record = useMemo(() => extractPatientFields(transcript), [transcript]);
  const captured = useMemo(() => countCapturedFields(record), [record]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const resetRecording = useRecordingStore(state => state.reset);

  const handleNewDictation = useCallback(() => {
    // Explicit rather than relying on RecordingScreen resetting on mount —
    // that ordering works today but is an accident, not a contract.
    resetRecording();
    navigation.navigate('Home');
  }, [resetRecording, navigation]);

  return (
    <ScreenContainer>
      <AppHeader showBack onBackPress={handleBack} title="Patient Report" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCount}>
            {captured} of {TOTAL_FIELDS}
          </Text>
          <Text style={styles.summaryLabel}>fields captured</Text>
          {captured < TOTAL_FIELDS ? (
            <Text style={styles.summaryHint}>
              Missing fields are marked below. Dictate again to add them.
            </Text>
          ) : null}
        </View>

        <View style={styles.reportCard}>
          {PATIENT_FIELDS.map(field => (
            <ReportField
              key={field.key}
              label={field.label}
              field={record[field.key]}
              isList={!!field.list}
            />
          ))}
        </View>

        <Pressable
          style={styles.transcriptToggle}
          onPress={() => setShowTranscript(current => !current)}
          accessibilityRole="button"
          accessibilityLabel={
            showTranscript ? 'Hide original dictation' : 'Show original dictation'
          }
        >
          <Text style={styles.transcriptToggleText}>
            {showTranscript ? 'Hide' : 'Show'} original dictation
          </Text>
        </Pressable>

        {showTranscript ? (
          <View style={styles.transcriptCard}>
            <Text style={styles.transcriptText}>
              {transcript || 'No dictation was captured.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
          onPress={handleNewDictation}
          accessibilityRole="button"
          accessibilityLabel="Start a new dictation"
        >
          <Text style={styles.primaryLabel}>New dictation</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  summaryCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  summaryCount: {
    ...typography.largeHeading,
    color: colors.secondaryAccent,
  },
  summaryLabel: {
    ...typography.smallCaption,
    color: colors.textMuted,
  },
  summaryHint: {
    ...typography.mediumSubtitle,
    fontSize: 14,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.sm,
  },
  transcriptToggle: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  transcriptToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },
  transcriptCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginHorizontal: spacing.sm,
  },
  transcriptText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primaryAccent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
});

export default ReportScreen;
