import React, { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

/**
 * Live transcript surface (SRS FR-4).
 *
 * Confirmed text renders solid; the recognizer's interim guess trails it in
 * muted italics so the doctor can see words landing without mistaking an
 * unconfirmed phrase for the final record.
 */
const TranscriptView = ({ finalText = '', partialText = '', style }) => {
  const scrollRef = useRef(null);

  const handleContentSizeChange = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  const isEmpty = !finalText && !partialText;

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>Transcript</Text>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={handleContentSizeChange}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <Text style={styles.placeholder}>
            Start speaking — your dictation will appear here.
          </Text>
        ) : (
          <Text style={styles.transcript} accessibilityLiveRegion="polite">
            {finalText}
            {finalText && partialText ? ' ' : ''}
            {partialText ? (
              <Text style={styles.partial}>{partialText}</Text>
            ) : null}
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
  },
  label: {
    ...typography.smallCaption,
    textAlign: 'left',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  scroll: {
    maxHeight: 180,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xs,
  },
  transcript: {
    ...typography.body,
    textAlign: 'left',
  },
  partial: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  placeholder: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

export default TranscriptView;
