import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AnimatedMicButton from '../components/AnimatedMicButton';
import AppHeader from '../components/AppHeader';
import ScreenContainer from '../components/ScreenContainer';
import SectionTitle from '../components/SectionTitle';
import { colors, spacing, typography } from '../theme';

const HomeScreen = ({ navigation }) => {
  const handleMicPress = () => {
    navigation.navigate('Recording');
  };

  return (
    <ScreenContainer style={styles.container}>
      {/* Top Header */}
      <AppHeader />

      {/* Middle Content */}
      <View style={styles.contentSection}>
        <SectionTitle
          title="Voice-Powered Medical Documentation"
          subtitle="Tap the microphone to begin dictating patient details."
        />

        {/* Center Hero Animated Microphone */}
        <View style={styles.heroCenter}>
          <AnimatedMicButton onPress={handleMicPress} />
        </View>
      </View>

      {/* Bottom Footer */}
      <View style={styles.footerSection}>
        <Text style={typography.smallCaption}>Secure • Fast • Accurate</Text>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  contentSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
  },
  heroCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    marginHorizontal: spacing.sm,
  },
});

export default HomeScreen;
