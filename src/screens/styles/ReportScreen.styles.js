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
    paddingBottom: spacing.xl,
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

  // Header summary
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconComplete: {
    backgroundColor: colors.successSoft,
  },
  summaryIconPending: {
    backgroundColor: colors.warningSoft,
  },
  summaryTextCol: {
    flex: 1,
  },
  summaryCount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceBorder,
    overflow: 'hidden',
  },
  trackFill: {
    height: 6,
    borderRadius: 999,
  },
  trackFillComplete: {
    backgroundColor: colors.success,
  },
  trackFillPending: {
    backgroundColor: colors.primaryAccent,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
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
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextDraft: {
    color: colors.textPrimary,
  },
  statusTextFinal: {
    color: colors.onPrimary,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  savedLabel: {
    fontSize: 12,
    color: colors.textMuted,
    flexShrink: 1,
  },
  savedLabelDirty: {
    color: colors.warningText,
    fontWeight: '600',
  },

  // Missing-fields warning
  missingCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  missingBody: {
    flex: 1,
    gap: 2,
  },
  missingTitle: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  missingList: {
    fontSize: 14,
    color: colors.warningText,
    fontWeight: '600',
  },
  missingHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Section cards
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.body,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionCountPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  sectionCountPillComplete: {
    backgroundColor: colors.successSoft,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryAccent,
  },
  sectionCountTextComplete: {
    color: colors.successText,
  },
  fieldPair: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pairItem: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
  },

  // Original dictation
  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  transcriptToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },
  transcriptCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
  },
  transcriptText: {
    ...typography.body,
    color: colors.textSecondary,
  },

});

export default styles;
