import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AdditionalNotes from '../components/AdditionalNotes';
import AppHeader from '../components/AppHeader';
import MissingFieldsModal from '../components/MissingFieldsModal';
import ReportField from '../components/ReportField';
import ScreenContainer from '../components/ScreenContainer';
import { PATIENT_FIELDS, REQUIRED_FIELDS } from '../constants/patientFields';
import { REPORT_STATUS } from '../db/reportsRepository';
import { extractForReport } from '../services/extractionService';
import { exportReport, shareReport } from '../services/pdfService';
import {
  blockingFields,
  validateReportCompleteness,
} from '../services/reportCompleteness';
import {
  applyEdit,
  countRequiredFilled,
  draftNotes,
  draftValues,
  fromStored,
  isDirty,
  mergeExtraction,
  setNoteKept,
  setNoteText,
  toDraft,
} from '../services/reportDraft';
import {
  buildDiagnosticText,
  capture,
  DIAGNOSTICS_ENABLED,
} from '../dev/diagnostics';
import useRecordingStore, {
  CONSULTATION_STAGE,
  selectActiveTranscript,
} from '../store/useRecordingStore';
import dictationSessionManager from '../services/dictationSessionManager';
import useReportsStore from '../store/useReportsStore';
import { colors, spacing, typography } from '../theme';
import { formatDateTime } from '../utils/datetime';

const TOTAL_REQUIRED = REQUIRED_FIELDS.length;

