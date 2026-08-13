import { StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, typography } from '../../theme';

const { width } = Dimensions.get('window');
const scale = size => Math.round((width / 390) * size);

export const styles = StyleSheet.create({
  pageBackground: {
    backgroundColor: '#f8f5ff',
    flex: 1,
  },
  heroHeader: {
    paddingTop: scale(52),
    paddingHorizontal: scale(24),
    paddingBottom: scale(40),
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecorCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroDecorCircle2: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroDecorCircle3: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  brandTitle: {
    fontSize: scale(36),
    fontWeight: '900',
    color: '#fff',
    lineHeight: scale(40),
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heading: {
    ...typography.largeHeading,
    fontSize: 30,
    marginTop: spacing.sm,
  },
  subheading: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  rowPressed: {
    backgroundColor: colors.primaryLight,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowValue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  rowTrailing: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusOn: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  statusOff: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextOn: {
    color: colors.successText,
  },
  statusTextOff: {
    color: colors.warningText,
  },
  footnote: {
    ...typography.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});

export default styles;
