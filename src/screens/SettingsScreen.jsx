import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import AnuvadiniMark from '../components/AnuvadiniMark';
import BottomDock, { useDockClearance } from '../components/BottomDock';
import LanguagePickerModal from '../components/LanguagePickerModal';
import { isTranscriptionAvailable } from '../config/features';
import { displayFor } from '../constants/languages';
import { RECORDING_STATE } from '../constants/recordingStates';
import { purgeAbandoned } from '../services/consultationAudio';
import {
  capabilitiesFor,
  capabilityList,
  RECOGNIZER,
} from '../services/languageCapabilities';
import {
  getOverlayDiagnostics,
  requestOverlayPermission,
} from '../services/dictationOverlayService';
import { describeDiagnostics } from '../services/overlayRestriction';
import * as sharedMic from '../services/sharedMicService';
import {
  clearActiveSession,
  getActiveSession,
} from '../services/sessionPersistenceService';
import { clearRefinementState } from '../services/transcriptRefinement';
import useRecordingStore from '../store/useRecordingStore';
import useSettingsStore, { ensureHydrated } from '../store/useSettingsStore';
import { colors } from '../theme';
import packageJson from '../../package.json';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useScaledStyles from '../hooks/useScaledStyles';
import createStyles from './styles/SettingsScreen.styles';

const SettingRow = ({
  styles,
  icon,
  label,
  value,
  trailing,
  onPress,
  first,
  accessibilityHint,
}) => {
  const content = (
    <>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} color={colors.primaryAccent} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {trailing}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, !first && styles.rowDivider]}>{content}</View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !first && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
    >
      {content}
    </Pressable>
  );
};

const StatusBadge = ({ on, onLabel, offLabel, styles }) => (
  <View style={[styles.statusPill, on ? styles.statusOn : styles.statusOff]}>
    <Text
      style={[
        styles.statusText,
        on ? styles.statusTextOn : styles.statusTextOff,
      ]}
    >
      {on ? onLabel : offLabel}
    </Text>
  </View>
);