const ReportScreen = ({ route }) => {
  const navigation = useNavigation();
  const openedId = route?.params?.reportId ?? null;
  const transcriptFromStore = useRecordingStore(selectActiveTranscript);
  const resetRecording = useRecordingStore(state => state.reset);
  const setReportDraft = useRecordingStore(state => state.setReportDraft);
  const setStage = useRecordingStore(state => state.setStage);
  const fetchReport = useReportsStore(state => state.fetchReport);
  const saveNew = useReportsStore(state => state.saveNew);
  const saveExisting = useReportsStore(state => state.saveExisting);
  const finalizeReport = useReportsStore(state => state.finalize);
  const [reportId, setReportId] = useState(openedId);
  const [loading, setLoading] = useState(!!openedId);
  const [transcript, setTranscript] = useState(
    openedId ? '' : transcriptFromStore,
  );
  const [extracted, setExtracted] = useState(null);
  const [draft, setDraft] = useState(null);
  const [savedDraft, setSavedDraft] = useState(null);
  const [status, setStatus] = useState(REPORT_STATUS.DRAFT);
  const [createdAt, setCreatedAt] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (openedId || draft) {
      return;
    }
    const { record, residue } = capture(() => extractForReport(transcriptFromStore));
    const stored = useRecordingStore.getState().reportDraft;
    setExtracted(record);
    setDraft(
      stored ? mergeExtraction(stored, record, residue) : toDraft(record, residue),
    );
    setTranscript(transcriptFromStore);
  }, [openedId, transcriptFromStore, draft]);

  useEffect(() => {
    if (openedId || !draft) {
      return;
    }
    setReportDraft(draft);
    setStage(CONSULTATION_STAGE.REPORT);
    dictationSessionManager.persistCurrentSession();
  }, [openedId, draft, setReportDraft, setStage]);

  useEffect(() => {
    if (!openedId) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const saved = await fetchReport(openedId);
        if (cancelled) {
          return;
        }
        if (!saved) {
          setLoadError('This report could no longer be found.');
          setLoading(false);
          return;
        }

        const restored = fromStored(saved.edited);
        setDraft(restored);
        setSavedDraft(restored);
        setExtracted(saved.extracted);
        setTranscript(saved.transcript);
        setStatus(saved.status);
        setCreatedAt(saved.createdAt);
        setSavedAt(saved.updatedAt);
        setLoading(false);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error?.message || 'Could not load this report.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openedId, fetchReport]);

  const captured = useMemo(
    () => (draft ? countRequiredFilled(draft) : 0),
    [draft],
  );
  const completeness = useMemo(
    () => (draft ? validateReportCompleteness(draft) : null),
    [draft],
  );
  const blocking = useMemo(
    () => (completeness ? blockingFields(completeness) : []),
    [completeness],
  );
  const dirty = useMemo(
    () => (draft ? isDirty(draft, savedDraft) : false),
    [draft, savedDraft],
  );

  const handleChange = useCallback((key, value) => {
    setDraft(current => applyEdit(current, key, value));
  }, []);

  const handleKeepNote = useCallback((index, kept) => {
    setDraft(current => setNoteKept(current, index, kept));
  }, []);

  const handleNoteText = useCallback((index, text) => {
    setDraft(current => setNoteText(current, index, text));
  }, []);

  const persist = useCallback(async () => {
    if (!draft) {
      return null;
    }

    if (reportId) {
      await saveExisting(reportId, { edited: draft });
      setSavedDraft(draft);
      setSavedAt(Date.now());
      return reportId;
    }

    const id = await saveNew({ transcript, extracted, edited: draft });
    setReportId(id);
    setSavedDraft(draft);
    const now = Date.now();
    setCreatedAt(now);
    setSavedAt(now);
    if (!openedId) {
      await dictationSessionManager.clearSession();
    }
    return id;
  }, [draft, reportId, saveExisting, saveNew, transcript, extracted, openedId]);

  const handleSave = useCallback(async () => {
    setBusy(true);
    try {
      await persist();
    } catch (error) {
      Alert.alert('Could not save', error?.message || 'The report was not saved.');
    } finally {
      setBusy(false);
    }
  }, [persist]);

  const handleFinalize = useCallback(async () => {
    if (completeness && !completeness.isComplete) {
      setShowMissing(true);
      return;
    }
    setBusy(true);
    try {
      const id = await persist();
      if (id) {
        await finalizeReport(id);
        setStatus(REPORT_STATUS.FINAL);
      }
    } catch (error) {
      Alert.alert(
        'Could not finalize',
        error?.message || 'The report status was not changed.',
      );
    } finally {
      setBusy(false);
    }
  }, [persist, finalizeReport, completeness]);

  const handleExportPdf = useCallback(async () => {
    if (completeness && !completeness.isComplete) {
      setShowMissing(true);
      return;
    }
    setBusy(true);
    try {
      await persist();
      const path = await exportReport(draft, {
        createdAt: createdAt ?? Date.now(),
        status,
      });
      await shareReport(path);
    } catch (error) {
      Alert.alert(
        'PDF export failed',
        error?.message || 'The report could not be exported.',
      );
    } finally {
      setBusy(false);
    }
  }, [persist, draft, createdAt, status, completeness]);

  const handleDone = useCallback(() => {
    resetRecording();
    navigation.navigate('Dashboard');
  }, [resetRecording, navigation]);

  const shareDiagnostics = useCallback(async () => {
    try {
      await Share.share({
        message: buildDiagnosticText({
          segments: useRecordingStore.getState().segments,
          transcript,
          record: extracted,
          draft,
          rendered: draftValues(draft),
        }),
      });
    } catch (error) {
      Alert.alert(
        'Diagnostics unavailable',
        error?.message || 'The diagnostic dump could not be shared.',
      );
    }
  }, [draft, transcript, extracted]);

  const handleDiagnostics = useCallback(() => {
    if (!draft || !DIAGNOSTICS_ENABLED) {
      return;
    }
    Alert.alert(
      'Share diagnostic dump?',
      'This sends the full patient record — name, contact details, symptoms, ' +
        'diagnosis and prescription — along with the original dictation, to ' +
        'whichever app you pick.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share', style: 'destructive', onPress: () => shareDiagnostics() },
      ],
    );
  }, [draft, shareDiagnostics]);

  const handleAddMoreSpeech = useCallback(() => {
    setShowMissing(false);
    setLeaving(true);
  }, []);

  useEffect(() => {
    if (!leaving) {
      return;
    }
    navigation.navigate('Recording', { resume: true });
  }, [leaving, navigation]);

  usePreventRemove(dirty && !busy && !leaving, ({ data }) => {
    Alert.alert(
      'Discard changes?',
      'This report has unsaved edits.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });

  if (loading || !draft) {
    return (
      <ScreenContainer>
        <AppHeader showBack onBackPress={() => navigation.goBack()} title="Patient Report" />
        <View style={styles.centered}>
          {loadError ? (
            <Text style={styles.errorText}>{loadError}</Text>
          ) : (
            <ActivityIndicator color={colors.secondaryAccent} />
          )}
        </View>
      </ScreenContainer>
    );
  }

  const savedLabel = savedAt
    ? `Saved ${formatDateTime(savedAt)}`
    : 'Not saved yet';

  return (
    <ScreenContainer>
      <AppHeader
        showBack
        onBackPress={() => navigation.goBack()}
        title="Patient Report"
        onLongPressTitle={DIAGNOSTICS_ENABLED ? handleDiagnostics : undefined}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCount}>
              {captured} of {TOTAL_REQUIRED}
            </Text>
            <Text style={styles.summaryLabel}>required fields captured</Text>
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.statusPill,
                  status === REPORT_STATUS.FINAL
                    ? styles.statusFinal
                    : styles.statusDraft,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    status === REPORT_STATUS.FINAL
                      ? styles.statusTextFinal
                      : styles.statusTextDraft,
                  ]}
                >
                  {status === REPORT_STATUS.FINAL ? 'FINAL' : 'DRAFT'}
                </Text>
              </View>
              <Text style={styles.savedLabel}>
                {dirty ? 'Unsaved changes' : savedLabel}
              </Text>
            </View>
            <Text style={styles.summaryHint}>
              Tap any field to correct it before saving.
            </Text>
          </View>

          {blocking.length ? (
            <View style={styles.missingCard}>
              <Text style={styles.missingTitle}>
                {blocking.length} required{' '}
                {blocking.length === 1 ? 'detail is' : 'details are'} still
                needed
              </Text>
              <Text style={styles.missingList}>
                {blocking.map(field => field.label).join(' • ')}
              </Text>
              <Text style={styles.missingHint}>
                Type them in below, or add more speech.
              </Text>
            </View>
          ) : null}

          <View style={styles.reportCard}>
            {PATIENT_FIELDS.map(field => (
              <ReportField
                key={field.key}
                label={field.label}
                entry={draft[field.key]}
                isList={!!field.list}
                multiline={!!field.multiline}
                keyboard={field.keyboard}
                onChange={value => handleChange(field.key, value)}
              />
            ))}
          </View>

          <AdditionalNotes
            notes={draftNotes(draft)}
            onKeep={handleKeepNote}
            onChangeText={handleNoteText}
          />

          <Pressable
            style={styles.transcriptToggle}
            onPress={() => setShowTranscript(current => !current)}
            accessibilityRole="button"
            accessibilityLabel={
              showTranscript
                ? 'Hide original dictation'
                : 'Show original dictation'
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
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
          onPress={handleSave}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Save report"
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryLabel}>
              {reportId ? 'Save Changes' : 'Save Report'}
            </Text>
          )}
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
            onPress={handleExportPdf}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Download the report as a PDF"
          >
            <Text style={styles.secondaryLabel}>Download PDF</Text>
          </Pressable>

          {status === REPORT_STATUS.FINAL ? null : (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                busy && styles.disabled,
                pressed && styles.pressed,
              ]}
              onPress={handleFinalize}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Finalize this report"
            >
              <Text style={styles.secondaryLabel}>Finalize</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={handleDone}
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
          style={styles.doneRow}
        >
          <Text style={styles.doneText}>Back to dashboard</Text>
        </Pressable>
      </View>

      <MissingFieldsModal
        visible={showMissing}
        missing={completeness?.missingFields ?? []}
        invalid={completeness?.invalidFields ?? []}
        onAddSpeech={handleAddMoreSpeech}
        onReviewFields={() => setShowMissing(false)}
        onDismiss={() => setShowMissing(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  summaryCard: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  summaryCount: {
    ...typography.largeHeading,
    color: colors.secondaryAccent,
  },
  summaryLabel: {
    ...typography.smallCaption,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusDraft: {
    backgroundColor: colors.surfaceBorder,
  },
  statusFinal: {
    backgroundColor: colors.success,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusTextDraft: {
    color: colors.textPrimary,
  },
  statusTextFinal: {
    color: colors.onPrimary,
  },
  savedLabel: {
    ...typography.smallCaption,
    letterSpacing: 0.3,
    textTransform: 'none',
  },
  summaryHint: {
    ...typography.mediumSubtitle,
    fontSize: 14,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  missingCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.secondaryAccent,
    padding: spacing.md,
    gap: spacing.xs,
  },
  missingTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  missingList: {
    ...typography.body,
    color: colors.secondaryAccent,
    fontWeight: '600',
  },
  missingHint: {
    fontSize: 13,
    color: colors.textSecondary,
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
    paddingTop: spacing.sm,
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
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.75,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  doneRow: {
    paddingVertical: spacing.sm,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },
});

export default ReportScreen;
