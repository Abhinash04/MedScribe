import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl, gap: spacing.xs },
  scriptBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  scriptLabel: { fontSize: 10, fontWeight: '700', color: colors.primaryAccent, letterSpacing: 0.8 },
  script: { ...typography.body, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  tagActive: { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent },
  tagText: { fontSize: 12, color: colors.textSecondary },
  tagTextActive: { color: colors.onPrimary, fontWeight: '700' },
  button: {
    backgroundColor: colors.primaryAccent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  reportCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.md,
    gap: 2,
  },
  reportTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase' },
  metricBig: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  good: { color: colors.success },
  bad: { color: colors.danger },
  mono: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  transcript: { fontSize: 12, color: colors.textPrimary, fontStyle: 'italic', marginTop: spacing.xs },
});

export default styles;
