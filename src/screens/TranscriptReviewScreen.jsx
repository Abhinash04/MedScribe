import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Animated,
  Easing,
  LayoutAnimation,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/Feather';
import RefiningOverlay from '../components/RefiningOverlay';
import ScreenContainer from '../components/ScreenContainer';
import MissingFieldsModal from '../components/MissingFieldsModal';
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
import styles from './styles/TranscriptReviewScreen.styles';
import dictationSessionManager from '../services/dictationSessionManager';
import { isRetryableFailure } from '../services/captureOutcome';
import { extractForReport } from '../services/extractionService';
import {
  blockingFields,
  validateReportCompleteness,
} from '../services/reportCompleteness';
import { mergeExtraction, toDraft } from '../services/reportDraft';
import {
  speakMissingFields,
  stopPrompt,
} from '../services/speechPromptService';

function formatDuration(totalSeconds = 0) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;
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
  const setTranscriptSource = useRecordingStore(
    state => state.setTranscriptSource,
  );
  const setAnuvadiniText = useRecordingStore(state => state.setAnuvadiniText);
  const refineProgress = useRecordingStore(state => state.refineProgress);
  const captureUnavailable = useRecordingStore(
    state => state.captureUnavailable,
  );
  const [viewedSource, setViewedSource] = useState(selectedSource);
  const [blocked, setBlocked] = useState(null);
  const [promptReason, setPromptReason] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const chosenRef = useRef(false);
  const [skippedRefinement, setSkippedRefinement] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(0);
  const [copied, setCopied] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const editorFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -12,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fadeAnim, slideAnim, pulseAnim, floatAnim]);

  const beginSubmit = useCallback(() => {
    if (submittingRef.current) return false;
    submittingRef.current = true;
    setSubmitting(true);
    return true;
  }, []);

  useEffect(
    () => () => {
      stopPrompt();
    },
    [],
  );

  const endSubmit = useCallback(() => {
    submittingRef.current = false;
    setSubmitting(false);
  }, []);

  const viewingAi = viewedSource === TRANSCRIPT_SOURCE.ANUVADINI;
  const aiReady =
    anuvadini.status === ANUVADINI_STATUS.READY && !!anuvadini.text.trim();
  const hasAiText = !!anuvadini.text.trim();
  const viewedText = viewingAi ? anuvadini.text : fullTranscript;

  const [editableText, setEditableText] = useState(viewedText);

  useEffect(() => {
    setEditableText(viewedText);
  }, [viewedText]);

  useEffect(() => {
    editorFade.setValue(0);
    Animated.timing(editorFade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [viewedSource, editorFade]);

  useEffect(() => {
    setStage(CONSULTATION_STAGE.REVIEW);
    dictationSessionManager.persistCurrentSession();
  }, [setStage]);

  const commitEditor = useCallback(
    text => {
      if (text === viewedText) return viewedText;
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
      if (source === viewedSource) return;
      commitEditor(editableText);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

  const playPrompt = useCallback(async completeness => {
    setPromptReason(null);
    const outcome = await speakMissingFields(blockingFields(completeness));
    if (outcome.spoken) {
      return;
    }
    if (__DEV__) {
      console.warn('[speechPrompt] not spoken:', outcome.reason);
    }
    setPromptReason(outcome.reason ?? 'unknown');
  }, []);

  const handleGenerateReport = useCallback(async () => {
    if (!beginSubmit()) return;
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
        playPrompt(result);
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
    playPrompt,
  ]);

  const applySource = useCallback(
    (source, { announce, commit = true }) => {
      if (commit) {
        commitEditor(editableText);
      }
      setTranscriptSource(source);

      const next = useRecordingStore.getState();
      const { record, residue } = extractForReport(
        selectActiveTranscript(next),
      );
      const previous = next.reportDraft;
      const kept = previous
        ? Object.keys(previous).filter(key => previous[key]?.edited).length
        : 0;
      setReportDraft(
        previous
          ? mergeExtraction(previous, record, residue)
          : toDraft(record, residue),
      );
      dictationSessionManager.persistCurrentSession();

      if (!announce) {
        return;
      }

      Alert.alert(
        'Report source changed',
        `The report will be built from the ${LABEL[source]} transcript.` +
          (kept
            ? `\n\n${kept} ${
                kept === 1 ? 'field you edited was' : 'fields you edited were'
              } kept.`
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

  const viewedSourceRef = useRef(viewedSource);
  viewedSourceRef.current = viewedSource;

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
    applySource(TRANSCRIPT_SOURCE.ANUVADINI, {
      announce: false,
      commit: viewedSourceRef.current !== TRANSCRIPT_SOURCE.ANUVADINI,
    });
    setViewedSource(TRANSCRIPT_SOURCE.ANUVADINI);
  }, [anuvadini, applySource]);

  const handleCopyTranscript = useCallback(() => {
    if (!editableText) {
      return;
    }
    Clipboard.setString(editableText);
    setCopied(true);
  }, [editableText]);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleSkipRefinement = useCallback(() => {
    chosenRef.current = true;
    setSkippedRefinement(true);
  }, []);

  const handleRetryRefinement = useCallback(() => {
    refineTranscript().catch(() => {});
  }, []);

  const handleAddMoreSpeech = useCallback(() => {
    setBlocked(null);
    setPromptReason(null);
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
    setPromptReason(null);
    stopPrompt();
  }, []);

  const handleReplayPrompt = useCallback(() => {
    if (blocked) {
      playPrompt(blocked);
    }
  }, [blocked, playPrompt]);

  const handleReviewFields = useCallback(async () => {
    if (!beginSubmit()) return;
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
    if (!isTranscriptionAvailable()) return 'Not configured in this build';
    switch (anuvadini.status) {
      case ANUVADINI_STATUS.PENDING:
        return 'Generating…';
      case ANUVADINI_STATUS.READY:
        if (!hasAiText) return 'Emptied — type here or use the original';
        return aiReady ? 'Ready' : 'Same as original';
      case ANUVADINI_STATUS.FAILED:
        if (anuvadini.error === ERROR_KIND.AUDIO_TOO_LARGE) {
          return 'Recording too long to process';
        }
        if (captureUnavailable) {
          return 'Microphone capture did not start — nothing to refine';
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

  const wordCount = editableText
    ? editableText
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0).length
    : 0;

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.appBar}>
        <Pressable
          onPress={goBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={20} color="#0F172A" />
        </Pressable>
        <Text style={styles.appBarTitle}>Transcript Review</Text>
        <View style={styles.appBarRightSpacer} />
      </View>

      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.flexOne,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.heroSection}>
            <View style={styles.heroLeft}>
              <View style={styles.heroLabelRow} />
              <Text style={styles.heroTitle}>
                Review & Edit{'\n'}Transcript
              </Text>
              <Text style={styles.heroSubtitle}>
                Compare both transcriptions, then choose which one the report is
                built from.
              </Text>
            </View>

            <View style={styles.heroRight}>
              <Animated.View
                style={[
                  styles.illustrationContainer,
                  { transform: [{ translateY: floatAnim }] },
                ]}
              >
                <View style={[styles.blob, styles.blobBlue]} />
                <View style={[styles.blob, styles.blobLavender]} />
                <View style={styles.illusDoc}>
                  <Icon name="file-text" size={28} color="#2F6BFF" />
                  <View style={styles.illusSparkle}>
                    <Icon name="star" size={10} color="#FFF" />
                  </View>
                </View>
                <View style={styles.illusWave}>
                  <Icon name="activity" size={14} color="#8B5CF6" />
                </View>
              </Animated.View>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <View style={[styles.iconCircle, styles.iconCircleBlue]}>
                <Icon name="clock" size={18} color="#2F6BFF" />
              </View>
              <View style={styles.summaryTextCol}>
                <Text style={styles.summaryTitle}>Recording Time</Text>
                <Text style={styles.summaryValue}>
                  {formatDuration(durationSeconds)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryCard}>
              <View style={[styles.iconCircle, styles.iconCirclePurple]}>
                <Icon name="layers" size={18} color="#8B5CF6" />
              </View>
              <View style={styles.summaryTextCol}>
                <Text style={styles.summaryTitle}>Report Uses</Text>
                <Text style={styles.summaryValue}>{LABEL[selectedSource]}</Text>
              </View>
            </View>
          </View>

          <View style={styles.segmentContainer}>
            {[TRANSCRIPT_SOURCE.NATIVE, TRANSCRIPT_SOURCE.ANUVADINI].map(
              source => {
                const isSelectedTab = viewedSource === source;
                const isUsed = selectedSource === source;
                return (
                  <Pressable
                    key={source}
                    style={[
                      styles.segmentTab,
                      isSelectedTab && styles.segmentTabActive,
                    ]}
                    onPress={() => showSource(source)}
                  >
                    <View style={styles.segmentTabHeader}>
                      {source === TRANSCRIPT_SOURCE.ANUVADINI &&
                        !isSelectedTab && (
                          <Icon
                            name="star"
                            size={14}
                            color="#8B5CF6"
                            style={styles.starIconMargin}
                          />
                        )}
                      <Text
                        style={[
                          styles.segmentTabText,
                          isSelectedTab && styles.segmentTabTextActive,
                        ]}
                      >
                        {LABEL[source]}
                      </Text>
                      {isUsed && (
                        <Icon
                          name="check-circle"
                          size={13}
                          color={isSelectedTab ? '#FFFFFF' : '#2F6BFF'}
                          style={styles.usedCheckMargin}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.inUseText,
                        isSelectedTab && styles.inUseTextActive,
                        !isUsed && styles.inUseTextIdle,
                      ]}
                    >
                      {isUsed ? 'USED FOR REPORT' : 'PREVIEW ONLY'}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </View>

          {showFailureNotice ? (
            <View style={styles.fallbackNotice}>
              <Text style={styles.fallbackText}>
                {captureUnavailable
                  ? 'Microphone capture did not start for this dictation, so ' +
                    'there was no audio to refine — continuing with the ' +
                    'original transcription.'
                  : 'AI refinement could not be completed — continuing with ' +
                    'the original transcription.'}
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

          {viewingAi && !aiReady && (
            <View style={styles.statusRow}>
              {anuvadini.status === ANUVADINI_STATUS.PENDING ? (
                <ActivityIndicator size="small" color="#2F6BFF" />
              ) : null}
              <Text style={styles.statusText}>{aiStatusLine()}</Text>
              {anuvadini.status === ANUVADINI_STATUS.FAILED &&
              canRetryRefinement ? (
                <Pressable
                  onPress={handleRetryRefinement}
                  accessibilityRole="button"
                >
                  <Text style={styles.retry}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <View style={styles.editorCard}>
            <View style={styles.editorHeader}>
              <View style={styles.editorHeaderLeft}>
                <Icon name="file-text" size={16} color="#2F6BFF" />
                <Text style={styles.editorHeaderTitle}>
                  {viewingAi ? 'AI Transcription' : 'Original Transcription'}
                </Text>
              </View>
              {viewedIsSelected ? (
                <View style={styles.selectedBadge}>
                  <Icon name="check" size={12} color="#FFFFFF" />
                  <Text style={styles.selectedBadgeText}>Used for report</Text>
                </View>
              ) : (
                <View style={styles.unusedBadge}>
                  <Text style={styles.unusedBadgeText}>Not used</Text>
                </View>
              )}
            </View>
            <Animated.View style={{ opacity: editorFade }}>
              {viewingAi &&
              !hasAiText &&
              anuvadini.status !== ANUVADINI_STATUS.READY ? (
                anuvadini.status === ANUVADINI_STATUS.PENDING ? (
                  <View style={styles.pendingBlock}>
                    <ActivityIndicator size="small" color="#2F6BFF" />
                    <Text style={styles.pendingTitle}>
                      Generating AI transcription…
                    </Text>
                    <Text style={styles.pendingDetail}>
                      This usually takes a few seconds. The original transcript
                      is ready to use in the meantime.
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.placeholder}>
                    No AI transcription for this dictation. The original
                    transcript is unaffected and can still generate the report.
                  </Text>
                )
              ) : (
                <TextInput
                  style={styles.editorInput}
                  multiline
                  value={editableText}
                  onChangeText={setEditableText}
                  placeholder="Dictated text will appear here..."
                  placeholderTextColor="#94A3B8"
                />
              )}
            </Animated.View>

            <View style={styles.editorToolbar}>
              <View style={styles.toolbarLeft}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Icon name="activity" size={16} color="#2F6BFF" />
                </Animated.View>
                <Text style={styles.wordCount}>{wordCount} words</Text>
              </View>
              <View style={styles.toolbarRight}>
                <Pressable
                  style={styles.toolbarIcon}
                  onPress={handleCopyTranscript}
                  disabled={!editableText}
                  accessibilityRole="button"
                  accessibilityLabel="Copy the transcript"
                  accessibilityState={{ disabled: !editableText }}
                  hitSlop={8}
                >
                  <Icon
                    name={copied ? 'check' : 'copy'}
                    size={18}
                    color={editableText ? '#2F6BFF' : '#94A3B8'}
                  />
                </Pressable>
              </View>
            </View>
          </View>

          {canSelectViewed && !viewedIsSelected ? (
            <Pressable
              style={({ pressed }) => [
                styles.useBtn,
                pressed && styles.pressed,
              ]}
              onPress={() => selectForReport(viewedSource)}
              accessibilityRole="button"
            >
              <Text style={styles.useBtnText}>
                {viewingAi
                  ? 'Use AI Transcription'
                  : 'Use Original Transcription'}
              </Text>
            </Pressable>
          ) : null}

          <TranscriptDiffView original={nativeRaw} revised={anuvadini.raw} />
        </Animated.View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.addMoreBtn,
            pressed && styles.pressed,
            submitting && styles.disabled,
          ]}
          onPress={handleResumeRecording}
          disabled={submitting}
        >
          <Icon name="plus" size={20} color="#2F6BFF" />
          <Text style={styles.addMoreBtnText}>Add More Speech</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.generateBtn,
            pressed && styles.generateBtnPressed,
            submitting && styles.disabled,
          ]}
          onPress={handleGenerateReport}
          disabled={submitting}
        >
          <View style={styles.generateBtnContent}>
            <Icon name="file-text" size={20} color="#FFF" />
            <Text style={styles.generateBtnText}>Generate Report</Text>
          </View>
          <Icon name="arrow-right" size={20} color="#FFF" />
        </Pressable>
      </View>

      <RefiningOverlay
        visible={refining}
        onSkip={handleSkipRefinement}
        progress={refineProgress}
      />

      <MissingFieldsModal
        visible={!!blocked}
        missing={blocked?.missingFields ?? []}
        invalid={blocked?.invalidFields ?? []}
        onAddSpeech={handleAddMoreSpeech}
        onReviewFields={handleReviewFields}
        onReplay={handleReplayPrompt}
        onDismiss={handleDismissBlocked}
        promptError={promptReason}
      />
    </ScreenContainer>
  );
};

export default TranscriptReviewScreen;
