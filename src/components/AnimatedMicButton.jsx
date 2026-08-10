import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import styles from './styles/AnimatedMicButton.styles';

const AnimatedMicButton = ({ onPress }) => {
  const buttonScale = useSharedValue(1);
  const breathingScale = useSharedValue(1);
  const breathingOpacity = useSharedValue(0.35);
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(1);

  useEffect(() => {
    breathingScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2200 }),
        withTiming(1, { duration: 2200 }),
      ),
      -1,
      true,
    );

    breathingOpacity.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 2200 }),
        withTiming(0.3, { duration: 2200 }),
      ),
      -1,
      true,
    );
  }, [breathingScale, breathingOpacity]);

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.92, {
      damping: 15,
      stiffness: 300,
    });

    rippleScale.value = 1;
    rippleOpacity.value = 0.8;
    rippleScale.value = withTiming(1.45, { duration: 500 });
    rippleOpacity.value = withTiming(0, { duration: 500 });

    glowPulse.value = withSequence(
      withTiming(1.3, { duration: 150 }),
      withTiming(1, { duration: 350 }),
    );
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, {
      damping: 12,
      stiffness: 200,
    });
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const animatedBreathingStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: breathingScale.value }],
      opacity: breathingOpacity.value,
    };
  });

  const animatedRippleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: rippleScale.value }],
      opacity: rippleOpacity.value,
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: glowPulse.value }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Outer Breathing Aura */}
      <Animated.View style={[styles.breathingRing, animatedBreathingStyle]} />

      {/* Tap Ripple Ring */}
      <Animated.View style={[styles.rippleRing, animatedRippleStyle]} />

      {/* Button Pulse Glow */}
      <Animated.View style={[styles.glowRing, animatedGlowStyle]} />

      {/* Hero Interactive Button */}
      <Animated.View style={[styles.buttonWrapper, animatedButtonStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.micButton,
            pressed && styles.micButtonPressed,
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          accessibilityLabel="Start dictation"
          accessibilityRole="button"
          accessibilityHint="Navigates to recording screen to begin medical voice documentation"
        >
          {/* Medical Microphone Vector Icon */}
          <View style={styles.micIconContainer}>
            <View style={styles.micCapsule}>
              <View style={styles.micGridTop} />
              <View style={styles.micGridLine} />
            </View>
            <View style={styles.micStandCup} />
            <View style={styles.micStem} />
            <View style={styles.micBase} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
};

export default AnimatedMicButton;
