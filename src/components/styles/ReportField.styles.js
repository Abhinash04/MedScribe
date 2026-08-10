import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'left',
    color: colors.textSecondary,
  },
  uncertainBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onPrimary,
    backgroundColor: colors.textMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  editedBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onPrimary,
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  value: {
    ...typography.body,
    textAlign: 'left',
  },
  input: {
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.primaryBackground,
    color: colors.textPrimary,
  },
  inputMissing: {
    borderColor: colors.warning,
    backgroundColor: colors.warningLight,
  },
  multiline: {
    minHeight: 96,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  missing: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bullet: {
    ...typography.body,
    color: colors.secondaryAccent,
  },
  bulletText: {
    flex: 1,
  },
  removeItem: {
    ...typography.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  addRow: {
    paddingVertical: spacing.sm,
  },
  addText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },
});

export default styles;
