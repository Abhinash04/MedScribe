import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import BottomDock, { useDockClearance } from '../components/BottomDock';
import { initialsOf, tintFor } from '../components/ReportListRow';
import ScreenContainer from '../components/ScreenContainer';
import useReportsStore from '../store/useReportsStore';
import { colors } from '../theme';
import { formatRelativeDateTime } from '../utils/datetime';
import styles from './styles/PatientsScreen.styles';

const UNNAMED = 'Unnamed patient';

/**
 * Patients are not a stored entity — `patientName` is a field extracted onto
 * each report — so the list is derived by grouping the reports that exist.
 */
function groupByPatient(reports) {
  const groups = new Map();

  for (const report of reports) {
    const name = report.patientName?.trim();
    const key = name ? name.toLowerCase() : '__unnamed__';
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        name: name || UNNAMED,
        count: 1,
        lastAt: report.createdAt,
        lastId: report.id,
      });
      continue;
    }

    existing.count += 1;
    if (report.createdAt > existing.lastAt) {
      existing.lastAt = report.createdAt;
      existing.lastId = report.id;
      if (name) {
        existing.name = name;
      }
    }
  }

  return [...groups.values()].sort((a, b) => b.lastAt - a.lastAt);
}

const PatientsScreen = ({ navigation }) => {
  const reports = useReportsStore(state => state.reports);
  const loading = useReportsStore(state => state.loading);
  const loaded = useReportsStore(state => state.loaded);
  const loadAll = useReportsStore(state => state.loadAll);

  const [query, setQuery] = useState('');
  const clearance = useDockClearance();

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const patients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const grouped = groupByPatient(reports);
    if (!needle) {
      return grouped;
    }
    return grouped.filter(patient =>
      patient.name.toLowerCase().includes(needle),
    );
  }, [reports, query]);

  const handleOpen = useCallback(
    patient => {
      if (patient.name === UNNAMED) {
        navigation.navigate('Report', { reportId: patient.lastId });
        return;
      }
      navigation.navigate('Reports', { patient: patient.name });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const tint = tintFor(item.key);
      return (
        <Pressable
          style={({ pressed }) => [styles.patientRow, pressed && styles.pressed]}
          onPress={() => handleOpen(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.count} ${
            item.count === 1 ? 'consultation' : 'consultations'
          }`}
        >
          <View style={[styles.avatar, { backgroundColor: tint.fill }]}>
            <Text style={[styles.avatarText, { color: tint.text }]}>
              {initialsOf(item.name === UNNAMED ? '' : item.name)}
            </Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              Last seen {formatRelativeDateTime(item.lastAt)}
            </Text>
          </View>

          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{item.count}</Text>
          </View>

          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
      );
    },
    [handleOpen],
  );

  const header = (
    <View>
      <Text style={styles.heading}>Patients</Text>
      <Text style={styles.subheading}>
        Everyone you have dictated a consultation for.
      </Text>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search by patient name"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Search patients"
      />

      <Text style={styles.countLine}>
        {patients.length} {patients.length === 1 ? 'patient' : 'patients'}
      </Text>
    </View>
  );

  const empty =
    loading && !loaded ? (
      <View style={styles.emptyBox}>
        <ActivityIndicator color={colors.secondaryAccent} />
      </View>
    ) : (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>
          {reports.length === 0 ? 'No patients yet' : 'Nothing matches'}
        </Text>
        <Text style={styles.emptyBody}>
          {reports.length === 0
            ? 'Patients appear here once you save your first consultation.'
            : 'Try a different name.'}
        </Text>
      </View>
    );

  return (
    <>
      <ScreenContainer>
        <FlatList
          data={patients}
          keyExtractor={item => item.key}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={{ paddingBottom: clearance }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </ScreenContainer>
      <BottomDock active="Patients" />
    </>
  );
};

export default PatientsScreen;
