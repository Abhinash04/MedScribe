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
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.xl,
    gap: spacing.md,
    elevation: 10,
  },
  header: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
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
    fontSize: 13,
    lineHeight: 19,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    minHeight: 52,
  },
  rowSelected: {
    backgroundColor: colors.primaryLight,
  },
  rowPressed: {
    opacity: 0.8,
  },
  rowBody: {
    flex: 1,
  },
  nativeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  englishName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badgeOnDevice: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  badgeTextOnDevice: {
    color: colors.successText,
  },
  badgeCloudOnly: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  badgeTextCloudOnly: {
    color: colors.warningText,
  },
  badgeUnverified: {
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceSoft,
  },
  badgeTextUnverified: {
    color: colors.textMuted,
  },
  footnote: {
    paddingHorizontal: spacing.xl,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  close: {
    marginHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default styles;
