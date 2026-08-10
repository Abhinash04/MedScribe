import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export const BAR_HEIGHT = 64;
export const FAB_SIZE = 64;
export const FAB_LIFT = 22;
export const FAB_SLOT_WIDTH = FAB_SIZE + spacing.sm + spacing.xs;

export const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: BAR_HEIGHT,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    shadowColor: colors.primaryAccent,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 48,
  },
  tabPressed: {
    opacity: 0.6,
  },
  iconPill: {
    width: 44,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.primaryLight,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.primaryAccent,
  },
  fabSlot: {
    width: FAB_SLOT_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.sm,
  },
  fabCaption: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: colors.primaryAccent,
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primaryAccent,
    borderWidth: 3,
    borderColor: colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: colors.primaryAccent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
  },
  fabPressed: {
    backgroundColor: colors.primaryHover,
    transform: [{ scale: 0.96 }],
  },
});

export default styles;
