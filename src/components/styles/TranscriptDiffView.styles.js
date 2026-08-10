import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  count: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
  },
  summary: {
    gap: 4,
    marginTop: spacing.xs,
  },
  summaryLine: {
    fontSize: 15,
    lineHeight: 22,
  },
  arrow: {
    color: colors.textMuted,
    fontSize: 14,
  },
  inlineLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  inline: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 24,
  },
  equal: {
    color: colors.textSecondary,
  },
  removed: {
    color: colors.secondaryAccent,
    textDecorationLine: 'line-through',
  },
  added: {
    color: colors.success,
    fontWeight: '700',
  },
  removedText: {
    color: colors.secondaryAccent,
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  addedText: {
    color: colors.success,
    fontWeight: '700',
  },
});

export default styles;
