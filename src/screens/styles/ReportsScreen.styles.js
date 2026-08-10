import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  heading: {
    ...typography.largeHeading,
    fontSize: 30,
    marginTop: spacing.sm,
  },
  subheading: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  search: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 40,
  },
  filterChipActive: {
    borderColor: colors.primaryAccent,
    backgroundColor: colors.primaryLight,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primaryAccent,
  },
  countLine: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
  errorCard: {
    backgroundColor: colors.errorSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    ...typography.body,
    fontSize: 14,
    color: colors.danger,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryAccent,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.body,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyBody: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default styles;
