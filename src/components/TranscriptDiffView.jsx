import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {
  CHANGE,
  diffTranscripts,
  summarizeChanges,
} from '../services/transcriptDiff';
import { colors } from '../theme';
import styles from './styles/TranscriptDiffView.styles';

const TranscriptDiffView = ({ original, revised }) => {
  const [expanded, setExpanded] = useState(false);
  const changes = useMemo(
    () => summarizeChanges(original, revised),
    [original, revised],
  );
  const runs = useMemo(
    () => diffTranscripts(original, revised),
    [original, revised],
  );

  if (!original?.trim() || !revised?.trim()) {
    return null;
  }

  if (!changes.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>What AI changed</Text>
        <Text style={styles.empty}>
          Nothing beyond punctuation and capitalisation.
        </Text>
      </View>
    );
  }

  const label = `${changes.length} ${
    changes.length === 1 ? 'change' : 'changes'
  }`;

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded(value => !value);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? `Hide the ${label} AI made` : `View the ${label} AI made`
        }
        accessibilityState={{ expanded }}
      >
        <Text style={styles.title}>What AI changed</Text>
        <View style={styles.headerRight}>
          <Text style={styles.count}>{label}</Text>
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>

      {!expanded ? null : (
        <>
          <View style={styles.summary}>
            {changes.map((change, index) => (
              <Text
                key={`${change.from}-${change.to}-${index}`}
                style={styles.summaryLine}
              >
                {change.type === 'replaced' ? (
                  <>
                    <Text style={styles.removedText}>{change.from}</Text>
                    <Text style={styles.arrow}> → </Text>
                    <Text style={styles.addedText}>{change.to}</Text>
                  </>
                ) : change.type === 'added' ? (
                  <>
                    <Text style={styles.arrow}>added </Text>
                    <Text style={styles.addedText}>{change.to}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.arrow}>removed </Text>
                    <Text style={styles.removedText}>{change.from}</Text>
                  </>
                )}
              </Text>
            ))}
          </View>

          <Text style={styles.inlineLabel}>In context</Text>
          <Text style={styles.inline}>
            {runs.map((run, index) => (
              <Text
                key={`${run.type}-${index}`}
                style={
                  run.type === CHANGE.REMOVED
                    ? styles.removed
                    : run.type === CHANGE.ADDED
                    ? styles.added
                    : styles.equal
                }
              >
                {run.tokens.join(' ')}{' '}
              </Text>
            ))}
          </Text>
        </>
      )}
    </View>
  );
};

export default TranscriptDiffView;
