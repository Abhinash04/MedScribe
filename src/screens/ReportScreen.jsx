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
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import ActionDock, {
  useActionDockClearance,
} from '../components/ActionDock';
import AdditionalNotes from '../components/AdditionalNotes';
import AppHeader from '../components/AppHeader';
import MissingFieldsModal from '../components/MissingFieldsModal';
import ReportField from '../components/ReportField';
import ScreenContainer from '../components/ScreenContainer';
import { HALF_WIDTH, REPORT_SECTIONS } from '../constants/reportSections';
import { REPORT_STATUS } from '../db/reportsRepository';
import { extractForReport } from '../services/extractionService';
import { exportReport, shareReport } from '../services/pdfService';
import {
  blockingFields,
  validateReportCompleteness,
} from '../services/reportCompleteness';
import {
  applyEdit,
  draftNotes,
  draftValues,
  fromStored,
  hasValue,
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
  selectExtractionOptions,
  selectReportTranscript,
  selectSourceTranscript,
} from '../store/useRecordingStore';
import {
  needsTranslation,
  TRANSLATION_STATUS,
} from '../services/consultationTranslation';
import dictationSessionManager from '../services/dictationSessionManager';
import useReportsStore from '../store/useReportsStore';
import { colors } from '../theme';
import { formatDateTime } from '../utils/datetime';
import styles from './styles/ReportScreen.styles';

const TOTAL_REQUIRED = 4;

const SECTION_TINTS = {
  sectionA: { fill: colors.accentSoft, glyph: colors.primaryAccent },
  sectionB: { fill: colors.violetSoft, glyph: colors.violet },
  additional: { fill: colors.warningSoft, glyph: colors.warningText },
};

const ReportSection = ({ section, draft, onChange }) => {
  const tint = SECTION_TINTS[section.key] ?? SECTION_TINTS.patient;
  const required = section.fields.filter(field => field.required);
  const filled = required.filter(field =>
    hasValue(draft?.[field.key], field.key),
  ).length;
  const complete = filled === required.length;

  const renderField = field => (
    <ReportField
      key={field.key}
      label={field.label}
      entry={draft[field.key]}
      isList={!!field.list}
      multiline={!!field.multiline}
      required={!!field.required}
      keyboard={field.keyboard}
      onChange={value => onChange(field.key, value)}
    />
  );

  const rows = [];
  for (let index = 0; index < section.fields.length; index += 1) {
    const field = section.fields[index];
    const next = section.fields[index + 1];

    if (HALF_WIDTH.has(field.key) && next && HALF_WIDTH.has(next.key)) {
      rows.push({
        key: `${field.key}-${next.key}`,
        node: (
          <View style={styles.fieldPair}>
            <View style={styles.pairItem}>{renderField(field)}</View>
            <View style={styles.pairItem}>{renderField(next)}</View>
          </View>
        ),
      });
      index += 1;
      continue;
    }

    rows.push({ key: field.key, node: renderField(field) });
  }

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: tint.fill }]}>
          <Icon name={section.icon} size={18} color={tint.glyph} />
        </View>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {required.length ? (
          <View
            style={[
              styles.sectionCountPill,
              complete && styles.sectionCountPillComplete,
            ]}
          >
            <Text
              style={[
                styles.sectionCountText,
                complete && styles.sectionCountTextComplete,
              ]}
            >
              {filled}/{required.length}
            </Text>
          </View>
        ) : null}
      </View>

      {rows.map((row, index) => (
        <View key={row.key}>
          {index === 0 ? null : <View style={styles.divider} />}
          {row.node}
        </View>
      ))}
    </View>
  );
};

