import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import ScreenContainer from '../components/ScreenContainer';
import { requestOverlayPermission } from '../services/dictationOverlayService';
import {
  RESULTS,
  checkMicPermission,
  isGranted,
  openAppSettings,
  requestMicPermission,
} from '../services/permissionService';
import useSettingsStore from '../store/useSettingsStore';
import { colors } from '../theme';
import styles from './styles/OverlayOnboardingScreen.styles';

const STEP = {
  MICROPHONE: 'microphone',
  OVERLAY: 'overlay',
};

const MIC_BENEFITS = [
  {
    icon: 'mic',
    title: 'Record the consultation',
    body: 'MedScribe needs the microphone to capture what you dictate.',
  },
  {
    icon: 'file-text',
    title: 'Turned into a report',
    body: 'Speech becomes a structured clinical note you can review and edit.',
  },
  {
    icon: 'lock',
    title: 'Only while you dictate',
    body: 'The microphone is used during a session and released when you stop.',
  },
];

const BENEFITS = [
  {
    icon: 'mic',
    title: 'Dictate from any screen',
    body: 'Start a consultation without opening MedScribe first.',
  },
  {
    icon: 'move',
    title: 'Stays out of the way',
    body: 'A small bubble you can drag anywhere and tap when you need it.',
  },
  {
    icon: 'shield',
    title: 'Nothing else changes',
    body: 'The same transcription, review and report you use today.',
  },
];

const OverlayOnboardingScreen = ({ navigation }) => {
  const setBubbleEnabled = useSettingsStore(state => state.setBubbleEnabled);
  const markOnboardingSeen = useSettingsStore(state => state.markOnboardingSeen);
  const [requesting, setRequesting] = useState(false);
  const [step, setStep] = useState(STEP.MICROPHONE);
  const [micBlocked, setMicBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkMicPermission()
      .then(result => {
        if (!cancelled && isGranted(result)) {
          setStep(STEP.OVERLAY);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const goToDashboard = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [navigation]);

  const handleGrantMicrophone = useCallback(async () => {
    setRequesting(true);
    try {
      const result = await requestMicPermission();
      if (isGranted(result)) {
        setMicBlocked(false);
        setStep(STEP.OVERLAY);
      } else {
        setMicBlocked(result === RESULTS.BLOCKED);
      }
    } catch {
      setMicBlocked(false);
    }
    setRequesting(false);
  }, []);

  const handleEnable = useCallback(async () => {
    setRequesting(true);
    await markOnboardingSeen();
    const granted = await requestOverlayPermission();
    if (granted) {
      await setBubbleEnabled(true);
    }
    setRequesting(false);
    goToDashboard();
  }, [markOnboardingSeen, setBubbleEnabled, goToDashboard]);

  const handleSkip = useCallback(async () => {
    await markOnboardingSeen();
    goToDashboard();
  }, [markOnboardingSeen, goToDashboard]);

  const onMicrophoneStep = step === STEP.MICROPHONE;

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.hero}>
        <Image
          source={require('../assets/MedScribe_Logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>
          {onMicrophoneStep ? 'Allow the microphone' : 'Dictate from anywhere'}
        </Text>
        <Text style={styles.subtitle}>
          {onMicrophoneStep
            ? 'Dictation cannot record without microphone access. This is the one permission MedScribe genuinely needs.'
            : 'MedScribe can show a floating button over your other apps so a consultation is always one tap away.'}
        </Text>
      </View>

      <View style={styles.benefits}>
        {(onMicrophoneStep ? MIC_BENEFITS : BENEFITS).map(benefit => (
          <View key={benefit.title} style={styles.benefitRow}>
            <View style={styles.benefitIcon}>
              <Icon name={benefit.icon} size={18} color={colors.primaryAccent} />
            </View>
            <View style={styles.benefitBody}>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitText}>{benefit.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        {onMicrophoneStep
          ? micBlocked
            ? 'Microphone access is blocked. Open Settings, then allow the microphone for MedScribe.'
            : 'You can revoke this at any time in Android Settings.'
          : 'Android calls this "Display over other apps". You can turn it off at any time in Settings.'}
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            requesting && styles.disabled,
          ]}
          onPress={
            onMicrophoneStep
              ? micBlocked
                ? openAppSettings
                : handleGrantMicrophone
              : handleEnable
          }
          disabled={requesting}
          accessibilityRole="button"
          accessibilityLabel={
            onMicrophoneStep
              ? 'Allow microphone access'
              : 'Enable the floating bubble'
          }
        >
          <Text style={styles.primaryText}>
            {requesting
              ? 'Opening settings…'
              : onMicrophoneStep
                ? micBlocked
                  ? 'Open Settings'
                  : 'Allow microphone'
                : 'Enable floating bubble'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.skipButton,
            pressed && styles.pressed,
            requesting && styles.disabled,
          ]}
          onPress={handleSkip}
          disabled={requesting}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text style={styles.skipText}>Not now</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
};

export default OverlayOnboardingScreen;
