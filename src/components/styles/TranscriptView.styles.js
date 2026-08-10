import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
  },
  label: {
    ...typography.smallCaption,
    textAlign: 'left',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  scroll: {
    maxHeight: 180,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xs,
  },
  transcript: {
    ...typography.body,
    textAlign: 'left',
  },
  partial: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  placeholder: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

export default styles;
