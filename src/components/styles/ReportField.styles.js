import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.smallCaption,
    textAlign: 'left',
    color: colors.textMuted,
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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.primaryBackground,
  },
  multiline: {
    minHeight: 64,
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
    marginBottom: spacing.xs,
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
