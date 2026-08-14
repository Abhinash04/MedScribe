import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Pressable, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import LanguagePickerModal from '../components/LanguagePickerModal';
import ScreenContainer from '../components/ScreenContainer';
import { displayFor } from '../constants/languages';
import {
  getOverlayDiagnostics,
  requestOverlayPermission,
} from '../services/dictationOverlayService';
import { capabilityList } from '../services/languageCapabilities';
import {
  OVERLAY_STATE,
  guidanceFor,
  resolveOverlayState,
} from '../services/overlayRestriction';
import {
  RESULTS,
  checkMicPermission,
  isGranted,
  openAppSettings,
  requestMicPermission,
} from '../services/permissionService';
import { saveBubbleEnablePending } from '../services/settingsService';
import useSettingsStore from '../store/useSettingsStore';
import { colors } from '../theme';
import styles from './styles/OverlayOnboardingScreen.styles';

const STEP = {
  LANGUAGE: 'language',
  MICROPHONE: 'microphone',
  OVERLAY: 'overlay',
};

const LANGUAGE_BENEFITS = [
  {
    icon: 'globe',
    title: 'Dictate in your language',
    body: 'MedScribe recognises 24 Indian languages, including English.',
  },
  {
    icon: 'file-text',
    title: 'Reports stay in English',
    body: 'Whatever you dictate is translated so the report reads in English.',
  },
  {
    icon: 'settings',
    title: 'Change it whenever',
    body: 'You can switch languages later from Settings.',
  },
];

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
  const dictationLanguage = useSettingsStore(state => state.dictationLanguage);
  const setDictationLanguage = useSettingsStore(
    state => state.setDictationLanguage,
  );
  const deviceLocales = useSettingsStore(
    state => state.deviceRecognizerLocales,
  );
  const [requesting, setRequesting] = useState(false);
  const [step, setStep] = useState(STEP.LANGUAGE);
  const [micBlocked, setMicBlocked] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [micGrantedAlready, setMicGrantedAlready] = useState(false);
  const awaitingGrantRef = useRef(false);

  const language = displayFor(dictationLanguage);

  useEffect(() => {
    let cancelled = false;

    const syncMicPermission = () => {
      checkMicPermission()
        .then(result => {
          if (cancelled || !isGranted(result)) {
            return;
          }
          setMicGrantedAlready(true);
          setMicBlocked(false);
          setStep(current =>
            current === STEP.MICROPHONE ? STEP.OVERLAY : current,
          );
        })
        .catch(() => {});
    };

    syncMicPermission();
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') {
        return;
      }
      syncMicPermission();
      if (awaitingGrantRef.current) {
        awaitingGrantRef.current = false;
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [navigation]);

  const goToDashboard = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [navigation]);

  const handleSelectLanguage = useCallback(
    async code => {
      setPickerOpen(false);
      if (code !== dictationLanguage) {
        await setDictationLanguage(code);
      }
    },
    [dictationLanguage, setDictationLanguage],
  );

  const handleLanguageContinue = useCallback(() => {
    setStep(micGrantedAlready ? STEP.OVERLAY : STEP.MICROPHONE);
  }, [micGrantedAlready]);

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
    try {
      await markOnboardingSeen();
      await saveBubbleEnablePending(true);

      if (await requestOverlayPermission()) {
        await setBubbleEnabled(true);
        await saveBubbleEnablePending(false);
        goToDashboard();
        return;
      }

      const state = resolveOverlayState(getOverlayDiagnostics());
      if (state === OVERLAY_STATE.RESTRICTED_SETTINGS) {
        const guidance = guidanceFor(state);
        Alert.alert(guidance.title, guidance.body, [
          { text: 'Later', style: 'cancel', onPress: goToDashboard },
          { text: 'Open settings', onPress: openAppSettings },
        ]);
        return;
      }
      awaitingGrantRef.current = true;
    } finally {
      setRequesting(false);
    }
  }, [markOnboardingSeen, setBubbleEnabled, goToDashboard]);

  const handleSkip = useCallback(async () => {
    await markOnboardingSeen();
    goToDashboard();
  }, [markOnboardingSeen, goToDashboard]);

  const onLanguageStep = step === STEP.LANGUAGE;
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
          {onLanguageStep
            ? 'Choose your language'
            : onMicrophoneStep
            ? 'Allow the microphone'
            : 'Dictate from anywhere'}
        </Text>
        <Text style={styles.subtitle}>
          {onLanguageStep
            ? 'Pick the language you will dictate in. MedScribe transcribes in that language and writes the report in English.'
            : onMicrophoneStep
            ? 'Dictation cannot record without microphone access. This is the one permission MedScribe genuinely needs.'
            : 'MedScribe can show a floating button over your other apps so a consultation is always one tap away.'}
        </Text>
      </View>

      {onLanguageStep ? (
        <Pressable
          style={({ pressed }) => [styles.benefitRow, pressed && styles.pressed]}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose dictation language"
          accessibilityHint="Opens the list of supported languages"
        >
          <View style={styles.benefitIcon}>
            <Icon name="globe" size={18} color={colors.primaryAccent} />
          </View>
          <View style={styles.benefitBody}>
            <Text style={styles.benefitTitle}>
              {language.nativeName} · {language.tag}
            </Text>
            <Text style={styles.benefitText}>Tap to choose another language</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <View style={styles.benefits}>
        {(onLanguageStep
          ? LANGUAGE_BENEFITS
          : onMicrophoneStep
          ? MIC_BENEFITS
          : BENEFITS
        ).map(benefit => (
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
        {onLanguageStep
          ? 'You can change this at any time in Settings.'
          : onMicrophoneStep
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
            onLanguageStep
              ? handleLanguageContinue
              : onMicrophoneStep
              ? micBlocked
                ? openAppSettings
                : handleGrantMicrophone
              : handleEnable
          }
          disabled={requesting}
          accessibilityRole="button"
          accessibilityLabel={
            onLanguageStep
              ? 'Continue with the selected language'
              : onMicrophoneStep
              ? micBlocked
                ? 'Open system settings to allow the microphone'
                : 'Allow microphone access'
              : 'Enable the floating bubble'
          }
        >
          <Text style={styles.primaryText}>
            {onLanguageStep
              ? 'Continue'
              : onMicrophoneStep
              ? micBlocked
                ? 'Open Settings'
                : requesting
                ? 'Requesting…'
                : 'Allow microphone'
              : requesting
              ? 'Opening settings…'
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

      <LanguagePickerModal
        visible={pickerOpen}
        languages={capabilityList({ deviceLocales })}
        selected={dictationLanguage}
        onSelect={handleSelectLanguage}
        onDismiss={() => setPickerOpen(false)}
      />
    </ScreenContainer>
  );
};

export default OverlayOnboardingScreen;
