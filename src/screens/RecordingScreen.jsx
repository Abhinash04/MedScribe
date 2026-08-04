import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppHeader from '../components/AppHeader';
import ListeningVisualizer from '../components/ListeningVisualizer';
import PermissionGate from '../components/PermissionGate';
import RecordingControls from '../components/RecordingControls';
import ScreenContainer from '../components/ScreenContainer';
import SectionTitle from '../components/SectionTitle';
import TranscriptView from '../components/TranscriptView';
import LiveFieldsPreview from '../components/LiveFieldsPreview';
import StopConfirmationModal from '../components/StopConfirmationModal';
import SessionRecoveryModal from '../components/SessionRecoveryModal';
import { RECORDING_STATE } from '../constants/recordingStates';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import useRecordingStore from '../store/useRecordingStore';
import { getActiveSession, clearActiveSession } from '../services/sessionPersistenceService';
import { colors, spacing, typography } from '../theme';

const HEADLINE = {
  [RECORDING_STATE.CHECKING_PERMISSION]: {
    title: 'Preparing microphone',
    subtitle: 'Checking microphone access…',
  },
  [RECORDING_STATE.LISTENING]: {
    title: 'Listening...',
    subtitle: 'Speak clearly into your device microphone.',
  },
  [RECORDING_STATE.PAUSED]: {
    title: 'Dictation Paused',
    subtitle: 'Tap Resume to continue recording without losing progress.',
  },
  [RECORDING_STATE.PROCESSING]: {
    title: 'Processing...',
    subtitle: 'Finalizing your dictation.',
  },
  [RECORDING_STATE.SUCCESS]: {
    title: 'Dictation Complete',
    subtitle: 'Review the transcript before generating report.',
  },
  [RECORDING_STATE.ERROR]: {
    title: 'Recognition Stopped',
    subtitle: '',
  },
};

const PERMISSION_STATES = [
  RECORDING_STATE.PERMISSION_DENIED,
  RECORDING_STATE.PERMISSION_BLOCKED,
  RECORDING_STATE.UNAVAILABLE,
];

