import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  column: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    minWidth: 140,
    alignItems: 'center',
  },
  flexButton: {
    flex: 1,
    maxWidth: 180,
  },
  primary: {
    backgroundColor: colors.primaryAccent,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  danger: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.secondaryAccent,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    backgroundColor: colors.surface,
    opacity: 0.6,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  labelOnAccent: {
    color: colors.onPrimary,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
  phaseNote: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
});

export default styles;
