import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import BottomDock, { useDockClearance } from '../components/BottomDock';
import ReportListRow from '../components/ReportListRow';
import ScreenContainer from '../components/ScreenContainer';
import { REPORT_STATUS } from '../db/reportsRepository';
import useReportsStore from '../store/useReportsStore';
import { colors } from '../theme';
import styles from './styles/ReportsScreen.styles';

const FILTERS = [
  { key: 'all', label: 'All', icon: 'layers' },
  { key: 'drafts', label: 'Drafts', icon: 'edit-2' },
  { key: 'final', label: 'Finalized', icon: 'check-circle' },
];

const ReportsScreen = ({ navigation, route }) => {
  const reports = useReportsStore(state => state.reports);
  const loading = useReportsStore(state => state.loading);
  const loaded = useReportsStore(state => state.loaded);
  const error = useReportsStore(state => state.error);
  const loadAll = useReportsStore(state => state.loadAll);
  const remove = useReportsStore(state => state.remove);

  const [filter, setFilter] = useState(route?.params?.filter ?? 'all');
  const [query, setQuery] = useState(route?.params?.patient ?? '');
  const clearance = useDockClearance();

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  // Arriving from Patients or a Home quick tile pops back to this screen rather
  // than mounting it again, so the params have to be applied on change.
  const patientParam = route?.params?.patient;
  const filterParam = route?.params?.filter;

  useEffect(() => {
    if (patientParam) {
      setQuery(patientParam);
    }
  }, [patientParam]);

  useEffect(() => {
    if (filterParam) {
      setFilter(filterParam);
    }
  }, [filterParam]);

  const visibleReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reports.filter(report => {
      const isFinal = report.status === REPORT_STATUS.FINAL;
      if (filter === 'drafts' && isFinal) {
        return false;
      }
      if (filter === 'final' && !isFinal) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        report.patientName?.toLowerCase().includes(needle) ||
        report.diagnosis?.toLowerCase().includes(needle)
      );
    });
  }, [reports, query, filter]);

  const handleOpen = useCallback(
    id => navigation.navigate('Report', { reportId: id }),
    [navigation],
  );

  const handleDelete = useCallback(
    report => {
      Alert.alert(
        'Delete report?',
        `${report.patientName || 'This report'} will be permanently removed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => remove(report.id),
          },
        ],
      );
    },
    [remove],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <ReportListRow
        report={item}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />
    ),
    [handleOpen, handleDelete],
  );

  const header = (
    <View>
      <Text style={styles.heading}>Reports</Text>
      <Text style={styles.subheading}>
        Every consultation you have saved on this device.
      </Text>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search by patient or diagnosis"
        placeholderTextColor={colors.textMuted}
        autoFocus={route?.params?.focusSearch === true}
        accessibilityLabel="Search saved reports"
      />

      <View style={styles.filterRow}>
        {FILTERS.map(option => {
          const active = filter === option.key;
          return (
            <Pressable
              key={option.key}
              style={({ pressed }) => [
                styles.filterChip,
                active && styles.filterChipActive,
                pressed && styles.pressed,
              ]}
              onPress={() => setFilter(option.key)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${option.label.toLowerCase()} reports`}
              accessibilityState={{ selected: active }}
            >
              <Icon
                name={option.icon}
                size={14}
                color={active ? colors.primaryAccent : colors.textSecondary}
              />
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadAll} accessibilityRole="button">
            <Text style={styles.linkText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.countLine}>
        {visibleReports.length}{' '}
        {visibleReports.length === 1 ? 'report' : 'reports'}
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
          {reports.length === 0 ? 'No reports yet' : 'Nothing matches'}
        </Text>
        <Text style={styles.emptyBody}>
          {reports.length === 0
            ? 'Tap the microphone to dictate your first patient consultation.'
            : 'Try a different search, or change the filter above.'}
        </Text>
      </View>
    );

  return (
    <>
      <ScreenContainer>
        <FlatList
          data={visibleReports}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={{ paddingBottom: clearance }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </ScreenContainer>
      <BottomDock active="Reports" />
    </>
  );
};

export default ReportsScreen;
