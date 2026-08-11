import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import BottomDock, { useDockClearance } from '../components/BottomDock';
import LanguagePickerModal from '../components/LanguagePickerModal';
import ScreenContainer from '../components/ScreenContainer';
import { isTranscriptionAvailable } from '../config/features';
import { displayFor } from '../constants/languages';
import { RECORDING_STATE } from '../constants/recordingStates';
import { purgeAbandoned } from '../services/consultationAudio';
import { capabilityList } from '../services/languageCapabilities';
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
import styles from './styles/SettingsScreen.styles';

const SettingRow = ({
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

const StatusBadge = ({ on, onLabel, offLabel }) => (
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
  const resetRecording = useRecordingStore(state => state.reset);
  const recordingStatus = useRecordingStore(state => state.status);
  const dictationLanguage = useSettingsStore(state => state.dictationLanguage);
  const setDictationLanguage = useSettingsStore(
    state => state.setDictationLanguage,
  );
  const deviceLocales = useSettingsStore(
    state => state.deviceRecognizerLocales,
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
      (async () => {
        const active = await getActiveSession();
        if (!cancelled) {
          setUnfinished(active?.segments?.length ? active : null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

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
    <>
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={{ paddingBottom: clearance }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>Settings</Text>
          <Text style={styles.subheading}>
            Dictation, storage and device capability.
          </Text>

          <Text style={styles.sectionTitle}>Dictation</Text>
          <View style={styles.card}>
            <SettingRow
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
            <SettingRow
              icon="help-circle"
              label="How it works"
              value={
                isEnglish
                  ? 'Dictation is recognised on this device and refined by Anuvadini.'
                  : `Dictation is recognised in ${language.englishName}, then translated to English for the report. Prompts for missing details are spoken back in ${language.englishName}.`
              }
            />
            <SettingRow
              icon="cpu"
              label="AI transcription"
              value={
                transcriptionOn
                  ? 'Recordings are refined by Anuvadini after each dictation.'
                  : 'No transcription endpoint in this build — the original transcript is used.'
              }
              trailing={
                <StatusBadge on={transcriptionOn} onLabel="ON" offLabel="OFF" />
              }
            />
            <SettingRow
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
                  <StatusBadge
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
            <SettingRow
              first
              icon="trash-2"
              label="Clear recorded audio"
              value="Free space used by consultation recordings."
              onPress={handleClearAudio}
              accessibilityHint="Asks for confirmation first"
            />
            {unfinished ? (
              <SettingRow
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

          {__DEV__ ? (
            <>
              <Text style={styles.sectionTitle}>Developer</Text>
              <View style={styles.card}>
                <SettingRow
                  first
                  icon="bar-chart-2"
                  label="STT measurement"
                  value="Speech-to-text accuracy harness."
                  onPress={() => navigation.navigate('SttMeasure')}
                />
                <SettingRow
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
            <SettingRow
              first
              icon="info"
              label="MedScribe"
              value="Medical dictation assistant"
              trailing={
                <Text style={styles.rowTrailing}>v{packageJson.version}</Text>
              }
            />
          </View>

          <Text style={styles.footnote}>
            {isEnglish
              ? 'Patient data never leaves this device except for transcription.'
              : 'Patient data never leaves this device except for transcription and translation.'}
          </Text>
        </ScrollView>
      </ScreenContainer>
      <BottomDock active="Settings" />
      <LanguagePickerModal
        visible={pickerOpen}
        languages={capabilityList({ deviceLocales })}
        selected={dictationLanguage}
        onSelect={handleSelectLanguage}
        onDismiss={() => setPickerOpen(false)}
      />
    </>
  );
};

export default SettingsScreen;
