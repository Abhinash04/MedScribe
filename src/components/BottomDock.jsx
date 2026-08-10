import { useNavigation } from '@react-navigation/native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MicGlyph from './MicGlyph';
import useStartConsultation from '../hooks/useStartConsultation';
import { colors, spacing } from '../theme';
import styles, {
  BAR_HEIGHT,
  FAB_LIFT,
  FAB_SIZE,
} from './styles/BottomDock.styles';

const DESTINATIONS = [
  { route: 'Dashboard', label: 'Home', icon: 'home' },
  { route: 'Reports', label: 'Reports', icon: 'file-text' },
  { route: 'Patients', label: 'Patients', icon: 'users' },
  { route: 'Settings', label: 'Settings', icon: 'settings' },
];

const safeBottom = inset => Math.max(inset, spacing.sm);

export function useDockClearance() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + safeBottom(insets.bottom) + spacing.lg;
}

const DockTab = ({ label, icon, selected, onPress }) => (
  <Pressable
    style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
    onPress={onPress}
    accessibilityRole="tab"
    accessibilityLabel={label}
    accessibilityState={{ selected }}
  >
    <View style={[styles.iconPill, selected && styles.iconPillActive]}>
      <Icon
        name={icon}
        size={22}
        color={selected ? colors.primaryAccent : colors.textMuted}
      />
    </View>
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

  const [home, reports, patients, settings] = DESTINATIONS;

  const go = route => {
    if (route === active) {
      return;
    }
    navigation.navigate(route);
  };

  const tabFor = destination => (
    <DockTab
      label={destination.label}
      icon={destination.icon}
      selected={active === destination.route}
      onPress={() => go(destination.route)}
    />
  );

  return (
    <View
      style={[styles.wrapper, { paddingBottom: bottomPad }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        {tabFor(home)}
        {tabFor(reports)}
        <View style={styles.fabSlot}>
          <Text style={styles.fabCaption}>Record</Text>
        </View>
        {tabFor(patients)}
        {tabFor(settings)}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: bottomPad + BAR_HEIGHT - FAB_SIZE + FAB_LIFT },
          pressed && styles.fabPressed,
        ]}
        onPress={startConsultation}
        accessibilityRole="button"
        accessibilityLabel="Start a new consultation"
        accessibilityHint="Opens the dictation screen"
      >
        <MicGlyph size={28} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
};

export default BottomDock;
