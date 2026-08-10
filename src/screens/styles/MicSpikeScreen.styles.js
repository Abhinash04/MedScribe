import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl, gap: spacing.xs },
  script: {
    ...typography.body,
    fontSize: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  button: {
    backgroundColor: colors.primaryAccent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  currentBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 2,
  },
  currentTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  currentHint: { fontSize: 12, color: colors.textSecondary },
  phaseCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: 4,
  },
  phaseHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  pass: { backgroundColor: colors.success },
  fail: { backgroundColor: colors.danger },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  mono: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  file: { fontSize: 10, color: colors.secondaryAccent },
  transcript: { fontSize: 12, color: colors.textPrimary, fontStyle: 'italic' },
  logLine: { fontSize: 10, color: colors.textMuted },
});

export default styles;
