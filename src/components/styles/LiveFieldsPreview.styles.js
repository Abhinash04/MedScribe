import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.sm,
    gap: 6,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryAccent,
    letterSpacing: 0.8,
  },
  deferredNote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  pillValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    maxWidth: 140,
  },
});

export default styles;
