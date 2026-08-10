import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  summaryCard: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  summaryCount: {
    ...typography.largeHeading,
    color: colors.secondaryAccent,
  },
  summaryLabel: {
    ...typography.smallCaption,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusDraft: {
    backgroundColor: colors.surfaceBorder,
  },
  statusFinal: {
    backgroundColor: colors.success,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusTextDraft: {
    color: colors.textPrimary,
  },
  statusTextFinal: {
    color: colors.onPrimary,
  },
  savedLabel: {
    ...typography.smallCaption,
    letterSpacing: 0.3,
    textTransform: 'none',
  },
  summaryHint: {
    ...typography.mediumSubtitle,
    fontSize: 14,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  missingCard: {
    backgroundColor: colors.warningLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    gap: spacing.xs,
  },
  missingTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  missingList: {
    ...typography.body,
    color: colors.warningText,
    fontWeight: '600',
  },
  missingHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 35,
    elevation: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.sm,
  },
  transcriptToggle: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  transcriptToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },
  transcriptCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 2,
    padding: spacing.md,
    marginHorizontal: spacing.sm,
  },
  transcriptText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footer: {
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primaryAccent,
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.75,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryAccent,
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryAccent,
  },
  doneRow: {
    paddingVertical: spacing.sm,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },
});

export default styles;
