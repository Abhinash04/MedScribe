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
import LinearGradient from 'react-native-linear-gradient';

import RefiningOverlay from '../components/RefiningOverlay';
import MissingFieldsModal from '../components/MissingFieldsModal';
import TranscriptDiffView from '../components/TranscriptDiffView';
import { isTranscriptionAvailable } from '../config/features';
import { displayFor } from '../constants/languages';
import { refineTranscript } from '../services/transcriptRefinement';
import { ERROR_KIND } from '../services/anuvadini/proxyContract';
import {
  ANUVADINI_STATUS,
  TRANSCRIPT_SOURCE,
  canOffer,
  shouldAutoSelectAi,
} from '../services/consultationTranscripts';
import useRecordingStore, {
  CONSULTATION_STAGE,
  REPORT_SOURCE_KIND,
  selectFullTranscript,
  selectReportSourceKind,
  selectReportTranscript,
} from '../store/useRecordingStore';
import {
  TRANSLATION_STATUS,
  needsTranslation,
} from '../services/consultationTranslation';
import { ensureTranslation } from '../services/transcriptTranslation';
import useScaledStyles from '../hooks/useScaledStyles';
import createStyles from './styles/TranscriptReviewScreen.styles';
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
  [TRANSCRIPT_SOURCE.ANUVADINI]: 'AI Version',
};

const TRANSLATION_ERROR_TEXT = {
  [ERROR_KIND.NOT_CONFIGURED]: 'translation is not configured in this build',
  [ERROR_KIND.NETWORK]: 'the network could not be reached',
  [ERROR_KIND.TIMEOUT]: 'the translation service timed out',
  [ERROR_KIND.CLIENT_ERROR]: 'the translation service rejected the request',
  [ERROR_KIND.SERVER_ERROR]: 'the translation service is unavailable',
  [ERROR_KIND.MALFORMED]: 'the translation service returned no usable text',
  [ERROR_KIND.UNSUPPORTED_LANGUAGE]: 'this language is not supported',
  [ERROR_KIND.NO_TEXT]: 'there was nothing to translate',
  [ERROR_KIND.CANCELLED]: 'it was interrupted',
  [ERROR_KIND.QUOTA_EXCEEDED]:
    'this API key has used up its translation quota',
  [ERROR_KIND.UNAUTHORIZED]: 'the translation API key was rejected',
  [ERROR_KIND.TEXT_TOO_LARGE]:
    'this dictation is too long to translate in one request',
  [ERROR_KIND.EMPTY_TRANSLATION]: 'the translation service returned nothing',
  [ERROR_KIND.COUNT_MISMATCH]:
    'the translation service returned an unusable response',
};

const describeTranslationError = reason =>
  TRANSLATION_ERROR_TEXT[reason] || `an unexpected error: ${reason}`;

