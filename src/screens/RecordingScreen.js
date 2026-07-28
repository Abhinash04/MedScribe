import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AppHeader from '../components/AppHeader';
import ListeningVisualizer from '../components/ListeningVisualizer';
import ScreenContainer from '../components/ScreenContainer';
import SectionTitle from '../components/SectionTitle';
import { colors, spacing, typography } from '../theme';

const RecordingScreen = ({ navigation }) => {
  const handleBackPress = () => {
    navigation.goBack();
  };

  return (
    <ScreenContainer style={styles.container}>
      {/* Top Header with Back Navigation */}
      <AppHeader showBack onBackPress={handleBackPress} title="" />

      {/* Main Recording Visualizer Content */}
      <View style={styles.centerSection}>
        <SectionTitle
          title="Listening..."
          subtitle="Speak clearly into your device microphone."
        />

        <ListeningVisualizer />
      </View>

      {/* Bottom Instruction Footer */}
      <View style={styles.instructionFooter}>
        <View style={styles.pulseDot} />
        <Text style={[typography.smallCaption, styles.instructionText]}>
          Voice recognition will begin here.
        </Text>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  instructionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondaryAccent,
  },
  instructionText: {
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0.3,
  },
});

export default RecordingScreen;
