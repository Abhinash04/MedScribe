import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppHeader from '../components/AppHeader';
import MissingFieldsModal from '../components/MissingFieldsModal';
import RefiningOverlay from '../components/RefiningOverlay';
import ScreenContainer from '../components/ScreenContainer';
import SectionTitle from '../components/SectionTitle';
import TranscriptDiffView from '../components/TranscriptDiffView';
import { isTranscriptionAvailable } from '../config/features';
import { refineTranscript } from '../services/transcriptRefinement';
import { ERROR_KIND } from '../services/anuvadini/proxyContract';
import {
  ANUVADINI_STATUS,
  TRANSCRIPT_SOURCE,
  shouldAutoSelectAi,
} from '../services/consultationTranscripts';
import useRecordingStore, {
  CONSULTATION_STAGE,
  selectActiveTranscript,
  selectFullTranscript,
} from '../store/useRecordingStore';
import { colors, spacing, typography } from '../theme';
import dictationSessionManager from '../services/dictationSessionManager';
import { isRetryableFailure } from '../services/captureOutcome';
import { extractForReport } from '../services/extractionService';
import {
  blockingFields,
  validateReportCompleteness,
} from '../services/reportCompleteness';
import { mergeExtraction, toDraft } from '../services/reportDraft';
import { speakMissingFields, stopPrompt } from '../services/speechPromptService';

function formatDuration(totalSeconds = 0) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const LABEL = {
  [TRANSCRIPT_SOURCE.NATIVE]: 'Original',
  [TRANSCRIPT_SOURCE.ANUVADINI]: 'AI Transcription',
};


