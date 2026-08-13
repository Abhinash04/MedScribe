import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CONSULTATION_STAGE } from '../store/useRecordingStore';
import useRecordingStore, {
  selectFullTranscript,
  isTranslationReady,
} from '../store/useRecordingStore';
import { needsTranslation } from '../services/consultationTranslation';
import dictationSessionManager from '../services/dictationSessionManager';
import * as overlay from '../services/dictationOverlayService';
import { requestReportHandoff } from '../services/overlayHandoff';
import styles from './styles/OverlayReviewScreen.styles';

const OverlayReviewScreen = () => {
  const nativeTranscript = useRecordingStore(selectFullTranscript);
  const setFullTranscript = useRecordingStore(state => state.setFullTranscript);
  const translation = useRecordingStore(state => state.translation);
  const setTranslationText = useRecordingStore(
    state => state.setTranslationText,
  );
  const setStage = useRecordingStore(state => state.setStage);
  const language = useRecordingStore(state => state.language);

  const multilingual = needsTranslation(language);
  const [original, setOriginal] = useState(nativeTranscript);
  const [english, setEnglish] = useState(translation.text);
  const [saved, setSaved] = useState(false);

  const translationReady = useRecordingStore(isTranslationReady);
  const canGenerate = useMemo(
    () =>
      multilingual
        ? translationReady && english.trim().length > 0
        : original.trim().length > 0,
    [multilingual, translationReady, english, original],
  );

  const handleSave = useCallback(() => {
    if (original !== nativeTranscript) {
      setFullTranscript(original);
    }
    if (multilingual && english !== translation.text) {
      setTranslationText(english);
    }
    dictationSessionManager.persistCurrentSession();
    setSaved(true);
  }, [
    original,
    nativeTranscript,
    setFullTranscript,
    multilingual,
    english,
    translation.text,
    setTranslationText,
  ]);

  const handleGenerate = useCallback(async () => {
    handleSave();
    setStage(CONSULTATION_STAGE.REPORT);
    await dictationSessionManager.persistNow();
    requestReportHandoff('Report');
    await overlay.handoffToReport();
  }, [handleSave, setStage]);

  const handleOpenFullReview = useCallback(async () => {
    handleSave();
    setStage(CONSULTATION_STAGE.REVIEW);
    await dictationSessionManager.persistNow();
    requestReportHandoff('TranscriptReview');
    await overlay.handoffToReport();
  }, [handleSave, setStage]);

  const handleMinimize = useCallback(() => {
    handleSave();
    overlay.closeReviewSurface();
  }, [handleSave]);

  const handleClose = useCallback(() => {
    overlay.closeReviewSurface();
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={styles.scrim} onPress={handleMinimize} />

      <View style={styles.sheet}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <Text style={styles.title}>Review transcript</Text>
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
          >
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Original transcript</Text>
          <TextInput
            style={styles.input}
            multiline
            value={original}
            onChangeText={setOriginal}
            placeholder="Dictated text will appear here…"
            placeholderTextColor="#94A3B8"
          />

          {multilingual ? (
            <>
              <Text style={styles.label}>English translation</Text>
              <TextInput
                style={styles.input}
                multiline
                value={english}
                onChangeText={setEnglish}
                placeholder="The English translation will appear here…"
                placeholderTextColor="#94A3B8"
              />
            </>
          ) : null}

          {saved ? <Text style={styles.savedNote}>Changes saved</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.fullReviewButton,
              pressed && styles.pressed,
            ]}
            onPress={handleOpenFullReview}
            accessibilityRole="button"
            accessibilityLabel="Open the full review screen"
          >
            <Text style={styles.fullReviewText}>
              Open full review in MedScribe
            </Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
            onPress={handleMinimize}
            accessibilityRole="button"
            accessibilityLabel="Minimize"
          >
            <Text style={styles.secondaryText}>Minimize</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
          >
            <Text style={styles.secondaryText}>Save changes</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              !canGenerate && styles.disabled,
              pressed && styles.pressed,
            ]}
            onPress={handleGenerate}
            disabled={!canGenerate}
            accessibilityRole="button"
            accessibilityLabel="Generate report"
            accessibilityState={{ disabled: !canGenerate }}
          >
            <Text style={styles.primaryText}>Generate report</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default OverlayReviewScreen;
