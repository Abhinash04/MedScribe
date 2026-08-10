import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  statusPillListening: {
    shadowColor: colors.success,
  },
  statusPillPaused: {
    shadowColor: colors.secondaryAccent,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  dotListening: {
    backgroundColor: colors.success,
  },
  dotPaused: {
    backgroundColor: colors.secondaryAccent,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryAccent,
    fontVariant: ['tabular-nums'],
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  spinner: {
    marginTop: spacing.lg,
  },
  livePreview: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  transcript: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  footer: {
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondaryAccent,
  },
  hintText: {
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0.3,
  },
});

export default styles;
