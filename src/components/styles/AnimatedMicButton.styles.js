import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

const BUTTON_SIZE = 120;

export const styles = StyleSheet.create({
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
    backgroundColor: colors.primaryHover,
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
    backgroundColor: colors.onPrimary,
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
    borderColor: colors.onPrimary,
    borderTopWidth: 0,
    marginTop: -10,
  },
  micStem: {
    width: 3,
    height: 8,
    backgroundColor: colors.onPrimary,
    marginTop: 1,
  },
  micBase: {
    width: 18,
    height: 3,
    backgroundColor: colors.onPrimary,
    borderRadius: 1.5,
  },
});

export default styles;
