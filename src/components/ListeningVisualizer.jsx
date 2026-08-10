import { useEffect } from 'react';
import { View } from 'react-native';
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
import styles from './styles/ListeningVisualizer.styles';

const RMS_FLOOR = -2;
const RMS_CEILING = 10;

const WaveBar = ({ factor, minHeight, maxHeight, isActive }) => {
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

const BAR_CONFIG = [
  { factor: 0.75, minHeight: 12, maxHeight: 36 },
  { factor: 1.15, minHeight: 14, maxHeight: 54 },
  { factor: 0.95, minHeight: 12, maxHeight: 42 },
  { factor: 1.35, minHeight: 16, maxHeight: 60 },
  { factor: 1.05, minHeight: 14, maxHeight: 48 },
  { factor: 0.85, minHeight: 12, maxHeight: 38 },
  { factor: 1.2, minHeight: 14, maxHeight: 50 },
];

const ListeningVisualizer = ({ isActive = true, isPaused = false }) => {
  const pulseScale1 = useSharedValue(1);
  const pulseOpacity1 = useSharedValue(0.4);
  const pulseScale2 = useSharedValue(1);
  const pulseOpacity2 = useSharedValue(0.2);
  const micFloat = useSharedValue(0);

  const isRunning = isActive && !isPaused;

  useEffect(() => {
    if (!isRunning) {
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
    isRunning,
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
            isActive={isRunning}
          />
        ))}
      </View>
    </View>
  );
};

export default ListeningVisualizer;
