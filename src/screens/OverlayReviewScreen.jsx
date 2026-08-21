import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  selectLiveTranscript,
  isTranslationReady,
} from '../store/useRecordingStore';
import {
  ANUVADINI_STATUS,
  TRANSCRIPT_SOURCE,
  shouldAutoSelectAi,
} from '../services/consultationTranscripts';
import {
  TRANSLATION_STATUS,
  needsTranslation,
} from '../services/consultationTranslation';
import dictationSessionManager from '../services/dictationSessionManager';
import * as overlay from '../services/dictationOverlayService';
import { requestReportHandoff } from '../services/overlayHandoff';
import { ensureTranslation } from '../services/transcriptTranslation';
import styles from './styles/OverlayReviewScreen.styles';

const OverlayReviewScreen = () => {
  const nativeTranscript = useRecordingStore(selectFullTranscript);
  const anuvadini = useRecordingStore(state => state.anuvadini);
  const transcriptSource = useRecordingStore(state => state.transcriptSource);
  const sourceChosen = useRecordingStore(state => state.sourceChosen);
  const setTranscriptSource = useRecordingStore(
    state => state.setTranscriptSource,
  );
  const setAnuvadiniText = useRecordingStore(state => state.setAnuvadiniText);
  const setFullTranscript = useRecordingStore(state => state.setFullTranscript);
  const translation = useRecordingStore(state => state.translation);
  const setTranslationText = useRecordingStore(
    state => state.setTranslationText,
  );
  const setStage = useRecordingStore(state => state.setStage);
  const language = useRecordingStore(state => state.language);
  const multilingual = needsTranslation(language);
  const live = useRecordingStore(selectLiveTranscript);
  const showingAi = live.slice === TRANSCRIPT_SOURCE.ANUVADINI;
  const aiAvailable = live.reason !== 'native-only';
  const [original, setOriginal] = useState(live.text);
  const [english, setEnglish] = useState(translation.text);
  const [saved, setSaved] = useState(false);
  const syncedOriginal = useRef(live.text);
  const syncedEnglish = useRef(translation.text);
  const [staleOriginal, setStaleOriginal] = useState(false);
  const [staleEnglish, setStaleEnglish] = useState(false);

  useEffect(() => {
    if (live.text === syncedOriginal.current) {
      return;
    }
    const untouched = original === syncedOriginal.current;
    syncedOriginal.current = live.text;
    if (untouched) {
      setOriginal(live.text);
    } else {
      setStaleOriginal(true);
    }
  }, [live.text, original]);

  useEffect(() => {
    if (translation.text === syncedEnglish.current) {
      return;
    }
    const untouched = english === syncedEnglish.current;
    syncedEnglish.current = translation.text;
    if (untouched) {
      setEnglish(translation.text);
    } else {
      setStaleEnglish(true);
    }
  }, [translation.text, english]);

  useEffect(() => {
    if (
      !shouldAutoSelectAi({
        nativeText: nativeTranscript,
        anuvadini,
        source: transcriptSource,
        chosen: sourceChosen,
      })
    ) {
      return;
    }
    setTranscriptSource(TRANSCRIPT_SOURCE.ANUVADINI);
    if (multilingual) {
      ensureTranslation().catch(() => {});
    }
  }, [
    nativeTranscript,
    anuvadini,
    transcriptSource,
    sourceChosen,
    setTranscriptSource,
    multilingual,
  ]);

  useEffect(() => {
    if (multilingual) {
      ensureTranslation().catch(() => {});
    }
  }, [multilingual, transcriptSource]);

  const translationReady = useRecordingStore(isTranslationReady);
  const aiPending = anuvadini.status === ANUVADINI_STATUS.PENDING;
  const aiFailed = anuvadini.status === ANUVADINI_STATUS.FAILED;
  const translationPending =
    multilingual && translation.status === TRANSLATION_STATUS.PENDING;
  const translationFailed =
    multilingual && translation.status === TRANSLATION_STATUS.FAILED;
  const canGenerate = useMemo(() => {
    if (translationPending) {
      return false;
    }
    if (multilingual && !translationFailed) {
      return translationReady && english.trim().length > 0;
    }
    return original.trim().length > 0;
  }, [
    multilingual,
    translationReady,
    translationPending,
    translationFailed,
    english,
    original,
  ]);

  const handleSave = useCallback(() => {
    if (original !== live.text) {
      if (showingAi) {
        setAnuvadiniText(original);
      } else {
        setFullTranscript(original);
      }
      syncedOriginal.current = original;
      setStaleOriginal(false);
    }
    if (multilingual && english !== translation.text) {
      setTranslationText(english);
      syncedEnglish.current = english;
      setStaleEnglish(false);
    }
    dictationSessionManager.persistCurrentSession();
    setSaved(true);
  }, [
    original,
    live.text,
    showingAi,
    setAnuvadiniText,
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
          <Text style={styles.label}>
            {showingAi ? 'AI transcript' : 'Original transcript'}
          </Text>
          {aiPending ? (
            <Text style={styles.note}>Refining with the AI transcriber…</Text>
          ) : null}
          {aiFailed && !aiAvailable ? (
            <Text style={styles.note}>
              The AI transcriber could not be reached — showing the on-device
              transcript. Please check it carefully.
            </Text>
          ) : null}
          {staleOriginal ? (
            <Text style={styles.note}>
              A newer transcript arrived. Your edit has been kept — save it, or
              close and reopen to load the newer text.
            </Text>
          ) : null}
          <TextInput
            style={styles.input}
            multiline
            value={original}
            onChangeText={next => {
              setOriginal(next);
              setSaved(false);
            }}
            placeholder={
              aiPending ? 'Waiting for the AI transcript…' : 'Dictated text will appear here…'
            }
            placeholderTextColor="#94A3B8"
          />

          {multilingual ? (
            <>
              <Text style={styles.label}>English translation</Text>
              {translationPending ? (
                <Text style={styles.note}>Translating…</Text>
              ) : null}
              {translationFailed ? (
                <Text style={styles.note}>
                  Translation is unavailable. The report will be built from the
                  original transcript.
                </Text>
              ) : null}
              {staleEnglish ? (
                <Text style={styles.note}>
                  A newer translation arrived. Your edit has been kept.
                </Text>
              ) : null}
              <TextInput
                style={styles.input}
                multiline
                value={english}
                onChangeText={next => {
                  setEnglish(next);
                  setSaved(false);
                }}
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
