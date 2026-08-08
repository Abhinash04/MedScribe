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
  Animated,
  Easing,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

import ScreenContainer from '../components/ScreenContainer';
import MissingFieldsModal from '../components/MissingFieldsModal';
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
import dictationSessionManager from '../services/dictationSessionManager';
import { extractForReport } from '../services/extractionService';
import { validateReportCompleteness } from '../services/reportCompleteness';
import { mergeExtraction, toDraft } from '../services/reportDraft';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
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

    // Pulse animation for waveform
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
      ])
    ).start();

    // Float animation for illustration
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
      ])
    ).start();
  }, [fadeAnim, slideAnim, pulseAnim, floatAnim]);

  const beginSubmit = useCallback(() => {
    if (submittingRef.current) return false;
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
  const handleResumeRecording = useCallback(() => {
    commitEditor(editableText);
    setStage(CONSULTATION_STAGE.RECORDING);
    dictationSessionManager.persistCurrentSession();
    navigation.navigate('Recording', { resume: true });
  }, [navigation, editableText, commitEditor, setStage]);

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

  const selectForReport = useCallback(
    source => {
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
    if (!beginSubmit()) return;
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
    if (!isTranscriptionAvailable()) return 'Not configured in this build';
    switch (anuvadini.status) {
      case ANUVADINI_STATUS.PENDING:
        return 'Generating…';
      case ANUVADINI_STATUS.READY:
        return aiReady ? 'Ready' : 'Same as original';
      case ANUVADINI_STATUS.FAILED:
        return anuvadini.error === ERROR_KIND.AUDIO_TOO_LARGE
          ? 'Recording too long to process'
          : 'Unable to generate';
      default:
        return 'Not available for this dictation';
    }
  };

  const canSelectViewed = viewingAi ? aiReady : true;
  const viewedIsSelected = viewedSource === selectedSource;

  const wordCount = editableText ? editableText.trim().split(/\s+/).filter(w => w.length > 0).length : 0;

  return (
    <ScreenContainer style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Icon name="arrow-left" size={20} color="#0F172A" />
        </Pressable>
        <Text style={styles.appBarTitle}>Transcript Review</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], flex: 1 }}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroLeft}>
              <View style={styles.heroLabelRow}>
                {/* <View style={styles.heroLine} /> */}
                {/* <Text style={styles.heroLabel}>ONE LAST CHECK</Text> */}
              </View>
              <Text style={styles.heroTitle}>Review & Edit{'\n'}Transcript</Text>
              <Text style={styles.heroSubtitle}>
                Compare both transcriptions, then choose which one the report is built from.
              </Text>
            </View>
            
            <View style={styles.heroRight}>
              <Animated.View style={styles.illustrationContainer}>
                {/* Background Blobs */}
                <View style={[styles.blob, styles.blobBlue]} />
                <View style={[styles.blob, styles.blobLavender]} />
                
                {/* Icons */}
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

          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <View style={[styles.iconCircle, { backgroundColor: '#F0F5FF' }]}>
                <Icon name="clock" size={18} color="#2F6BFF" />
              </View>
              <View style={styles.summaryTextCol}>
                <Text style={styles.summaryTitle}>Recording Time</Text>
                <Text style={styles.summaryValue}>{formatDuration(durationSeconds)}</Text>
              </View>
            </View>
            <View style={styles.summaryCard}>
              <View style={[styles.iconCircle, { backgroundColor: '#F3E8FF' }]}>
                <Icon name="layers" size={18} color="#8B5CF6" />
              </View>
              <View style={styles.summaryTextCol}>
                <Text style={styles.summaryTitle}>Report Uses</Text>
                <Text style={styles.summaryValue}>{LABEL[selectedSource]}</Text>
              </View>
            </View>
          </View>

          {/* Transcript Selector */}
          <View style={styles.segmentContainer}>
            {[TRANSCRIPT_SOURCE.NATIVE, TRANSCRIPT_SOURCE.ANUVADINI].map(source => {
              const isSelectedTab = viewedSource === source;
              const isUsed = selectedSource === source;
              return (
                <Pressable
                  key={source}
                  style={[styles.segmentTab, isSelectedTab && styles.segmentTabActive]}
                  onPress={() => showSource(source)}
                >
                  <View style={styles.segmentTabHeader}>
                    {source === TRANSCRIPT_SOURCE.ANUVADINI && !isSelectedTab && (
                      <Icon name="star" size={14} color="#8B5CF6" style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.segmentTabText, isSelectedTab && styles.segmentTabTextActive]}>
                      {LABEL[source]}
                    </Text>
                  </View>
                  {isUsed && (
                    <Text style={[styles.inUseText, isSelectedTab && styles.inUseTextActive]}>
                      IN USE
                    </Text>
                  )}
                  {isUsed && isSelectedTab && (
                    <View style={styles.checkBadge}>
                      <Icon name="check" size={12} color="#2F6BFF" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {viewingAi && anuvadini.status !== ANUVADINI_STATUS.READY && (
            <View style={styles.statusRow}>
              {anuvadini.status === ANUVADINI_STATUS.PENDING ? (
                <ActivityIndicator size="small" color="#2F6BFF" />
              ) : null}
              <Text style={styles.statusText}>{aiStatusLine()}</Text>
              {anuvadini.status === ANUVADINI_STATUS.FAILED ? (
                <Pressable onPress={handleRetryRefinement} accessibilityRole="button">
                  <Text style={styles.retry}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {/* Transcript Card */}
          <View style={styles.editorCard}>
            <View style={styles.editorHeader}>
              <View style={styles.editorHeaderLeft}>
                <Icon name="file-text" size={16} color="#2F6BFF" />
                <Text style={styles.editorHeaderTitle}>
                  {viewingAi ? 'AI Transcription' : 'Original Transcription'}
                </Text>
              </View>
              {viewedIsSelected && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>Selected</Text>
                </View>
              )}
            </View>

            {viewingAi && !hasAiText ? (
              <Text style={styles.placeholder}>
                {anuvadini.status === ANUVADINI_STATUS.PENDING
                  ? 'The AI transcription is still being generated. The original transcript is ready to use in the meantime.'
                  : 'No AI transcription for this dictation. The original transcript is unaffected and can still generate the report.'}
              </Text>
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

            <View style={styles.editorToolbar}>
              <View style={styles.toolbarLeft}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Icon name="activity" size={16} color="#2F6BFF" />
                </Animated.View>
                <Text style={styles.wordCount}>{wordCount} words</Text>
              </View>
              <View style={styles.toolbarRight}>
                <Pressable style={styles.toolbarIcon}>
                  <Icon name="copy" size={18} color="#2F6BFF" />
                </Pressable>
                <Pressable style={styles.toolbarIcon}>
                  <Icon name="edit-2" size={18} color="#2F6BFF" />
                </Pressable>
              </View>
            </View>
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
    backgroundColor: '#FAFCFF',
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 24,
  },
  heroLeft: {
    flex: 1,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLine: {
    width: 24,
    height: 2,
    backgroundColor: '#2F6BFF',
    marginRight: 8,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2F6BFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 44,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
    maxWidth: '90%',
  },
  heroRight: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blob: {
    position: 'absolute',
    borderRadius: 40,
    opacity: 0.4,
  },
  blobBlue: {
    width: 70,
    height: 70,
    backgroundColor: '#E0E7FF',
    top: -5,
    left: -5,
  },
  blobLavender: {
    width: 50,
    height: 50,
    backgroundColor: '#F3E8FF',
    bottom: -5,
    right: -10,
  },
  illusDoc: {
    width: 48,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    zIndex: 2,
  },
  illusSparkle: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  illusWave: {
    position: 'absolute',
    bottom: 2,
    left: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 4,
    zIndex: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    marginHorizontal: -16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 35,
    elevation: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryTextCol: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5FA',
    borderRadius: 999,
    padding: 6,
    marginBottom: 24,
    marginHorizontal: -16,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentTabActive: {
    backgroundColor: '#2F6BFF',
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  segmentTabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTabTextActive: {
    color: '#FFFFFF',
  },
  inUseText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  inUseTextActive: {
    color: '#E0E7FF',
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  retry: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  editorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 35,
    elevation: 3,
    marginBottom: 24,
    marginHorizontal: -16,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F7FAFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
  },
  editorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editorHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectedBadge: {
    backgroundColor: '#34D399',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  placeholder: {
    padding: 24,
    fontSize: 16,
    lineHeight: 28,
    color: '#94A3B8',
    minHeight: 200,
  },
  editorInput: {
    padding: 24,
    fontSize: 16,
    lineHeight: 28,
    color: '#1E293B',
    minHeight: 200,
    textAlignVertical: 'top',
  },
  editorToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toolbarIcon: {
    padding: 4,
  },
  useBtn: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 3,
    marginBottom: 24,
  },
  useBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 16,
    backgroundColor: '#FAFCFF',
    gap: 16,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2F6BFF',
    gap: 8,
  },
  addMoreBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2F6BFF',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2F6BFF',
    paddingHorizontal: 24,
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.22,
    shadowRadius: 40,
    elevation: 8,
  },
  generateBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  generateBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  generateBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default TranscriptReviewScreen;
