import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export const DOCK_HEIGHT = 82;
export const DOCK_INSET = spacing.lg;

export const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: DOCK_INSET,
    right: DOCK_INSET,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: DOCK_HEIGHT,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 24,
    backgroundColor: colors.primaryBackground,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    shadowColor: colors.primaryAccent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 48,
    paddingHorizontal: 2,
  },
  itemPressed: {
    opacity: 0.6,
  },
  itemDisabled: {
    opacity: 0.45,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  tileEmphasis: {
    backgroundColor: colors.primaryAccent,
    shadowColor: colors.primaryAccent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  tileDone: {
    backgroundColor: colors.successSoft,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  labelEmphasis: {
    color: colors.primaryAccent,
    fontWeight: '700',
  },
  labelDone: {
    color: colors.successText,
  },
});

export default styles;
