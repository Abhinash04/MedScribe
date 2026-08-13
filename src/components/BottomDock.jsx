import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import useStartConsultation from '../hooks/useStartConsultation';
import styles, { BAR_HEIGHT, FAB_LIFT, FAB_SIZE } from './styles/BottomDock.styles';

const DESTINATIONS = [
  { route: 'Dashboard', label: 'Home', icon: 'home' },
  { route: 'Reports', label: 'Reports', icon: 'file-text' },
  { route: 'Patients', label: 'Patients', icon: 'users' },
  { route: 'Settings', label: 'Settings', icon: 'settings' },
];

const safeBottom = inset => Math.max(inset, 20); // Base 20px padding from bottom

export function useDockClearance() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + safeBottom(insets.bottom) + 20; // 20px extra clearance
}

const DockTab = ({ label, icon, selected, onPress }) => (
  <Pressable
    style={[styles.tab, selected && styles.tabActive]}
    onPress={onPress}
    accessibilityRole="tab"
    accessibilityLabel={label}
    accessibilityState={{ selected }}
  >
    <Icon
      name={icon}
      size={22}
      color={selected ? '#6c63ff' : '#c4c9d4'}
    />
    <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>
      {label}
    </Text>
  </Pressable>
);

const BottomDock = ({ active }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const startConsultation = useStartConsultation();
  const bottomPad = safeBottom(insets.bottom);

  const go = route => {
    if (route === active) return;
    navigation.navigate(route);
  };

  const [home, reports, patients, settings] = DESTINATIONS;

  return (
    <View
      style={[styles.wrapper, { paddingBottom: bottomPad }]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        <DockTab
          label={home.label}
          icon={home.icon}
          selected={active === home.route}
          onPress={() => go(home.route)}
        />
        <DockTab
          label={reports.label}
          icon={reports.icon}
          selected={active === reports.route}
          onPress={() => go(reports.route)}
        />
        
        <View style={styles.fabSlot}>
          <Pressable
            style={styles.fab}
            onPress={startConsultation}
            accessibilityRole="button"
            accessibilityLabel="Start a new consultation"
          >
            <LinearGradient
              colors={['#6c63ff', '#a78bfa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Icon name="mic" size={24} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>

        <DockTab
          label={patients.label}
          icon={patients.icon}
          selected={active === patients.route}
          onPress={() => go(patients.route)}
        />
        <DockTab
          label={settings.label}
          icon={settings.icon}
          selected={active === settings.route}
          onPress={() => go(settings.route)}
        />
      </View>
    </View>
  );
};

export default BottomDock;