const SettingsScreen = ({ navigation }) => {
  const styles = useScaledStyles(createStyles);
  const insets = useSafeAreaInsets();
  const resetRecording = useRecordingStore(state => state.reset);
  const recordingStatus = useRecordingStore(state => state.status);
  const dictationLanguage = useSettingsStore(state => state.dictationLanguage);
  const setDictationLanguage = useSettingsStore(
    state => state.setDictationLanguage,
  );
  const deviceLocales = useSettingsStore(
    state => state.deviceRecognizerLocales,
  );
  const bubbleEnabled = useSettingsStore(state => state.bubbleEnabled);
  const overlayGranted = useSettingsStore(state => state.overlayGranted);
  const bubbleActive = bubbleEnabled && overlayGranted;
  const setBubbleEnabled = useSettingsStore(state => state.setBubbleEnabled);
  const refreshOverlayGrant = useSettingsStore(
    state => state.refreshOverlayGrant,
  );
  const [captureSupported, setCaptureSupported] = useState(null);
  const [unfinished, setUnfinished] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const clearance = useDockClearance();
  const transcriptionOn = isTranscriptionAvailable();
  const language = displayFor(dictationLanguage);
  const isEnglish = dictationLanguage === 'en';

  useEffect(() => {
    ensureHydrated();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = await sharedMic.isSupported();
      if (!cancelled) {
        setCaptureSupported(supported);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      refreshOverlayGrant();
      (async () => {
        const active = await getActiveSession();
        if (!cancelled) {
          setUnfinished(active?.segments?.length ? active : null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [refreshOverlayGrant]),
  );

  const handleOverlayDiagnostics = useCallback(() => {
    const report = describeDiagnostics(getOverlayDiagnostics());
    Alert.alert(
      report.title,
      [...report.lines, '', report.body].join('\n'),
    );
  }, []);

  const handleToggleBubble = useCallback(async () => {
    if (bubbleEnabled) {
      await setBubbleEnabled(false);
      return;
    }

    if (refreshOverlayGrant()) {
      await setBubbleEnabled(true);
      return;
    }

    Alert.alert(
      'Allow MedScribe to draw over other apps',
      'The floating bubble lets you dictate from any screen without opening ' +
        'MedScribe. Android needs the "display over other apps" permission to ' +
        'show it. You can turn this off at any time.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Open settings',
          onPress: async () => {
            await requestOverlayPermission();
          },
        },
      ],
    );
  }, [bubbleEnabled, setBubbleEnabled, refreshOverlayGrant]);

  const handleSelectLanguage = useCallback(
    async code => {
      setPickerOpen(false);
      if (code === dictationLanguage) {
        return;
      }

      await setDictationLanguage(code);

      const inProgress =
        recordingStatus === RECORDING_STATE.LISTENING ||
        recordingStatus === RECORDING_STATE.PAUSED ||
        Boolean(unfinished);

      if (inProgress) {
        Alert.alert(
          'Applies to your next dictation',
          'The consultation in progress keeps the language it was started in.',
        );
      }
    },
    [dictationLanguage, setDictationLanguage, recordingStatus, unfinished],
  );

  const handleClearAudio = useCallback(() => {
    Alert.alert(
      'Clear recorded audio?',
      'Removes every consultation recording still held on this device. Saved ' +
        'reports and transcripts are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const removed = await purgeAbandoned(0);
            Alert.alert(
              'Recordings cleared',
              removed
                ? `${removed} ${
                    removed === 1 ? 'recording was' : 'recordings were'
                  } removed.`
                : 'There was nothing left to remove.',
            );
          },
        },
      ],
    );
  }, []);

  const handleDiscardUnfinished = useCallback(() => {
    Alert.alert(
      'Discard the consultation in progress?',
      'The dictation and any report details captured for it will be removed.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await clearActiveSession(unfinished?.id);
            await purgeAbandoned(0);
            clearRefinementState();
            resetRecording();
            setUnfinished(null);
          },
        },
      ],
    );
  }, [unfinished, resetRecording]);

  return (
    <View style={styles.pageBackground}>
      <ScrollView
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#6c63ff', '#8b5cf6', '#a78bfa']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.heroDecorCircle1} />
          <View style={styles.heroDecorCircle2} />
          <View style={styles.heroDecorCircle3} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleColumn}>
              <Text style={styles.brandTitle}>Settings</Text>
              <Text style={styles.brandSub}>
                Dictation, storage and device capability.
              </Text>
            </View>
            <View style={styles.brandBadge}>
              <AnuvadiniMark size={32} />
            </View>
          </View>
        </LinearGradient>
        <View style={[styles.contentContainer, { paddingBottom: clearance + 20 }]}>

          <Text style={styles.sectionTitle}>Dictation</Text>
          <View style={styles.card}>
            <SettingRow styles={styles}
              first
              icon="globe"
              label="Language"
              value={`${language.nativeName} · ${language.tag}`}
              onPress={() => setPickerOpen(true)}
              accessibilityHint="Choose the language you dictate in"
              trailing={
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              }
            />
            <SettingRow styles={styles}
              icon="help-circle"
              label="How it works"
              value={(() => {
                const cap = capabilitiesFor(dictationLanguage, { deviceLocales });
                const recognizerText =
                  cap.recognizer === RECOGNIZER.ON_DEVICE
                    ? 'Dictation is recognised on this device'
                    : cap.recognizer === RECOGNIZER.CLOUD_ONLY
                    ? `Dictation is recognised via cloud speech service for ${language.englishName}`
                    : `Dictation is recognised in ${language.englishName}`;
                return isEnglish
                  ? `${recognizerText} and refined by Anuvadini.`
                  : `${recognizerText}, then translated to English for the report. Prompts for missing details are spoken back in ${language.englishName}.`;
              })()}
            />
            <SettingRow styles={styles}
              icon="message-circle"
              label="Floating dictation bubble"
              value={
                bubbleActive
                  ? 'Dictate from any screen without opening MedScribe.'
                  : overlayGranted
                  ? 'Turn on to dictate from any screen.'
                  : 'Needs permission to draw over other apps.'
              }
              onPress={handleToggleBubble}
              accessibilityHint="Shows a draggable dictation control over other apps"
              trailing={
                <StatusBadge styles={styles}
                  on={bubbleActive}
                  onLabel="ON"
                  offLabel={overlayGranted ? 'OFF' : 'NEEDS PERMISSION'}
                />
              }
            />
            <SettingRow styles={styles}
              icon="cpu"
              label="AI transcription"
              value={
                transcriptionOn
                  ? 'Recordings are refined by Anuvadini after each dictation.'
                  : 'No transcription endpoint in this build — the original transcript is used.'
              }
              trailing={
                <StatusBadge styles={styles} on={transcriptionOn} onLabel="ON" offLabel="OFF" />
              }
            />
            <SettingRow styles={styles}
              icon="mic"
              label="Shared microphone capture"
              value={
                captureSupported === null
                  ? 'Checking…'
                  : captureSupported
                  ? 'Audio is recorded alongside recognition, so AI refinement can run.'
                  : 'This device cannot record while recognising — AI refinement is unavailable.'
              }
              trailing={
                captureSupported === null ? null : (
                  <StatusBadge styles={styles}
                    on={captureSupported}
                    onLabel="READY"
                    offLabel="NO"
                  />
                )
              }
            />
          </View>

          <Text style={styles.sectionTitle}>Storage</Text>
          <View style={styles.card}>
            <SettingRow styles={styles}
              first
              icon="trash-2"
              label="Clear recorded audio"
              value="Free space used by consultation recordings."
              onPress={handleClearAudio}
              accessibilityHint="Asks for confirmation first"
            />
            {unfinished ? (
              <SettingRow styles={styles}
                icon="x-circle"
                label="Discard consultation in progress"
                value={`${unfinished.segments.length} ${
                  unfinished.segments.length === 1 ? 'utterance' : 'utterances'
                } captured but not saved as a report.`}
                onPress={handleDiscardUnfinished}
                accessibilityHint="Asks for confirmation first"
              />
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          <View style={styles.card}>
            <SettingRow styles={styles}
              first
              icon="layers"
              label="Overlay diagnostics"
              value="Why the floating bubble permission was refused."
              onPress={handleOverlayDiagnostics}
            />
          </View>

          {__DEV__ ? (
            <>
              <Text style={styles.sectionTitle}>Developer</Text>
              <View style={styles.card}>
                <SettingRow styles={styles}
                  first
                  icon="bar-chart-2"
                  label="STT measurement"
                  value="Speech-to-text accuracy harness."
                  onPress={() => navigation.navigate('SttMeasure')}
                />
                <SettingRow styles={styles}
                  icon="activity"
                  label="Mic spike"
                  value="Raw capture and recogniser diagnostics."
                  onPress={() => navigation.navigate('MicSpike')}
                />
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <SettingRow styles={styles}
              first
              icon="info"
              label="MedScribe"
              value="Medical dictation assistant"
              trailing={
                <Text style={styles.rowTrailing}>v{packageJson.version}</Text>
              }
            />
            <SettingRow
              styles={styles}
              icon="award"
              label="Developed by"
              value="Anuvadini · Language, Technology, Scalability"
              trailing={<AnuvadiniMark size={28} />}
            />
          </View>

          <Text style={styles.footnote}>
            {isEnglish
              ? 'Patient data never leaves this device except for transcription.'
              : 'Patient data never leaves this device except for transcription and translation.'}
          </Text>
        </View>
      </ScrollView>
      <BottomDock active="Settings" />
      <LanguagePickerModal
        visible={pickerOpen}
        languages={capabilityList({ deviceLocales })}
        selected={dictationLanguage}
        onSelect={handleSelectLanguage}
        onDismiss={() => setPickerOpen(false)}
      />
    </View>
  );
};

export default SettingsScreen;
