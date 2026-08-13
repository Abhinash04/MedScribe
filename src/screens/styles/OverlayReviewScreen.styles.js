import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.primaryBackground,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: spacing.lg,
    maxHeight: '88%',
    elevation: 16,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.largeHeading,
    fontSize: 18,
    color: colors.textPrimary,
  },
  close: {
    fontSize: 18,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  bodyContent: {
    paddingBottom: spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 120,
    maxHeight: 220,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  savedNote: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.successText,
  },
  fullReviewButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullReviewText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryAccent,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  primaryButton: {
    flex: 1.4,
    backgroundColor: colors.primaryAccent,
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  disabled: {
    backgroundColor: colors.primaryDisabled,
  },
  pressed: {
    opacity: 0.85,
  },
});

export default styles;
