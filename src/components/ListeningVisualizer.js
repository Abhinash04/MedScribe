import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing } from '../theme';

const WaveBar = ({ delay = 0, initialHeight = 16, maxHeight = 48 }) => {
  const heightVal = useSharedValue(initialHeight);

  useEffect(() => {
    heightVal.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(maxHeight, { duration: 450 + Math.random() * 200 }),
          withTiming(initialHeight, { duration: 450 + Math.random() * 200 }),
        ),
        -1,
        true,
      ),
    );
  }, [delay, heightVal, initialHeight, maxHeight]);

  const animStyle = useAnimatedStyle(() => ({
    height: heightVal.value,
  }));

  return <Animated.View style={[styles.waveBar, animStyle]} />;
};

const ListeningVisualizer = () => {
  const pulseScale1 = useSharedValue(1);
  const pulseOpacity1 = useSharedValue(0.4);
  const pulseScale2 = useSharedValue(1);
  const pulseOpacity2 = useSharedValue(0.2);
  const micFloat = useSharedValue(0);

  useEffect(() => {
    // Pulse aura 1
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

    // Pulse aura 2 (offset)
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

    // Floating mic translateY animation
    micFloat.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1500 }),
        withTiming(4, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, [micFloat, pulseOpacity1, pulseOpacity2, pulseScale1, pulseScale2]);

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

      {/* Audio Waveform Bar Spectrum */}
      <View style={styles.waveSpectrumRow}>
        <WaveBar delay={0} initialHeight={12} maxHeight={36} />
        <WaveBar delay={120} initialHeight={20} maxHeight={54} />
        <WaveBar delay={240} initialHeight={16} maxHeight={42} />
        <WaveBar delay={80} initialHeight={28} maxHeight={60} />
        <WaveBar delay={300} initialHeight={18} maxHeight={48} />
        <WaveBar delay={180} initialHeight={14} maxHeight={38} />
        <WaveBar delay={50} initialHeight={22} maxHeight={50} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justify: 'center',
    paddingVertical: spacing.xl,
  },
  centerStage: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justify: 'center',
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
    justify: 'center',
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
    justify: 'center',
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