const ReportScreen = ({ route }) => {
  const navigation = useNavigation();
  const openedId = route?.params?.reportId ?? null;
  const transcriptFromStore = useRecordingStore(selectReportTranscript);
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
  const dockClearance = useActionDockClearance();

  useEffect(() => {
    if (openedId || draft) {
      return;
    }
    const { record, residue } = capture(() =>
      extractForReport(
        transcriptFromStore,
        selectExtractionOptions(useRecordingStore.getState()),
      ),
    );
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

  const completeness = useMemo(
    () => (draft ? validateReportCompleteness(draft) : null),
    [draft],
  );
  const captured = useMemo(
    () => (completeness ? completeness.capturedCount : 0),
    [completeness],
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

    const state = useRecordingStore.getState();
    if (needsTranslation(state.language) && state.translation?.status !== TRANSLATION_STATUS.READY) {
      throw new Error(
        'The English translation is not ready yet. Review the translation, then save again.',
      );
    }

    const id = await saveNew({
      transcript,
      extracted,
      edited: draft,
      language: state.language,
      sourceTranscript: needsTranslation(state.language)
        ? selectSourceTranscript(state)
        : '',
    });
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

  const handleHome = useCallback(
    () => navigation.navigate('Dashboard'),
    [navigation],
  );

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
        <AppHeader showHome onHomePress={handleHome} title="Patient Report" />
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
  const complete = captured === TOTAL_REQUIRED;
  const isFinal = status === REPORT_STATUS.FINAL;
  const progressPercent = TOTAL_REQUIRED
    ? Math.round((captured / TOTAL_REQUIRED) * 100)
    : 0;

  const emphasis = dirty
    ? 'save'
    : isFinal
    ? 'pdf'
    : complete
    ? 'finalize'
    : null;

  const dockItems = [
    {
      key: 'save',
      label: 'Save',
      icon: 'save',
      onPress: handleSave,
      disabled: busy,
      busy,
      accessibilityLabel: reportId ? 'Save changes' : 'Save report',
    },
    {
      key: 'pdf',
      label: 'PDF',
      icon: 'download',
      onPress: handleExportPdf,
      disabled: busy,
      accessibilityLabel: 'Download the report as a PDF',
    },
    {
      key: 'finalize',
      label: isFinal ? 'Finalized' : 'Finalize',
      icon: 'check-circle',
      onPress: handleFinalize,
      disabled: busy || isFinal,
      done: isFinal,
      accessibilityLabel: isFinal
        ? 'This report is finalized'
        : 'Finalize this report',
    },
    {
      key: 'home',
      label: 'Dashboard',
      icon: 'home',
      onPress: handleDone,
      accessibilityLabel: 'Back to dashboard',
    },
  ];

  return (
    <>
    <ScreenContainer>
      <AppHeader
        showHome
        onHomePress={handleHome}
        title="Patient Report"
        onLongPressTitle={DIAGNOSTICS_ENABLED ? handleDiagnostics : undefined}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: dockClearance },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View
                style={[
                  styles.summaryIcon,
                  complete
                    ? styles.summaryIconComplete
                    : styles.summaryIconPending,
                ]}
              >
                <Icon
                  name={complete ? 'check-circle' : 'alert-circle'}
                  size={22}
                  color={complete ? colors.successText : colors.warningText}
                />
              </View>
              <View style={styles.summaryTextCol}>
                <Text style={styles.summaryCount}>
                  {captured} of {TOTAL_REQUIRED} captured
                </Text>
                <Text style={styles.summaryLabel}>
                  {complete
                    ? 'All required details are in. Tap any field to correct it.'
                    : 'Tap any field to correct it before saving.'}
                </Text>
              </View>
            </View>

            <View style={styles.track}>
              <View
                style={[
                  styles.trackFill,
                  complete
                    ? styles.trackFillComplete
                    : styles.trackFillPending,
                  { width: `${progressPercent}%` },
                ]}
              />
            </View>

            <View style={styles.metaRow}>
              <View
                style={[
                  styles.statusPill,
                  status === REPORT_STATUS.FINAL
                    ? styles.statusFinal
                    : styles.statusDraft,
                ]}
              >
                <Icon
                  name={
                    status === REPORT_STATUS.FINAL ? 'check-circle' : 'edit-3'
                  }
                  size={11}
                  color={
                    status === REPORT_STATUS.FINAL
                      ? colors.onPrimary
                      : colors.textPrimary
                  }
                />
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

              <View style={styles.savedRow}>
                <Icon
                  name={dirty ? 'alert-circle' : 'clock'}
                  size={12}
                  color={dirty ? colors.warningText : colors.textMuted}
                />
                <Text
                  style={[
                    styles.savedLabel,
                    dirty && styles.savedLabelDirty,
                  ]}
                  numberOfLines={1}
                >
                  {dirty ? 'Unsaved changes' : savedLabel}
                </Text>
              </View>
            </View>
          </View>

          {blocking.length ? (
            <View style={styles.missingCard}>
              <Icon
                name="alert-circle"
                size={18}
                color={colors.warningText}
              />
              <View style={styles.missingBody}>
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
            </View>
          ) : null}

          {REPORT_SECTIONS.map(section => (
            <ReportSection
              key={section.key}
              section={section}
              draft={draft}
              onChange={handleChange}
            />
          ))}

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
            <Icon
              name={showTranscript ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.secondaryAccent}
            />
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

      <MissingFieldsModal
        visible={showMissing}
        missing={completeness?.missingFields ?? []}
        invalid={completeness?.invalidFields ?? []}
        onAddSpeech={handleAddMoreSpeech}
        onReviewFields={() => setShowMissing(false)}
        onDismiss={() => setShowMissing(false)}
      />
    </ScreenContainer>
    <ActionDock items={dockItems} emphasis={emphasis} />
    </>
  );
};

export default ReportScreen;
