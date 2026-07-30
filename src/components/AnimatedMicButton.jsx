import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing } from '../theme';

const AnimatedMicButton = ({ onPress }) => {
  // Shared animation values
  const buttonScale = useSharedValue(1);
  const breathingScale = useSharedValue(1);
  const breathingOpacity = useSharedValue(0.35);
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(1);

  useEffect(() => {
    // Soft continuous idle breathing animation
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

    // Ripple feedback
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

  // Reanimated style definitions
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

const BUTTON_SIZE = 120;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: BUTTON_SIZE * 2,
    height: BUTTON_SIZE * 2,
    marginVertical: spacing.lg,
  },
  breathingRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 48,
    height: BUTTON_SIZE + 48,
    borderRadius: (BUTTON_SIZE + 48) / 2,
    backgroundColor: colors.accentGlow,
  },
  rippleRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 24,
    height: BUTTON_SIZE + 24,
    borderRadius: (BUTTON_SIZE + 24) / 2,
    borderWidth: 2,
    borderColor: colors.secondaryAccent,
  },
  glowRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 16,
    height: BUTTON_SIZE + 16,
    borderRadius: (BUTTON_SIZE + 16) / 2,
    backgroundColor: colors.accentGlowActive,
    opacity: 0.4,
  },
  buttonWrapper: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    elevation: 12,
    shadowColor: colors.primaryAccent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  micButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.secondaryAccent,
  },
  micButtonPressed: {
    backgroundColor: '#1D4ED8',
  },
  micIconContainer: {
    width: 44,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micCapsule: {
    width: 18,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    paddingTop: 4,
  },
  micGridTop: {
    width: 10,
    height: 2,
    backgroundColor: colors.primaryAccent,
    borderRadius: 1,
    opacity: 0.6,
  },
  micGridLine: {
    width: 10,
    height: 2,
    backgroundColor: colors.primaryAccent,
    borderRadius: 1,
    marginTop: 3,
    opacity: 0.6,
  },
  micStandCup: {
    width: 28,
    height: 16,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 3,
    borderColor: colors.textPrimary,
    borderTopWidth: 0,
    marginTop: -10,
  },
  micStem: {
    width: 3,
    height: 8,
    backgroundColor: colors.textPrimary,
    marginTop: 1,
  },
  micBase: {
    width: 18,
    height: 3,
    backgroundColor: colors.textPrimary,
    borderRadius: 1.5,
  },
});

export default AnimatedMicButton;
