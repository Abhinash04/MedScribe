import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    gap: spacing.md,
    elevation: 10,
  },
  title: {
    ...typography.largeHeading,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: {
    maxHeight: 220,
  },
  listContent: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bullet: {
    color: colors.secondaryAccent,
    fontSize: 18,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  rowNote: {
    fontSize: 12,
    color: colors.textMuted,
  },
  promptError: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
  buttonRow: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primaryAccent,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  pressed: {
    opacity: 0.8,
  },
  replay: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default styles;