const TranscriptReviewScreen = ({ navigation }) => {
  const fullTranscript = useRecordingStore(selectFullTranscript);
  const durationSeconds = useRecordingStore(state => state.durationSeconds);
  const setFullTranscript = useRecordingStore(state => state.setFullTranscript);
  const reportDraft = useRecordingStore(state => state.reportDraft);
  const setReportDraft = useRecordingStore(state => state.setReportDraft);
  const setStage = useRecordingStore(state => state.setStage);
  const anuvadini = useRecordingStore(state => state.anuvadini);
  const nativeRaw = useRecordingStore(state => state.nativeRaw);
  const selectedSource = useRecordingStore(state => state.transcriptSource);
  const setTranscriptSource = useRecordingStore(state => state.setTranscriptSource);
  const setAnuvadiniText = useRecordingStore(state => state.setAnuvadiniText);
  const [viewedSource, setViewedSource] = useState(selectedSource);
  const [blocked, setBlocked] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const chosenRef = useRef(false);
  const [skippedRefinement, setSkippedRefinement] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(0);

  const beginSubmit = useCallback(() => {
    if (submittingRef.current) {
      return false;
    }
    submittingRef.current = true;
    setSubmitting(true);
    return true;
  }, []);

  useEffect(() => () => { stopPrompt(); }, []);

  const endSubmit = useCallback(() => {
    submittingRef.current = false;
    setSubmitting(false);
  }, []);

  const viewingAi = viewedSource === TRANSCRIPT_SOURCE.ANUVADINI;
  const aiReady = anuvadini.status === ANUVADINI_STATUS.READY && !!anuvadini.text.trim();
  const hasAiText = !!anuvadini.text.trim();
  const viewedText = viewingAi ? anuvadini.text : fullTranscript;

  const [editableText, setEditableText] = useState(viewedText);

  useEffect(() => {
    setEditableText(viewedText);
  }, [viewedText]);

  useEffect(() => {
    setStage(CONSULTATION_STAGE.REVIEW);
    dictationSessionManager.persistCurrentSession();
  }, [setStage]);

  const commitEditor = useCallback(
    text => {
      if (text === viewedText) {
        return viewedText;
      }
      if (viewingAi) {
        setAnuvadiniText(text);
      } else {
        setFullTranscript(text);
      }
      return text;
    },
    [viewedText, viewingAi, setAnuvadiniText, setFullTranscript],
  );

  const showSource = useCallback(
    source => {
      if (source === viewedSource) {
        return;
      }
      commitEditor(editableText);
      setViewedSource(source);
    },
    [viewedSource, commitEditor, editableText],
  );

  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const handleResumeRecording = useCallback(async () => {
    await stopPrompt();
    commitEditor(editableText);
    setStage(CONSULTATION_STAGE.RECORDING);
    dictationSessionManager.persistCurrentSession();
    navigation.navigate('Recording', { resume: true });
  }, [navigation, editableText, commitEditor, setStage]);

  const handleGenerateReport = useCallback(async () => {
    if (!beginSubmit()) {
      return;
    }
    try {
      commitEditor(editableText);
      const text = selectActiveTranscript(useRecordingStore.getState());
      const { record, residue } = extractForReport(text);
      const draft = reportDraft
        ? mergeExtraction(reportDraft, record, residue)
        : toDraft(record, residue);
      setReportDraft(draft);
      const result = validateReportCompleteness(draft);
      if (!result.isComplete) {
        setBlocked(result);
        speakMissingFields(blockingFields(result));
        return;
      }
      setStage(CONSULTATION_STAGE.REPORT);
      await dictationSessionManager.persistNow();
      endSubmit();
      navigation.navigate('Report');
    } catch (error) {
      Alert.alert(
        'Could not open the report',
        error?.message || 'The consultation was not lost — try again.',
      );
    } finally {
      if (submittingRef.current) {
        endSubmit();
      }
    }
  }, [
    editableText,
    commitEditor,
    navigation,
    reportDraft,
    setReportDraft,
    setStage,
    beginSubmit,
    endSubmit,
  ]);

  const applySource = useCallback(
    (source, { announce }) => {
      commitEditor(editableText);
      setTranscriptSource(source);

      const next = useRecordingStore.getState();
      const { record, residue } = extractForReport(selectActiveTranscript(next));
      const previous = next.reportDraft;
      const kept = previous
        ? Object.keys(previous).filter(key => previous[key]?.edited).length
        : 0;
      setReportDraft(
        previous ? mergeExtraction(previous, record, residue) : toDraft(record, residue),
      );
      dictationSessionManager.persistCurrentSession();

      if (!announce) {
        return;
      }

      Alert.alert(
        'Report source changed',
        `The report will be built from the ${LABEL[source]} transcript.` +
          (kept
            ? `\n\n${kept} ${kept === 1 ? 'field you edited was' : 'fields you edited were'} kept.`
            : ''),
      );
    },
    [commitEditor, editableText, setTranscriptSource, setReportDraft],
  );

  const selectForReport = useCallback(
    source => {
      chosenRef.current = true;
      applySource(source, { announce: true });
    },
    [applySource],
  );

  useEffect(() => {
    const state = useRecordingStore.getState();
    if (
      !shouldAutoSelectAi({
        nativeText: selectFullTranscript(state),
        anuvadini: state.anuvadini,
        source: state.transcriptSource,
        chosen: chosenRef.current,
      })
    ) {
      return;
    }
    applySource(TRANSCRIPT_SOURCE.ANUVADINI, { announce: false });
    setViewedSource(TRANSCRIPT_SOURCE.ANUVADINI);
  }, [anuvadini, applySource]);

  const handleSkipRefinement = useCallback(() => {
    chosenRef.current = true;
    setSkippedRefinement(true);
  }, []);

  const handleRetryRefinement = useCallback(() => {
    refineTranscript().catch(() => {});
  }, []);

  const handleAddMoreSpeech = useCallback(() => {
    setBlocked(null);
    handleResumeRecording();
  }, [handleResumeRecording]);

  const canRetryRefinement = isRetryableFailure(anuvadini.error);

  const refining =
    isTranscriptionAvailable() &&
    anuvadini.status === ANUVADINI_STATUS.PENDING &&
    !skippedRefinement;

  const showFailureNotice =
    anuvadini.status === ANUVADINI_STATUS.FAILED &&
    anuvadini.updatedAt !== dismissedAt;

  const handleDismissBlocked = useCallback(() => {
    setBlocked(null);
    stopPrompt();
  }, []);

  const handleReplayPrompt = useCallback(() => {
    if (blocked) {
      speakMissingFields(blockingFields(blocked));
    }
  }, [blocked]);

  const handleReviewFields = useCallback(async () => {
    if (!beginSubmit()) {
      return;
    }
    try {
      setBlocked(null);
      await stopPrompt();
      setStage(CONSULTATION_STAGE.REPORT);
      await dictationSessionManager.persistNow();
      endSubmit();
      navigation.navigate('Report');
    } catch (error) {
      Alert.alert(
        'Could not open the report',
        error?.message || 'The consultation was not lost — try again.',
      );
    } finally {
      if (submittingRef.current) {
        endSubmit();
      }
    }
  }, [navigation, setStage, beginSubmit, endSubmit]);

  const aiStatusLine = () => {
    if (!isTranscriptionAvailable()) {
      return 'Not configured in this build';
    }
    switch (anuvadini.status) {
      case ANUVADINI_STATUS.PENDING:
        return 'Generating…';
      case ANUVADINI_STATUS.READY:
        return aiReady ? 'Ready' : 'Same as original';
      case ANUVADINI_STATUS.FAILED:
        if (anuvadini.error === ERROR_KIND.AUDIO_TOO_LARGE) {
          return 'Recording too long to process';
        }
        if (anuvadini.error === ERROR_KIND.NO_AUDIO) {
          return 'No audio was recorded for this pass — dictate again';
        }
        return 'Unable to generate';
      default:
        return 'Not available for this dictation';
    }
  };

  const canSelectViewed = viewingAi ? aiReady : true;
  const viewedIsSelected = viewedSource === selectedSource;

  return (
    <ScreenContainer style={styles.container}>
      <AppHeader showBack onBackPress={goBack} title="Transcript Review" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle
          title="Review & Edit Transcript"
          subtitle="Compare both transcriptions, then choose which one the report is built from."
        />

        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeLabel}>Recording Time</Text>
            <Text style={styles.metaBadgeValue}>{formatDuration(durationSeconds)}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeLabel}>Report Uses</Text>
            <Text style={styles.metaBadgeValue}>{LABEL[selectedSource]}</Text>
          </View>
        </View>

        <View style={styles.toggleRow}>
          {[TRANSCRIPT_SOURCE.NATIVE, TRANSCRIPT_SOURCE.ANUVADINI].map(source => {
            const active = viewedSource === source;
            return (
              <Pressable
                key={source}
                style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                onPress={() => showSource(source)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {LABEL[source]}
                </Text>
                {source === selectedSource ? (
                  <Text style={[styles.inUse, active && styles.inUseActive]}>IN USE</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {showFailureNotice ? (
          <View style={styles.fallbackNotice}>
            <Text style={styles.fallbackText}>
              AI refinement could not be completed — continuing with the original
              transcription.
            </Text>
            <Pressable
              onPress={() => setDismissedAt(anuvadini.updatedAt)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              hitSlop={8}
            >
              <Text style={styles.fallbackDismiss}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        {viewingAi ? (
          <View style={styles.statusRow}>
            {anuvadini.status === ANUVADINI_STATUS.PENDING ? (
              <ActivityIndicator size="small" color={colors.secondaryAccent} />
            ) : null}
            <Text style={styles.statusText}>{aiStatusLine()}</Text>
            {anuvadini.status === ANUVADINI_STATUS.FAILED && canRetryRefinement ? (
              <Pressable onPress={handleRetryRefinement} accessibilityRole="button">
                <Text style={styles.retry}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.editorCard}>
          <Text style={styles.cardLabel}>
            {viewingAi ? 'AI TRANSCRIPTION' : 'ORIGINAL TRANSCRIPTION'}
          </Text>
          {viewingAi && !hasAiText ? (
            <Text style={styles.placeholder}>
              {anuvadini.status === ANUVADINI_STATUS.PENDING
                ? 'The AI transcription is still being generated. The original transcript is ready to use in the meantime.'
                : 'No AI transcription for this dictation. The original transcript is unaffected and can still generate the report.'}
            </Text>
          ) : (
            <TextInput
              style={styles.fullTextInput}
              multiline
              value={editableText}
              onChangeText={setEditableText}
              placeholder="Dictated text will appear here..."
              placeholderTextColor={colors.textMuted}
            />
          )}
        </View>

        {canSelectViewed && !viewedIsSelected ? (
          <Pressable
            style={({ pressed }) => [styles.useBtn, pressed && styles.pressed]}
            onPress={() => selectForReport(viewedSource)}
            accessibilityRole="button"
          >
            <Text style={styles.useBtnText}>
              {viewingAi ? 'Use AI Transcription' : 'Use Original Transcription'}
            </Text>
          </Pressable>
        ) : null}

        <TranscriptDiffView original={nativeRaw} revised={anuvadini.raw} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.resumeBtn,
            pressed && styles.pressed,
            submitting && styles.disabled,
          ]}
          onPress={handleResumeRecording}
          disabled={submitting}
        >
          <Text style={styles.resumeBtnText}>+ Add More Speech</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.generateBtn,
            pressed && styles.pressed,
            submitting && styles.disabled,
          ]}
          onPress={handleGenerateReport}
          disabled={submitting}
        >
          <Text style={styles.generateBtnText}>Generate Report ➔</Text>
        </Pressable>
      </View>

      <RefiningOverlay visible={refining} onSkip={handleSkipRefinement} />

      <MissingFieldsModal
        visible={!!blocked}
        missing={blocked?.missingFields ?? []}
        invalid={blocked?.invalidFields ?? []}
        onAddSpeech={handleAddMoreSpeech}
        onReviewFields={handleReviewFields}
        onReplay={handleReplayPrompt}
        onDismiss={handleDismissBlocked}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  metaBadge: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    alignItems: 'center',
  },
  metaBadgeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaBadgeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryAccent,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
    gap: 2,
  },
  toggleBtnActive: {
    backgroundColor: colors.primaryAccent,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.onPrimary,
  },
  inUse: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  inUseActive: {
    color: colors.onPrimary,
  },
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondaryAccent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  fallbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  fallbackDismiss: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  retry: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryAccent,
  },
  editorCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    minHeight: 200,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  placeholder: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  fullTextInput: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 160,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 24,
  },
  useBtn: {
    backgroundColor: colors.secondaryAccent,
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
  },
  useBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  footer: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  generateBtn: {
    backgroundColor: colors.primaryAccent,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  resumeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  generateBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});

export default TranscriptReviewScreen;
