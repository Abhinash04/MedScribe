import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppHeader from '../components/AppHeader';
import ScreenContainer from '../components/ScreenContainer';
import SectionTitle from '../components/SectionTitle';
import useRecordingStore, {
  selectFullTranscript,
} from '../store/useRecordingStore';
import { colors, spacing, typography } from '../theme';
import dictationSessionManager from '../services/dictationSessionManager';

/**
 * Format elapsed duration as MM:SS.
 */
function formatDuration(totalSeconds = 0) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const TranscriptReviewScreen = ({ navigation }) => {
  const fullTranscript = useRecordingStore(selectFullTranscript);
  const segments = useRecordingStore(state => state.segments);
  const durationSeconds = useRecordingStore(state => state.durationSeconds);
  const updateSegment = useRecordingStore(state => state.updateSegment);
  const deleteSegment = useRecordingStore(state => state.deleteSegment);
  const setFullTranscript = useRecordingStore(state => state.setFullTranscript);

  const [editableText, setEditableText] = useState(fullTranscript);
  const [editingSegmentId, setEditingSegmentId] = useState(null);
  const [segmentEditText, setSegmentEditText] = useState('');
  const [viewMode, setViewMode] = useState('full'); // 'full' or 'segments'

  // Segment edits and deletes change `fullTranscript` while the full editor
  // holds its own copy. Without this the editor would still show the pre-edit
  // text, and Resume or Generate would write that stale copy back over the
  // correction the doctor just made.
  useEffect(() => {
    setEditableText(fullTranscript);
  }, [fullTranscript]);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleResumeRecording = useCallback(() => {
    // Any edit made in the full-text editor has to be committed before going
    // back, otherwise the newly dictated utterances would append to the
    // pre-edit transcript and the correction would silently vanish.
    if (viewMode === 'full' && editableText !== fullTranscript) {
      setFullTranscript(editableText);
    }
    // `resume` tells the recording screen to keep what is already transcribed
    // rather than starting a new consultation.
    navigation.navigate('Recording', { resume: true });
  }, [navigation, viewMode, editableText, fullTranscript, setFullTranscript]);

  const handleGenerateReport = useCallback(async () => {
    // If the full text editor was modified, sync it to store
    if (viewMode === 'full' && editableText !== fullTranscript) {
      setFullTranscript(editableText);
    }
    // Clean active session
    await dictationSessionManager.clearSession();
    // Navigate to Report screen
    navigation.navigate('Report');
  }, [editableText, fullTranscript, viewMode, setFullTranscript, navigation]);

  const handleDeleteSegment = useCallback(
    segment => {
      Alert.alert(
        'Delete this sentence?',
        'It will be removed from the transcript used to generate the report.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteSegment(segment.id),
          },
        ],
      );
    },
    [deleteSegment],
  );

  const handleSaveSegmentEdit = useCallback(
    id => {
      if (segmentEditText.trim()) {
        updateSegment(id, segmentEditText);
      } else {
        deleteSegment(id);
      }
      setEditingSegmentId(null);
      setSegmentEditText('');
    },
    [segmentEditText, updateSegment, deleteSegment],
  );

  return (
    <ScreenContainer style={styles.container}>
      <AppHeader showBack onBackPress={goBack} title="Transcript Review" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle
          title="Review & Edit Transcript"
          subtitle="Ensure dictation accuracy before generating structured patient report."
        />

        {/* Stats bar */}
        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeLabel}>Recording Time</Text>
            <Text style={styles.metaBadgeValue}>
              {formatDuration(durationSeconds)}
            </Text>
          </View>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeLabel}>Utterances</Text>
            <Text style={styles.metaBadgeValue}>{segments.length}</Text>
          </View>
        </View>

        {/* Toggle mode: Full editor vs Segments */}
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'full' && styles.toggleBtnActive]}
            onPress={() => setViewMode('full')}
          >
            <Text
              style={[
                styles.toggleText,
                viewMode === 'full' && styles.toggleTextActive,
              ]}
            >
              Full Editor
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toggleBtn,
              viewMode === 'segments' && styles.toggleBtnActive,
            ]}
            onPress={() => setViewMode('segments')}
          >
            <Text
              style={[
                styles.toggleText,
                viewMode === 'segments' && styles.toggleTextActive,
              ]}
            >
              Sentence Breakdown ({segments.length})
            </Text>
          </Pressable>
        </View>

        {viewMode === 'full' ? (
          <View style={styles.editorCard}>
            <Text style={styles.cardLabel}>FULL TRANSCRIPT</Text>
            <TextInput
              style={styles.fullTextInput}
              multiline
              value={editableText}
              onChangeText={setEditableText}
              placeholder="Dictated text will appear here..."
              placeholderTextColor={colors.textMuted}
            />
          </View>
        ) : (
          <View style={styles.segmentsList}>
            {segments.map((segment, index) => (
              <View key={segment.id || index} style={styles.segmentCard}>
                <View style={styles.segmentHeader}>
                  <Text style={styles.segmentIndex}>Sentence #{index + 1}</Text>
                  {segment.edited ? (
                    <Text style={styles.editedBadge}>Edited</Text>
                  ) : null}
                </View>

                {editingSegmentId === segment.id ? (
                  <View style={styles.editSegmentBox}>
                    <TextInput
                      style={styles.segmentInput}
                      multiline
                      value={segmentEditText}
                      onChangeText={setSegmentEditText}
                      autoFocus
                    />
                    <View style={styles.segmentEditActions}>
                      <Pressable
                        style={styles.saveSegBtn}
                        onPress={() => handleSaveSegmentEdit(segment.id)}
                      >
                        <Text style={styles.saveSegText}>Save</Text>
                      </Pressable>
                      <Pressable
                        style={styles.cancelSegBtn}
                        onPress={() => setEditingSegmentId(null)}
                      >
                        <Text style={styles.cancelSegText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.segmentText}>{segment.text}</Text>
                )}

                {editingSegmentId !== segment.id ? (
                  <View style={styles.segmentActionsRow}>
                    <Pressable
                      style={styles.actionLink}
                      onPress={() => {
                        setEditingSegmentId(segment.id);
                        setSegmentEditText(segment.text);
                      }}
                    >
                      <Text style={styles.actionLinkText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      style={styles.actionLink}
                      onPress={() => handleDeleteSegment(segment)}
                    >
                      <Text style={[styles.actionLinkText, styles.deleteText]}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.resumeBtn,
            pressed && styles.pressed,
          ]}
          onPress={handleResumeRecording}
        >
          <Text style={styles.resumeBtnText}>+ Add More Speech</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.generateBtn,
            pressed && styles.pressed,
          ]}
          onPress={handleGenerateReport}
        >
          <Text style={styles.generateBtnText}>Generate Report ➔</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  metaBadge: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    alignItems: 'center',
  },
  metaBadgeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaBadgeValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primaryAccent,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: colors.primaryAccent,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.onPrimary,
  },
  editorCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    minHeight: 200,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  fullTextInput: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 160,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 24,
  },
  segmentsList: {
    gap: spacing.sm,
  },
  segmentCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: spacing.xs,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  segmentIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  editedBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondaryAccent,
    backgroundColor: colors.errorSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  segmentText: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  segmentActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  actionLink: {
    paddingVertical: 4,
  },
  actionLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryAccent,
  },
  deleteText: {
    color: colors.secondaryAccent,
  },
  editSegmentBox: {
    gap: spacing.sm,
  },
  segmentInput: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.primaryAccent,
    borderRadius: 8,
    padding: spacing.sm,
    backgroundColor: colors.primaryBackground,
  },
  segmentEditActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  saveSegBtn: {
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  saveSegText: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  cancelSegBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  cancelSegText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  footer: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  generateBtn: {
    backgroundColor: colors.primaryAccent,
  },
  pressed: {
    opacity: 0.8,
  },
  resumeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  generateBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});

export default TranscriptReviewScreen;
