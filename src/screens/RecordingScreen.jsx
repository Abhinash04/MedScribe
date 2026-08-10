import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Text, View } from 'react-native';
import AppHeader from '../components/AppHeader';
import ListeningVisualizer from '../components/ListeningVisualizer';
import PermissionGate from '../components/PermissionGate';
import RecordingControls from '../components/RecordingControls';
import ScreenContainer from '../components/ScreenContainer';
import SectionTitle from '../components/SectionTitle';
import TranscriptView from '../components/TranscriptView';
import LiveFieldsPreview from '../components/LiveFieldsPreview';
import RefiningOverlay from '../components/RefiningOverlay';
import SessionRecoveryModal from '../components/SessionRecoveryModal';
import { RECORDING_STATE } from '../constants/recordingStates';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import useRecordingStore from '../store/useRecordingStore';
import { CAPTURE_OUTCOME } from '../services/captureOutcome';
import { ANUVADINI_STATUS } from '../services/consultationTranscripts';
import {
  getActiveSession,
  clearActiveSession,
} from '../services/sessionPersistenceService';
import { colors, typography } from '../theme';
import styles from './styles/RecordingScreen.styles';

const HEADLINE = {
  [RECORDING_STATE.IDLE]: {
    title: 'Ready to Dictate',
    subtitle: 'Tap Start dictation when you are ready to speak.',
  },
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
  return `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;
}

const RecordingScreen = ({ navigation, route }) => {
  const resumeRequested = route?.params?.resume === true;
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
  const anuvadiniStatus = useRecordingStore(state => state.anuvadini.status);
  const refineProgress = useRecordingStore(state => state.refineProgress);

  const [awaitingRefinement, setAwaitingRefinement] = useState(false);

  const probedRef = useRef(false);

  useEffect(() => {
    if (probedRef.current) {
      return;
    }
    probedRef.current = true;

    if (resumeRequested) {
      return;
    }

    let cancelled = false;

    (async () => {
      const active = await getActiveSession();
      if (cancelled) {
        return;
      }
      const isOwnAutosave =
        active?.id === useRecordingStore.getState().sessionId;
      if (active?.segments?.length > 0 && !isOwnAutosave) {
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

  const handleContinueToReview = useCallback(() => {
    navigation.navigate('TranscriptReview');
  }, [navigation]);

  const handleTapStop = useCallback(async () => {
    const outcome = await stop();
    if (outcome === CAPTURE_OUTCOME.REFINE) {
      setAwaitingRefinement(true);
      return;
    }
    navigation.navigate('TranscriptReview');
  }, [stop, navigation]);

  const handleSkipRefinement = useCallback(() => {
    setAwaitingRefinement(false);
    navigation.navigate('TranscriptReview');
  }, [navigation]);

  useEffect(() => {
    if (!awaitingRefinement || anuvadiniStatus === ANUVADINI_STATUS.PENDING) {
      return;
    }
    setAwaitingRefinement(false);
    navigation.navigate('TranscriptReview');
  }, [awaitingRefinement, anuvadiniStatus, navigation]);

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
  const isIdle = status === RECORDING_STATE.IDLE;
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
                : isIdle
                ? 'Ready'
                : 'Stopped'}
            </Text>
          </View>
          <Text style={styles.timerText}>
            {formatDuration(durationSeconds)}
          </Text>
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

      <LiveFieldsPreview
        fields={liveExtractedFields}
        style={styles.livePreview}
      />

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
          onStart={resumeDictation}
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

      <RefiningOverlay
        visible={awaitingRefinement}
        onSkip={handleSkipRefinement}
        progress={refineProgress}
      />

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

export default RecordingScreen;
