import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AnimatedMicButton from '../components/AnimatedMicButton';
import AppHeader from '../components/AppHeader';
import ScreenContainer from '../components/ScreenContainer';
import { REPORT_STATUS } from '../db/reportsRepository';
import useRecordingStore from '../store/useRecordingStore';
import useReportsStore from '../store/useReportsStore';
import { colors, spacing, typography } from '../theme';
import { formatDateTime } from '../utils/datetime';

/**
 * Doctor dashboard — the launch screen.
 *
 * Single doctor, no authentication (deliberate for this phase). The list is
 * the only place saved reports are enumerated, and it reads through
 * `useReportsStore` so no screen touches SQL.
 */
const DashboardScreen = ({ navigation }) => {
  const reports = useReportsStore(state => state.reports);
  const loading = useReportsStore(state => state.loading);
  const loaded = useReportsStore(state => state.loaded);
  const error = useReportsStore(state => state.error);
  const loadAll = useReportsStore(state => state.loadAll);
  const remove = useReportsStore(state => state.remove);
  const resetRecording = useRecordingStore(state => state.reset);

  // Refresh on focus, not just on mount: returning from a save must show it.
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const handleNewDictation = useCallback(() => {
    // Explicit reset rather than relying on RecordingScreen clearing on mount.
    resetRecording();
    navigation.navigate('Recording');
  }, [resetRecording, navigation]);

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
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={() => handleOpen(item.id)}
        onLongPress={() => handleDelete(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open report for ${
          item.patientName || 'unnamed patient'
        }`}
        accessibilityHint="Long press to delete"
      >
        <View style={styles.cardTop}>
          <Text style={styles.patientName} numberOfLines={1}>
            {item.patientName || 'Unnamed patient'}
          </Text>
          <View
            style={[
              styles.statusPill,
              item.status === REPORT_STATUS.FINAL
                ? styles.statusFinal
                : styles.statusDraft,
            ]}
          >
            <Text style={styles.statusText}>
              {item.status === REPORT_STATUS.FINAL ? 'FINAL' : 'DRAFT'}
            </Text>
          </View>
        </View>

        <Text style={styles.diagnosis} numberOfLines={2}>
          {item.diagnosis || 'No diagnosis recorded'}
        </Text>
        <Text style={styles.timestamp}>{formatDateTime(item.createdAt)}</Text>
      </Pressable>
    ),
    [handleOpen, handleDelete],
  );

  const showEmpty = loaded && !loading && reports.length === 0 && !error;

  return (
    <ScreenContainer>
      <AppHeader />

      <View style={styles.titleRow}>
        <Text style={styles.title}>Patient Reports</Text>
        <Text style={styles.count}>
          {reports.length} saved
        </Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadAll} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {loading && !loaded ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.secondaryAccent} />
        </View>
      ) : showEmpty ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No reports yet</Text>
          <Text style={styles.emptyBody}>
            Tap the microphone to dictate your first patient consultation.
          </Text>
          <View style={styles.emptyMic}>
            <AnimatedMicButton onPress={handleNewDictation} />
          </View>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
          onPress={handleNewDictation}
          accessibilityRole="button"
          accessibilityLabel="Start a new dictation"
        >
          <Text style={styles.primaryLabel}>New Dictation</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.brandTitle,
    fontSize: 22,
  },
  count: {
    ...typography.smallCaption,
    textAlign: 'right',
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  patientName: {
    ...typography.body,
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusDraft: {
    backgroundColor: colors.surfaceBorder,
  },
  statusFinal: {
    backgroundColor: colors.success,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  diagnosis: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  timestamp: {
    ...typography.smallCaption,
    textAlign: 'left',
    marginTop: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.largeHeading,
    fontSize: 20,
  },
  emptyBody: {
    ...typography.mediumSubtitle,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  emptyMic: {
    marginTop: spacing.xl,
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
    marginTop: spacing.sm,
  },
  footer: {
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primaryAccent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.75,
  },
});

export default DashboardScreen;
