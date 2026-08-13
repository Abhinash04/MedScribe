import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import ScreenContainer from '../components/ScreenContainer';
import { requestOverlayPermission } from '../services/dictationOverlayService';
import useSettingsStore from '../store/useSettingsStore';
import { colors } from '../theme';
import styles from './styles/OverlayOnboardingScreen.styles';

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

  const goToDashboard = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [navigation]);

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

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.hero}>
        <Image
          source={require('../assets/MedScribe_Logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Dictate from anywhere</Text>
        <Text style={styles.subtitle}>
          MedScribe can show a floating button over your other apps so a
          consultation is always one tap away.
        </Text>
      </View>

      <View style={styles.benefits}>
        {BENEFITS.map(benefit => (
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
        Android calls this "Display over other apps". You can turn it off at any
        time in Settings.
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            requesting && styles.disabled,
          ]}
          onPress={handleEnable}
          disabled={requesting}
          accessibilityRole="button"
          accessibilityLabel="Enable the floating bubble"
        >
          <Text style={styles.primaryText}>
            {requesting ? 'Opening settings…' : 'Enable floating bubble'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
          onPress={handleSkip}
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