function GlassBtn({ children, onPress, accessibilityLabel, styles }) {
  return (
    <Pressable
      style={styles.glassBtn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}

function StatCard({ gradient, shadowColor, icon, label, value, sub, subColor, badge, badgeColor, styles }) {
  return (
    <LinearGradient colors={gradient} start={{x:0, y:0}} end={{x:1, y:1}} style={[styles.statCard, { shadowColor }]}>
      <View style={styles.statCardBlob1} />
      <View style={styles.statCardBlob2} />
      <View style={styles.statCardHeader}>
        <View style={styles.statCardIconBox}>
          {icon}
        </View>
        <View style={[styles.statCardBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.statCardBadgeText}>{badge}</Text>
        </View>
      </View>
      <Text style={styles.statCardLabel}>{label}</Text>
      <Text style={styles.statCardValue}>{value}</Text>
      <Text style={[styles.statCardSub, subColor && { color: subColor }]}>{sub}</Text>
    </LinearGradient>
  );
}

function TabBtn({ active, gradient, shadow, onPress, label, sub, icon, styles }) {
  const inactiveColor = gradient[0];
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <LinearGradient
        colors={active ? gradient : ['transparent', 'transparent']}
        start={{x:0, y:0}} end={{x:1, y:1}}
        style={[styles.tabBtn, active && { shadowColor: shadow, elevation: 6 }]}
      >
        <View style={styles.tabBtnIconBox}>
          {icon}
        </View>
        <View style={styles.tabBtnTextCol}>
          <Text style={[styles.tabBtnLabel, { color: active ? '#fff' : inactiveColor }]}>{label}</Text>
          <Text style={[styles.tabBtnSub, { color: active ? 'rgba(255,255,255,0.85)' : inactiveColor, opacity: active ? 1 : 0.7 }]}>{sub}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const TranscriptReviewScreen = ({ navigation }) => {
  const styles = useScaledStyles(createStyles);
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
  const language = useRecordingStore(state => state.language);
  const recognizerFellBack = useRecordingStore(
    state => state.recognizerFellBack,
  );
  const translation = useRecordingStore(state => state.translation);
  const setTranslationText = useRecordingStore(
    state => state.setTranslationText,
  );
  const multilingual = needsTranslation(language);
  const languageName = displayFor(language).englishName;
  const reportSourceKind = useRecordingStore(selectReportSourceKind);
  const englishInUse =
    reportSourceKind === REPORT_SOURCE_KIND.ENGLISH_TRANSLATION;
  const reportSourceLabel = englishInUse
    ? 'English translation'
    : 'Original (untranslated)';

  const [languageNoticeDismissed, setLanguageNoticeDismissed] = useState(false);
  const [viewedSource, setViewedSource] = useState(() =>
    canOffer({ nativeText: fullTranscript, anuvadini })
      ? TRANSCRIPT_SOURCE.ANUVADINI
      : selectedSource,
  );
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

    const pulse = Animated.loop(
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
    );
    pulse.start();
    return () => pulse.stop();
  }, [fadeAnim, slideAnim, pulseAnim]);

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

  useEffect(() => {
    if (!multilingual || anuvadini.status !== ANUVADINI_STATUS.READY) {
      return;
    }
    ensureTranslation().catch(() => {});
  }, [multilingual, anuvadini.status, anuvadini.updatedAt, selectedSource]);

  const handleRetryTranslation = useCallback(() => {
    ensureTranslation({ force: true }).catch(() => {});
  }, []);

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
      const text = selectReportTranscript(useRecordingStore.getState());
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
        selectReportTranscript(next),
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

  const wordCount = editableText
    ? editableText
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0).length
    : 0;

  return (
    <View style={styles.container}>
      {/* Decorative background blobs */}
      <View style={styles.blobContainer}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          {/* Header */}
          <View style={styles.headerRow}>
            <GlassBtn onPress={goBack} accessibilityLabel="Go back" styles={styles}>
              <Icon name="arrow-left" size={17} color="#6D4FFF" />
            </GlassBtn>
            <Text style={styles.headerTitle}>Transcript Review</Text>
            <View style={styles.glassBtn} />
          </View>

          {/* Hero band */}
          <LinearGradient
            colors={['#6D4FFF', '#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroBand}
          >
            <View style={styles.heroBlob1} />
            <View style={styles.heroBlob2} />
            <View style={styles.liveSessionBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live Session</Text>
            </View>
            <Text style={styles.heroTitle}>
              Review & Edit{'\n'}
              <Text style={styles.heroTitleLight}>Transcript</Text>
            </Text>
            <Text style={styles.heroDesc}>
              Compare transcriptions, then choose which the report is built from.
            </Text>
          </LinearGradient>

          {/* Stat cards */}
          <View style={styles.statCardsGrid}>
            <StatCard styles={styles}
              gradient={['#6D4FFF', '#818CF8']}
              shadowColor="#6D4FFF"
              icon={<Icon name="mic" size={16} color="#fff" />}
              label="Recording"
              value={formatDuration(durationSeconds)}
              sub="Total duration"
              subColor="#000000"
              badge="● REC"
              badgeColor="rgba(255,255,255,0.2)"
            />
            <StatCard styles={styles}
              gradient={['#EC4899', '#F97316']}
              shadowColor="#EC4899"
              icon={<Icon name="layers" size={16} color="#fff" />}
              label="Report Uses"
              value={
                multilingual
                  ? reportSourceLabel
                  : selectedSource === TRANSCRIPT_SOURCE.NATIVE
                  ? 'Original'
                  : 'AI Ver.'
              }
              sub="Active source"
              subColor="#000000"
              badge="ACTIVE"
              badgeColor="rgba(255,255,255,0.2)"
            />
          </View>

          {/* Tab switcher */}
          <View style={styles.tabSwitcher}>
            <TabBtn styles={styles}
              active={viewedSource === TRANSCRIPT_SOURCE.NATIVE}
              gradient={['#6D4FFF', '#A855F7']}
              shadow="#6D4FFF"
              onPress={() => showSource(TRANSCRIPT_SOURCE.NATIVE)}
              label="Original"
              sub={selectedSource === TRANSCRIPT_SOURCE.NATIVE ? '✓ For Report' : 'Dictated'}
              icon={<Icon name="check-circle" size={16} color={viewedSource === TRANSCRIPT_SOURCE.NATIVE ? '#fff' : (selectedSource === TRANSCRIPT_SOURCE.NATIVE ? '#6D4FFF' : '#C4BFDB')} />}
            />
            <TabBtn styles={styles}
              active={viewedSource === TRANSCRIPT_SOURCE.ANUVADINI}
              gradient={['#EC4899', '#F97316']}
              shadow="#EC4899"
              onPress={() => showSource(TRANSCRIPT_SOURCE.ANUVADINI)}
              label="AI Transcription"
              sub={selectedSource === TRANSCRIPT_SOURCE.ANUVADINI ? '✓ For Report' : 'Preview Only'}
              icon={<Icon name="zap" size={16} color={viewedSource === TRANSCRIPT_SOURCE.ANUVADINI ? '#fff' : '#C4BFDB'} />}
            />
          </View>

          {recognizerFellBack && !languageNoticeDismissed ? (
            <View style={styles.fallbackNotice}>
              <Text style={styles.fallbackText}>
                This device does not appear to have the {languageName} speech
                pack installed — recognition fell back to English. Install it
                from Settings › Google › Voice, or rely on AI transcription for
                this consultation.
              </Text>
              <Pressable
                onPress={() => setLanguageNoticeDismissed(true)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                hitSlop={8}
              >
                <Text style={styles.fallbackDismiss}>✕</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Fallback Notice */}
          {showFailureNotice ? (
            <View style={styles.fallbackNotice}>
              <Text style={styles.fallbackText}>
                {captureUnavailable
                  ? 'Microphone capture did not start for this dictation, so there was no audio to refine — continuing with the original transcription.'
                  : 'AI refinement could not be completed — continuing with the original transcription.'}
              </Text>
              <Pressable onPress={() => setDismissedAt(anuvadini.updatedAt)} hitSlop={8}>
                <Text style={styles.fallbackDismiss}>✕</Text>
              </Pressable>
            </View>
          ) : null}

          {/* AI Status */}
          {viewingAi && !aiReady && (
            <View style={styles.statusRow}>
              {anuvadini.status === ANUVADINI_STATUS.PENDING ? (
                <ActivityIndicator size="small" color="#6D4FFF" />
              ) : null}
              <Text style={styles.statusText}>{aiStatusLine()}</Text>
              {anuvadini.status === ANUVADINI_STATUS.FAILED && canRetryRefinement ? (
                <Pressable onPress={handleRetryRefinement}>
                  <Text style={styles.retry}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {/* Transcript panel */}
          <View style={styles.transcriptPanel}>
            <LinearGradient
              colors={viewedSource === TRANSCRIPT_SOURCE.NATIVE ? ['#6D4FFF', '#A855F7', '#818CF8'] : ['#EC4899', '#F97316', '#FBBF24']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.panelTopStripe}
            />
            
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderLeft}>
                <LinearGradient
                  colors={viewedSource === TRANSCRIPT_SOURCE.NATIVE ? ['#6D4FFF', '#A855F7'] : ['#EC4899', '#F97316']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.panelHeaderIconBg}
                >
                  <Icon name="file-text" size={15} color="#fff" />
                </LinearGradient>
                <View>
                  <Text style={styles.panelHeaderTitle}>
                    {viewedSource === TRANSCRIPT_SOURCE.NATIVE ? 'Original Transcript' : 'AI Transcript'}
                  </Text>
                  <Text style={styles.panelHeaderSub}>
                    {viewedSource === TRANSCRIPT_SOURCE.NATIVE ? 'Dictated recording' : 'AI-enhanced version'}
                  </Text>
                </View>
              </View>
              
              {selectedSource === viewedSource ? (
                <View style={[styles.useBadge, { backgroundColor: '#D1FAE5', borderColor: 'rgba(5,150,105,0.25)' }]}>
                  <Text style={[styles.useBadgeText, { color: '#059669' }]}>✓ For Report</Text>
                </View>
              ) : canSelectViewed ? (
                <Pressable onPress={() => selectForReport(viewedSource)}>
                  <LinearGradient
                    colors={viewedSource === TRANSCRIPT_SOURCE.NATIVE ? ['#6D4FFF', '#A855F7'] : ['#EC4899', '#F97316']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[styles.useBadge, { borderColor: 'transparent' }]}
                  >
                    <Text style={[styles.useBadgeText, { color: '#fff' }]}>Use This</Text>
                  </LinearGradient>
                </Pressable>
              ) : null}
            </View>

            <Animated.View style={{ opacity: editorFade }}>
              {viewingAi && !hasAiText && anuvadini.status !== ANUVADINI_STATUS.READY ? (
                anuvadini.status === ANUVADINI_STATUS.PENDING ? (
                  <View style={styles.pendingBlock}>
                    <ActivityIndicator size="small" color="#6D4FFF" />
                    <Text style={styles.pendingTitle}>Generating AI transcription…</Text>
                    <Text style={styles.pendingDetail}>This usually takes a few seconds. The original transcript is ready to use in the meantime.</Text>
                  </View>
                ) : (
                  <Text style={styles.placeholder}>
                    No AI transcription for this dictation. The original transcript is unaffected and can still generate the report.
                  </Text>
                )
              ) : (
                <TextInput
                  style={styles.panelEditor}
                  multiline
                  value={editableText}
                  onChangeText={setEditableText}
                  placeholder="Dictated text will appear here..."
                  placeholderTextColor="#9E9BB5"
                />
              )}
            </Animated.View>

            <View style={styles.panelFooter}>
              <View style={styles.wordCountRow}>
                <Icon name="activity" size={14} color={viewedSource === TRANSCRIPT_SOURCE.NATIVE ? '#6D4FFF' : '#EC4899'} />
                <Text style={styles.wordCountText}>{wordCount} words</Text>
              </View>
              <Pressable onPress={handleCopyTranscript} disabled={!editableText}>
                <LinearGradient
                  colors={viewedSource === TRANSCRIPT_SOURCE.NATIVE ? ['#EDE9FF', '#DDD5FF'] : ['#FCE7F3', '#FBCFE8']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.copyBtn}
                >
                  <Icon name={copied ? 'check' : 'copy'} size={13} color={viewedSource === TRANSCRIPT_SOURCE.NATIVE ? '#6D4FFF' : '#EC4899'} />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
 
          {multilingual ? (
            <View style={styles.transcriptPanel}>
              <LinearGradient
                colors={['#0EA5E9', '#14B8A6', '#34D399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.panelTopStripe}
              />

              <View style={styles.panelHeader}>
                <View style={styles.panelHeaderLeft}>
                  <LinearGradient
                    colors={['#0EA5E9', '#14B8A6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.panelHeaderIconBg}
                  >
                    <Icon name="globe" size={15} color="#fff" />
                  </LinearGradient>
                  <View>
                    <Text style={styles.panelHeaderTitle}>
                      English Translation
                    </Text>
                    <Text style={styles.panelHeaderSub}>
                      Translated from {languageName}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.useBadge,
                    englishInUse
                      ? {
                          backgroundColor: '#D1FAE5',
                          borderColor: 'rgba(5,150,105,0.25)',
                        }
                      : {
                          backgroundColor: '#FEF3C7',
                          borderColor: 'rgba(217,119,6,0.25)',
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.useBadgeText,
                      { color: englishInUse ? '#059669' : '#D97706' },
                    ]}
                  >
                    {englishInUse ? '✓ For Report' : 'Not used yet'}
                  </Text>
                </View>
              </View>

              {translation.status === TRANSLATION_STATUS.PENDING ? (
                <View style={styles.pendingBlock}>
                  <ActivityIndicator size="small" color="#0EA5E9" />
                  <Text style={styles.pendingTitle}>
                    Translating to English…
                  </Text>
                  <Text style={styles.pendingDetail}>
                    {translation.progress.total > 1
                      ? `Part ${translation.progress.done} of ${translation.progress.total}.`
                      : 'This usually takes a few seconds.'}
                  </Text>
                </View>
              ) : translation.text ? (
                <>
                  {translation.stale ? (
                    <Text style={styles.placeholder}>
                      This is an earlier translation — the most recent dictation
                      could not be translated (
                      {describeTranslationError(translation.error)}), so it is
                      not included below. Translate again, or edit the English
                      directly.
                    </Text>
                  ) : null}
                  <TextInput
                    style={styles.panelEditor}
                    multiline
                    value={translation.text}
                    onChangeText={setTranslationText}
                    placeholder="The English translation will appear here..."
                    placeholderTextColor="#9E9BB5"
                  />
                  {translation.stale ? (
                    <Pressable
                      onPress={handleRetryTranslation}
                      accessibilityRole="button"
                      accessibilityLabel="Translate again"
                    >
                      <Text style={styles.retry}>Translate again</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <View style={styles.pendingBlock}>
                  <Text style={styles.placeholder}>
                    {translation.status === TRANSLATION_STATUS.FAILED
                      ? `The English translation could not be produced (${describeTranslationError(
                          translation.error,
                        )}). The report will be built from the ${languageName} transcript, so most fields will need filling in by hand.`
                      : 'This dictation has not been translated yet. It is translated to English before the report is generated.'}
                  </Text>
                  {translation.error === ERROR_KIND.QUOTA_EXCEEDED ? (
                    <Text style={styles.pendingDetail}>
                      Translation is unavailable for the rest of this session.
                    </Text>
                  ) : (
                    <Pressable
                      onPress={handleRetryTranslation}
                      accessibilityRole="button"
                      accessibilityLabel="Translate again"
                    >
                      <Text style={styles.retry}>Translate again</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ) : null}

          {/* Action buttons */}
          <View style={styles.actionsContainer}>
            <Pressable
              style={({ pressed }) => [styles.addMoreBtn, pressed && styles.pressed, submitting && styles.disabled]}
              onPress={handleAddMoreSpeech}
              disabled={submitting}
            >
              <LinearGradient colors={['#6D4FFF', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addMoreIconBg}>
                <Icon name="plus" size={16} color="#fff" />
              </LinearGradient>
              <Text style={styles.addMoreText}>Add More Speech</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [pressed && styles.pressed, submitting && styles.disabled]}
              onPress={handleGenerateReport}
              disabled={submitting}
            >
              <LinearGradient colors={['#6D4FFF', '#8B5CF6', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.generateBtn}>
                <View style={styles.generateBtnShimmer} />
                <Icon name="file-text" size={18} color="#fff" />
                <Text style={styles.generateText}>Generate Report</Text>
                <View style={styles.generateArrowBox}>
                  <Icon name="arrow-right" size={16} color="#fff" />
                </View>
              </LinearGradient>
            </Pressable>
          </View>
          
          <TranscriptDiffView original={nativeRaw} revised={anuvadini.raw} />
          
        </Animated.View>
      </ScrollView>

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
    </View>
  );
};

export default TranscriptReviewScreen;
