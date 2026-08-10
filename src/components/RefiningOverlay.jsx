import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme';
import styles from './styles/RefiningOverlay.styles';

const RefiningOverlay = ({ visible, onSkip, progress }) => {
  const total = progress?.total ?? 0;
  const done = Math.min(progress?.done ?? 0, total);
  const showParts = total > 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.primaryAccent} />

          <Text style={styles.title}>Refining your dictation…</Text>
          <Text style={styles.detail}>
            We're improving the transcription for better clinical accuracy.
          </Text>

          {showParts ? (
            <View style={styles.progressBlock}>
              <Text style={styles.progressText}>
                Part {Math.min(done + 1, total)} of {total}
              </Text>
              <View style={styles.track}>
                <View
                  style={[styles.fill, { width: `${(done / total) * 100}%` }]}
                />
              </View>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Continue with the original transcription"
            hitSlop={8}
          >
            <Text style={styles.skipText}>Continue with original</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default RefiningOverlay;
