import React, { useCallback, useEffect } from 'react';
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
import { RECORDING_STATE } from '../constants/recordingStates';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
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
  [RECORDING_STATE.PROCESSING]: {
    title: 'Processing...',
    subtitle: 'Finalizing your dictation.',
  },
  [RECORDING_STATE.SUCCESS]: {
    title: 'Dictation complete',
    subtitle: 'Review the transcript below.',
  },
  [RECORDING_STATE.ERROR]: {
    title: 'Recognition stopped',
    subtitle: '',
  },
};

const PERMISSION_STATES = [
  RECORDING_STATE.PERMISSION_DENIED,
  RECORDING_STATE.PERMISSION_BLOCKED,
  RECORDING_STATE.UNAVAILABLE,
];

/**
 * Recording interface (SRS FR-2, FR-3, FR-4, NFR-4).
 *
 * Owns the entire dictation flow: this screen requests microphone permission
 * on mount, so HomeScreen stays presentational and every permission outcome
 * is handled in one place.
 */
const RecordingScreen = ({ navigation }) => {
  const {
    status,
    transcript,
    partialText,
    errorMessage,
    stop,
    retry,
    openAppSettings,
  } = useSpeechRecognition();

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  /**
   * Hand off to extraction + report preview (FR-5 to FR-8). The transcript is
   * already in the recording store, so nothing needs passing as a param.
   */
  const handleContinue = useCallback(() => {
    navigation.navigate('Report');
  }, [navigation]);

  const handleBackPress = useCallback(async () => {
    // Release the recognizer before unmounting; the hook's cleanup also
    // destroys it, but stopping first avoids a trailing error event.
    await stop();
    goBack();
  }, [stop, goBack]);

  /**
   * Route the hardware/gesture back through the same teardown as the header
   * arrow. Without this the press can fall through to the default activity
   * finish while the recognizer is still live, which tears down the React root
   * and leaves a blank screen with "Dropping event due to root view being
   * removed" in logcat.
   */
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleBackPress();
        return true; // consumed — never fall through to the default handler
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
    !isChecking && (!!transcript || !!partialText || isListening);

  return (
    <ScreenContainer style={styles.container}>
      <AppHeader showBack onBackPress={handleBackPress} title="" />

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
          <ListeningVisualizer isActive={isListening} />
        ) : null}

        {isProcessing ? (
          <ActivityIndicator
            size="small"
            color={colors.secondaryAccent}
            style={styles.spinner}
          />
        ) : null}
      </View>

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
          onStop={stop}
          onRestart={retry}
          onRetry={retry}
          onContinue={handleContinue}
        />

        {isListening ? (
          <View style={styles.hintRow}>
            <View style={styles.pulseDot} />
            <Text style={[typography.smallCaption, styles.hintText]}>
              Pause freely — recording continues until you tap stop.
            </Text>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
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
