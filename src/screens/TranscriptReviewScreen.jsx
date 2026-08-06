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
import ScreenContainer from '../components/ScreenContainer';
import SectionTitle from '../components/SectionTitle';
import TranscriptDiffView from '../components/TranscriptDiffView';
import { isTranscriptionAvailable } from '../config/features';
import { refineTranscript } from '../services/transcriptRefinement';
import { ERROR_KIND } from '../services/anuvadini/proxyContract';
import {
  ANUVADINI_STATUS,
  TRANSCRIPT_SOURCE,
} from '../services/consultationTranscripts';
import useRecordingStore, {
  CONSULTATION_STAGE,
  selectActiveTranscript,
  selectFullTranscript,
} from '../store/useRecordingStore';
import { colors, spacing, typography } from '../theme';
import dictationSessionManager from '../services/dictationSessionManager';
import { extractPatientFields } from '../services/extractionService';
import { validateReportCompleteness } from '../services/reportCompleteness';
import { mergeExtraction, toDraft } from '../services/reportDraft';

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

  /**
   * Which transcript is on screen. Deliberately separate from which one the
   * report is built from: looking at the alternative must never quietly
   * re-extract the report behind the doctor.
   */
  const [viewedSource, setViewedSource] = useState(selectedSource);
  const [blocked, setBlocked] = useState(null);
  /**
   * Both footer actions persist and then navigate. A second tap arriving before
   * the first await settles would extract twice and dispatch two navigations,
   * so the guard is a ref — state would not update until the next render, which
   * is exactly the window a double tap lands in.
   */
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const beginSubmit = useCallback(() => {
    if (submittingRef.current) {
      return false;
    }
    submittingRef.current = true;
    setSubmitting(true);
    return true;
  }, []);

  const endSubmit = useCallback(() => {
    submittingRef.current = false;
    setSubmitting(false);
  }, []);

  const viewingAi = viewedSource === TRANSCRIPT_SOURCE.ANUVADINI;
  const aiReady = anuvadini.status === ANUVADINI_STATUS.READY && !!anuvadini.text.trim();
  /**
   * Editing stays available while a continuation is being transcribed — the
   * existing draft is still the doctor's to correct, and blanking it behind a
   * "generating" placeholder would look like the transcript had been lost.
   */
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

  // The editor writes back to whichever transcript is being viewed, so the
  // other one is never disturbed by an edit made here.
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

  /**
   * Switching tabs commits first. Without this the effect that follows
   * `viewedText` resets the editor and the doctor's uncommitted correction
   * disappears the moment they look at the other transcript.
   */
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

  const handleResumeRecording = useCallback(() => {
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
      // Extraction always runs against the SELECTED transcript, which is not
      // necessarily the one being viewed.
      const text = selectActiveTranscript(useRecordingStore.getState());

      const record = extractPatientFields(text);
      const draft = reportDraft ? mergeExtraction(reportDraft, record) : toDraft(record);
      setReportDraft(draft);

      const result = validateReportCompleteness(draft);
      if (!result.isComplete) {
        setBlocked(result);
        return;
      }

      setStage(CONSULTATION_STAGE.REPORT);
      await dictationSessionManager.persistNow();
      // Released before navigating: this screen is popped straight afterwards,
      // so clearing in a finally would land on an unmounted component.
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

  /**
   * The only thing that changes which transcript the report is built from.
   * Re-extracts, and mergeExtraction is what keeps manually corrected fields.
   */
  const selectForReport = useCallback(
    source => {
      commitEditor(editableText);
      setTranscriptSource(source);

      const next = useRecordingStore.getState();
      const record = extractPatientFields(selectActiveTranscript(next));
      const previous = next.reportDraft;
      const kept = previous
        ? Object.keys(previous).filter(key => previous[key]?.edited).length
        : 0;
      setReportDraft(previous ? mergeExtraction(previous, record) : toDraft(record));
      dictationSessionManager.persistCurrentSession();

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

  const handleRetryRefinement = useCallback(() => {
    refineTranscript().catch(() => {});
  }, []);

  const handleAddMoreSpeech = useCallback(() => {
    setBlocked(null);
    handleResumeRecording();
  }, [handleResumeRecording]);

  const handleReviewFields = useCallback(async () => {
    if (!beginSubmit()) {
      return;
    }
    try {
      setBlocked(null);
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
        // A dictation refused for its length must say so; reporting it as a
        // generic failure sends the doctor to Retry, which cannot help.
        return anuvadini.error === ERROR_KIND.AUDIO_TOO_LARGE
          ? 'Recording too long to process'
          : 'Unable to generate';
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

        {viewingAi ? (
          <View style={styles.statusRow}>
            {anuvadini.status === ANUVADINI_STATUS.PENDING ? (
              <ActivityIndicator size="small" color={colors.secondaryAccent} />
            ) : null}
            <Text style={styles.statusText}>{aiStatusLine()}</Text>
            {anuvadini.status === ANUVADINI_STATUS.FAILED ? (
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

      <MissingFieldsModal
        visible={!!blocked}
        missing={blocked?.missingFields ?? []}
        invalid={blocked?.invalidFields ?? []}
        onAddSpeech={handleAddMoreSpeech}
        onReviewFields={handleReviewFields}
        onDismiss={() => setBlocked(null)}
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
