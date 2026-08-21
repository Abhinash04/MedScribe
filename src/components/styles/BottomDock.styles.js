import { StyleSheet } from 'react-native';

export const BAR_HEIGHT = 76;
export const FAB_SIZE = 56;
export const FAB_LIFT = 30; // the overlap

export const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 16,
  },
  tabActive: {
    backgroundColor: '#ede9ff',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '400',
    color: '#c4c9d4',
    marginTop: 4,
  },
  tabLabelActive: {
    fontWeight: '700',
    color: '#6c63ff',
  },
  fabSlot: {
    width: FAB_SIZE + 10,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    top: -FAB_LIFT,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default styles;