function formatDuration(totalSeconds = 0) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const RecordingScreen = ({ navigation, route }) => {
  const resumeRequested = route?.params?.resume === true;

  // Recovery is answered before the recognizer is allowed to start. Starting
  // first would run beginSession's reset() against the very transcript being
  // restored, and whichever won the race would decide whether the doctor keeps
  // their dictation.
  const [recoveryState, setRecoveryState] = useState(
    resumeRequested ? 'settled' : 'checking',
  );
  const [recoveredSessionData, setRecoveredSessionData] = useState(null);
  const [restoredTranscript, setRestoredTranscript] = useState(false);

  const {
    status,
    transcript,
    partialText,
    errorMessage,
    durationSeconds,
    liveExtractedFields,
    isPaused,
    pause,
    resume,
    resumeDictation,
    stop,
    retry,
    openAppSettings,
  } = useSpeechRecognition({
    autoStart: recoveryState === 'settled',
    keepTranscript: restoredTranscript || resumeRequested,
  });

  const restoreSession = useRecordingStore(state => state.restoreSession);

  const [showStopModal, setShowStopModal] = useState(false);

  // Check for an interrupted session before the first start.
  useEffect(() => {
    if (resumeRequested) {
      return;
    }

    let cancelled = false;

    (async () => {
      const active = await getActiveSession();
      if (cancelled) {
        return;
      }
      if (active?.segments?.length > 0) {
        setRecoveredSessionData(active);
        setRecoveryState('prompting');
      } else {
        setRecoveryState('settled');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resumeRequested]);

  const handleRestoreSession = useCallback(() => {
    if (recoveredSessionData) {
      restoreSession(recoveredSessionData);
      setRestoredTranscript(true);
    }
    setRecoveredSessionData(null);
    setRecoveryState('settled');
  }, [recoveredSessionData, restoreSession]);

  const handleDiscardRecovery = useCallback(async () => {
    if (recoveredSessionData) {
      await clearActiveSession(recoveredSessionData.id);
    }
    setRecoveredSessionData(null);
    setRecoveryState('settled');
  }, [recoveredSessionData]);

  // Coming back from the transcript review to add more. The screen is still
  // mounted and already settled, so the session has to be told explicitly.
  useEffect(() => {
    if (!resumeRequested) {
      return;
    }
    navigation.setParams({ resume: false });
    resumeDictation();
  }, [resumeRequested, resumeDictation, navigation]);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  /**
   * Hand off to Transcript Review step.
   */
  const handleContinueToReview = useCallback(() => {
    navigation.navigate('TranscriptReview');
  }, [navigation]);

  const handleTapStop = useCallback(() => {
    setShowStopModal(true);
  }, []);

  const handleConfirmStop = useCallback(async () => {
    setShowStopModal(false);
    await stop();
    navigation.navigate('TranscriptReview');
  }, [stop, navigation]);

  const handleBackPress = useCallback(async () => {
    await stop();
    goBack();
  }, [stop, goBack]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleBackPress();
        return true;
      },
    );

    return () => subscription.remove();
  }, [handleBackPress]);

  if (PERMISSION_STATES.includes(status)) {
    return (
      <ScreenContainer style={styles.container}>
        <AppHeader showBack onBackPress={goBack} title="" />
        <PermissionGate
          status={status}
          onRequestPermission={retry}
          onOpenSettings={openAppSettings}
          onCancel={goBack}
        />
      </ScreenContainer>
    );
  }

  const headline = HEADLINE[status] ?? HEADLINE[RECORDING_STATE.LISTENING];
  const isChecking = status === RECORDING_STATE.CHECKING_PERMISSION;
  const isListening = status === RECORDING_STATE.LISTENING;
  const isProcessing = status === RECORDING_STATE.PROCESSING;
  const isError = status === RECORDING_STATE.ERROR;
  const showTranscript =
    !isChecking && (!!transcript || !!partialText || isListening || isPaused);

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.headerBar}>
        <AppHeader showBack onBackPress={handleBackPress} title="" />
        <View style={styles.headerRight}>
          <View
            style={[
              styles.statusPill,
              isListening && styles.statusPillListening,
              isPaused && styles.statusPillPaused,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                isListening && styles.dotListening,
                isPaused && styles.dotPaused,
              ]}
            />
            <Text style={styles.statusText}>
              {isListening
                ? 'Listening'
                : isPaused
                ? 'Paused'
                : isProcessing
                ? 'Processing'
                : 'Stopped'}
            </Text>
          </View>
          <Text style={styles.timerText}>{formatDuration(durationSeconds)}</Text>
        </View>
      </View>

      <View style={styles.centerSection}>
        <SectionTitle
          title={headline.title}
          subtitle={isError ? errorMessage : headline.subtitle}
        />

        {isChecking ? (
          <ActivityIndicator
            size="large"
            color={colors.secondaryAccent}
            style={styles.spinner}
          />
        ) : null}

        {!isChecking && !isError ? (
          <ListeningVisualizer isActive={isListening} isPaused={isPaused} />
        ) : null}

        {isProcessing ? (
          <ActivityIndicator
            size="small"
            color={colors.secondaryAccent}
            style={styles.spinner}
          />
        ) : null}
      </View>

      {/* Live Extracted Fields Preview */}
      <LiveFieldsPreview fields={liveExtractedFields} style={styles.livePreview} />

      {showTranscript ? (
        <TranscriptView
          finalText={transcript}
          partialText={partialText}
          style={styles.transcript}
        />
      ) : null}

      <View style={styles.footer}>
        <RecordingControls
          status={status}
          hasTranscript={!!transcript}
          onPause={pause}
          onResume={resume}
          onStop={handleTapStop}
          onRestart={retry}
          onRetry={retry}
          onContinue={handleContinueToReview}
        />

        {isListening ? (
          <View style={styles.hintRow}>
            <View style={styles.pulseDot} />
            <Text style={[typography.smallCaption, styles.hintText]}>
              Pause freely — recording continues until you tap stop.
            </Text>
          </View>
        ) : isPaused ? (
          <View style={styles.hintRow}>
            <Text style={[typography.smallCaption, styles.hintText]}>
              Dictation paused. Tap Resume to continue recording.
            </Text>
          </View>
        ) : null}
      </View>

      {/* Stop Confirmation Dialog */}
      <StopConfirmationModal
        visible={showStopModal}
        onCancel={() => setShowStopModal(false)}
        onConfirm={handleConfirmStop}
      />

      {/* Crash Recovery Dialog */}
      <SessionRecoveryModal
        visible={recoveryState === 'prompting'}
        onRestore={handleRestoreSession}
        onDiscard={handleDiscardRecovery}
        savedTime={
          recoveredSessionData?.updatedAt
            ? new Date(recoveredSessionData.updatedAt).toLocaleTimeString()
            : ''
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  statusPillListening: {
    borderColor: colors.primaryAccent,
  },
  statusPillPaused: {
    borderColor: colors.secondaryAccent,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  dotListening: {
    backgroundColor: colors.primaryAccent,
  },
  dotPaused: {
    backgroundColor: colors.secondaryAccent,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryAccent,
    fontVariant: ['tabular-nums'],
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  spinner: {
    marginTop: spacing.lg,
  },
  livePreview: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  transcript: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  footer: {
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondaryAccent,
  },
  hintText: {
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0.3,
  },
});

export default RecordingScreen;
