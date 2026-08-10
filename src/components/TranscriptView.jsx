import { useCallback, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import styles from './styles/TranscriptView.styles';

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

export default TranscriptView;
