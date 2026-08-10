import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconMicBody: {
    width: 16,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.textMuted,
  },
  iconStrike: {
    position: 'absolute',
    width: 48,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: colors.textSecondary,
    transform: [{ rotate: '45deg' }],
  },
  body: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  actionButton: {
    backgroundColor: colors.primaryAccent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
  },
  actionButtonPressed: {
    backgroundColor: colors.primaryHover,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});

export default styles;
