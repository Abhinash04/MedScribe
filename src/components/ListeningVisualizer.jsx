import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { amplitudeShared } from '../services/speechService';
import { colors, spacing } from '../theme';

/**
 * Android's SpeechRecognizer reports volume as raw RMS dB, roughly -2 at the
 * noise floor and ~10 at speaking volume. Map that onto 0..1.
 */
const RMS_FLOOR = -2;
const RMS_CEILING = 10;

/**
 * One spectrum bar. Height tracks the live microphone level rather than a
 * random walk, so the visualizer reflects what the microphone actually hears.
 */
const WaveBar = ({ factor, minHeight, maxHeight, isActive }) => {
  // Derives height on the UI thread straight from the shared amplitude.
  // Nothing here goes through React state, so microphone updates at
  // 10-20x/second cost zero renders.
  const animStyle = useAnimatedStyle(() => {
    if (!isActive) {
      return { height: withTiming(minHeight, { duration: 300 }) };
    }

    const ratio =
      (amplitudeShared.value - RMS_FLOOR) / (RMS_CEILING - RMS_FLOOR);
    const level = Math.min(Math.max(ratio, 0), 1);
    const scaled = Math.min(level * factor, 1);

    return {
      height: withTiming(minHeight + (maxHeight - minHeight) * scaled, {
        duration: 120,
      }),
    };
  }, [factor, minHeight, maxHeight, isActive]);

  return <Animated.View style={[styles.waveBar, animStyle]} />;
};

// Per-bar gain, so a uniform input level still produces an organic silhouette.
const BAR_CONFIG = [
  { factor: 0.75, minHeight: 12, maxHeight: 36 },
  { factor: 1.15, minHeight: 14, maxHeight: 54 },
  { factor: 0.95, minHeight: 12, maxHeight: 42 },
  { factor: 1.35, minHeight: 16, maxHeight: 60 },
  { factor: 1.05, minHeight: 14, maxHeight: 48 },
  { factor: 0.85, minHeight: 12, maxHeight: 38 },
  { factor: 1.2, minHeight: 14, maxHeight: 50 },
];

/**
 * Listening stage for the recording screen (SRS FR-2 feedback).
 *
 * Microphone level is read from the `amplitudeShared` Reanimated value rather
 * than passed as a prop — see the note in `speechService`.
 *
 * @param {boolean} isActive False while processing/finished — freezes the
 *   animation instead of pulsing forever after recording has stopped.
 */
const ListeningVisualizer = ({ isActive = true }) => {
  const pulseScale1 = useSharedValue(1);
  const pulseOpacity1 = useSharedValue(0.4);
  const pulseScale2 = useSharedValue(1);
  const pulseOpacity2 = useSharedValue(0.2);
  const micFloat = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(pulseScale1);
      cancelAnimation(pulseOpacity1);
      cancelAnimation(pulseScale2);
      cancelAnimation(pulseOpacity2);
      cancelAnimation(micFloat);

      pulseScale1.value = withTiming(1, { duration: 400 });
      pulseOpacity1.value = withTiming(0.15, { duration: 400 });
      pulseScale2.value = withTiming(1, { duration: 400 });
      pulseOpacity2.value = withTiming(0.08, { duration: 400 });
      micFloat.value = withTiming(0, { duration: 400 });
      return;
    }

    // Ambient aura — a steady presence cue independent of input level, so the
    // stage never looks frozen during a pause between sentences.
    pulseScale1.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 1800 }),
        withTiming(1, { duration: 1800 }),
      ),
      -1,
      true,
    );
    pulseOpacity1.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 1800 }),
        withTiming(0.2, { duration: 1800 }),
      ),
      -1,
      true,
    );

    pulseScale2.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1.6, { duration: 2200 }),
          withTiming(1, { duration: 2200 }),
        ),
        -1,
        true,
      ),
    );
    pulseOpacity2.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(0.4, { duration: 2200 }),
          withTiming(0.1, { duration: 2200 }),
        ),
        -1,
        true,
      ),
    );

    micFloat.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1500 }),
        withTiming(4, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, [
    isActive,
    micFloat,
    pulseOpacity1,
    pulseOpacity2,
    pulseScale1,
    pulseScale2,
  ]);

  const aura1Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale1.value }],
    opacity: pulseOpacity1.value,
  }));

  const aura2Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale2.value }],
    opacity: pulseOpacity2.value,
  }));

  const micAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: micFloat.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Central Floating Listening Emblem */}
      <View style={styles.centerStage}>
        <Animated.View style={[styles.auraRingOuter, aura2Style]} />
        <Animated.View style={[styles.auraRingInner, aura1Style]} />

        <Animated.View style={[styles.micEmblem, micAnimStyle]}>
          <View style={styles.micCapsule}>
            <View style={styles.micGridTop} />
            <View style={styles.micGridLine} />
          </View>
          <View style={styles.micStandCup} />
          <View style={styles.micStem} />
          <View style={styles.micBase} />
        </Animated.View>
      </View>

      {/* Live microphone level spectrum */}
      <View
        style={styles.waveSpectrumRow}
        accessibilityRole="image"
        accessibilityLabel="Microphone input level"
      >
        {BAR_CONFIG.map((bar, index) => (
          <WaveBar
            key={index}
            factor={bar.factor}
            minHeight={bar.minHeight}
            maxHeight={bar.maxHeight}
            isActive={isActive}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  centerStage: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  auraRingOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accentGlow,
  },
  auraRingInner: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accentGlowActive,
  },
  micEmblem: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.secondaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.secondaryAccent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  micCapsule: {
    width: 16,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.secondaryAccent,
    alignItems: 'center',
    paddingTop: 3,
  },
  micGridTop: {
    width: 8,
    height: 2,
    backgroundColor: colors.primaryBackground,
    borderRadius: 1,
    opacity: 0.7,
  },
  micGridLine: {
    width: 8,
    height: 2,
    backgroundColor: colors.primaryBackground,
    borderRadius: 1,
    marginTop: 2,
    opacity: 0.7,
  },
  micStandCup: {
    width: 24,
    height: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 2.5,
    borderColor: colors.secondaryAccent,
    borderTopWidth: 0,
    marginTop: -8,
  },
  micStem: {
    width: 2.5,
    height: 6,
    backgroundColor: colors.secondaryAccent,
    marginTop: 1,
  },
  micBase: {
    width: 16,
    height: 2.5,
    backgroundColor: colors.secondaryAccent,
    borderRadius: 1,
  },
  waveSpectrumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
    marginTop: spacing.xl,
    gap: 8,
  },
  waveBar: {
    width: 5,
    borderRadius: 2.5,
    backgroundColor: colors.secondaryAccent,
  },
});

export default ListeningVisualizer;
