import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MicGlyph from '../components/MicGlyph';
import ScreenContainer from '../components/ScreenContainer';
import { REPORT_STATUS } from '../db/reportsRepository';
import useRecordingStore from '../store/useRecordingStore';
import useReportsStore from '../store/useReportsStore';
import { colors, spacing, typography } from '../theme';
import { formatRelativeDateTime } from '../utils/datetime';

/**
 * Doctor dashboard — the launch screen (SRS FR-1).
 *
 * Single doctor, no authentication (deliberate for this phase). Every number on
 * this screen is derived from saved reports; nothing is estimated or invented,
 * because a metric a doctor cannot trace back to a record is worse than no
 * metric at all.
 *
 * The list reads through `useReportsStore`, so no screen touches SQL.
 */

const RECENT_LIMIT = 3;

/** Avatar tints, picked per report so a patient keeps the same colour. */
const AVATAR_TINTS = [
  { fill: colors.accentSoft, text: colors.secondaryAccent },
  { fill: colors.violetSoft, text: colors.violet },
  { fill: colors.warningSoft, text: colors.warning },
  { fill: colors.successSoft, text: colors.success },
];

function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Good Morning';
  }
  if (hour < 17) {
    return 'Good Afternoon';
  }
  return 'Good Evening';
}

function initialsOf(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return '??';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function tintFor(id) {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) {
    sum += id.charCodeAt(index);
  }
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

const StatTile = ({ label, value, tint, accent, glyph }) => (
  <View style={styles.statTile}>
    <View style={[styles.statChip, { backgroundColor: tint }]}>
      <Text style={[styles.statGlyph, { color: accent }]}>{glyph}</Text>
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const QuickAction = ({ label, glyph, accent, tint, active, onPress }) => (
  <Pressable
    style={({ pressed }) => [
      styles.quickAction,
      active && styles.quickActionActive,
      pressed && styles.pressed,
    ]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected: !!active }}
  >
    <View style={[styles.quickChip, { backgroundColor: tint }]}>
      <Text style={[styles.quickGlyph, { color: accent }]}>{glyph}</Text>
    </View>
    <Text style={styles.quickLabel}>{label}</Text>
  </Pressable>
);

const DashboardScreen = ({ navigation }) => {
  const reports = useReportsStore(state => state.reports);
  const loading = useReportsStore(state => state.loading);
  const loaded = useReportsStore(state => state.loaded);
  const error = useReportsStore(state => state.error);
  const loadAll = useReportsStore(state => state.loadAll);
  const remove = useReportsStore(state => state.remove);
  const resetRecording = useRecordingStore(state => state.reset);

  const [showAll, setShowAll] = useState(false);
  const [draftsOnly, setDraftsOnly] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  // Refresh on focus, not just on mount: returning from a save must show it.
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const stats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    return {
      total: reports.length,
      today: reports.filter(report => report.createdAt >= todayMs).length,
      drafts: reports.filter(report => report.status !== REPORT_STATUS.FINAL)
        .length,
      final: reports.filter(report => report.status === REPORT_STATUS.FINAL)
        .length,
    };
  }, [reports]);

  const visibleReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = reports.filter(report => {
      if (draftsOnly && report.status === REPORT_STATUS.FINAL) {
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

    const expanded = showAll || draftsOnly || needle.length > 0;
    return expanded ? filtered : filtered.slice(0, RECENT_LIMIT);
  }, [reports, query, draftsOnly, showAll]);

  const filtersActive = draftsOnly || query.trim().length > 0;

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

  const handleToggleSearch = useCallback(() => {
    setSearching(previous => {
      if (previous) {
        setQuery('');
      }
      return !previous;
    });
  }, []);

  const handleToggleDrafts = useCallback(() => {
    setDraftsOnly(previous => !previous);
  }, []);

  const handleShowAll = useCallback(() => {
    setShowAll(previous => !previous);
    setDraftsOnly(false);
    setQuery('');
    setSearching(false);
  }, []);

  const renderItem = useCallback(
    ({ item }) => {
      const isFinal = item.status === REPORT_STATUS.FINAL;
      const tint = tintFor(item.id);

      return (
        <Pressable
          style={({ pressed }) => [styles.reportRow, pressed && styles.pressed]}
          onPress={() => handleOpen(item.id)}
          onLongPress={() => handleDelete(item)}
          accessibilityRole="button"
          accessibilityLabel={`Open report for ${
            item.patientName || 'unnamed patient'
          }`}
          accessibilityHint="Long press to delete"
        >
          <View style={[styles.avatar, { backgroundColor: tint.fill }]}>
            <Text style={[styles.avatarText, { color: tint.text }]}>
              {initialsOf(item.patientName)}
            </Text>
          </View>

          <View style={styles.reportBody}>
            <Text style={styles.patientName} numberOfLines={1}>
              {item.patientName || 'Unnamed patient'}
            </Text>
            <Text style={styles.reportMeta} numberOfLines={1}>
              {formatRelativeDateTime(item.createdAt)}
              {item.diagnosis ? ` · ${item.diagnosis}` : ''}
            </Text>
          </View>

          <View
            style={[
              styles.statusPill,
              isFinal ? styles.statusFinal : styles.statusDraft,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isFinal ? styles.statusTextFinal : styles.statusTextDraft,
              ]}
            >
              {isFinal ? 'FINAL' : 'DRAFT'}
            </Text>
          </View>

          <Text style={styles.chevron}>›</Text>
        </Pressable>
      );
    },
    [handleOpen, handleDelete],
  );

  const header = (
    <View>
      <View style={styles.greetingRow}>
        <View style={styles.greetingText}>
          <Text style={styles.greeting}>
            {greetingFor(new Date())}, <Text style={styles.doctor}>Doctor</Text>
          </Text>
          <Text style={styles.brand}>MedScribe</Text>
          <Text style={styles.brandSub}>Medical dictation assistant</Text>
        </View>

        <View style={styles.logoBadge}>
          <View style={styles.logoCrossVertical} />
          <View style={styles.logoCrossHorizontal} />
        </View>
      </View>

      <Text style={styles.readyLine}>Ready for your next consultation.</Text>

      <Pressable
        style={({ pressed }) => [styles.ctaCard, pressed && styles.pressed]}
        onPress={handleNewDictation}
        accessibilityRole="button"
        accessibilityLabel="Start new recording"
        accessibilityHint="Opens the dictation screen"
      >
        <View style={styles.ctaMic}>
          <MicGlyph size={26} color={colors.onPrimary} />
        </View>
        <View style={styles.ctaText}>
          <Text style={styles.ctaTitle}>Start New Recording</Text>
          <Text style={styles.ctaSubtitle}>Tap to begin a new dictation</Text>
        </View>
        <Text style={styles.ctaChevron}>›</Text>
      </Pressable>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadAll} accessibilityRole="button">
            <Text style={styles.linkText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statGrid}>
        <StatTile
          label="Total Reports"
          value={stats.total}
          glyph="▤"
          tint={colors.accentSoft}
          accent={colors.secondaryAccent}
        />
        <StatTile
          label="Today"
          value={stats.today}
          glyph="◷"
          tint={colors.violetSoft}
          accent={colors.violet}
        />
        <StatTile
          label="Drafts"
          value={stats.drafts}
          glyph="✎"
          tint={colors.warningSoft}
          accent={colors.warning}
        />
        <StatTile
          label="Finalized"
          value={stats.final}
          glyph="✓"
          tint={colors.successSoft}
          accent={colors.success}
        />
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        <QuickAction
          label="New Consultation"
          glyph="＋"
          tint={colors.accentSoft}
          accent={colors.secondaryAccent}
          onPress={handleNewDictation}
        />
        <QuickAction
          label="Search Patients"
          glyph="⌕"
          tint={colors.violetSoft}
          accent={colors.violet}
          active={searching}
          onPress={handleToggleSearch}
        />
        <QuickAction
          label="Pending Drafts"
          glyph="!"
          tint={colors.warningSoft}
          accent={colors.warning}
          active={draftsOnly}
          onPress={handleToggleDrafts}
        />
        <QuickAction
          label={showAll ? 'Recent Only' : 'All Reports'}
          glyph="▦"
          tint={colors.successSoft}
          accent={colors.success}
          active={showAll}
          onPress={handleShowAll}
        />
      </View>

      {searching ? (
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by patient or diagnosis"
          placeholderTextColor={colors.textMuted}
          autoFocus
          accessibilityLabel="Search saved reports"
        />
      ) : null}

      <View style={styles.listHeaderRow}>
        <Text style={styles.sectionTitle}>
          {draftsOnly ? 'Pending Drafts' : 'Recent Reports'}
        </Text>
        {reports.length > RECENT_LIMIT && !filtersActive ? (
          <Pressable onPress={handleShowAll} accessibilityRole="button">
            <Text style={styles.linkText}>{showAll ? 'Show less' : 'View all'}</Text>
          </Pressable>
        ) : null}
      </View>
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
            : 'Try a different search, or clear the filters above.'}
        </Text>
      </View>
    );

  return (
    <ScreenContainer>
      <FlatList
        data={visibleReports}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <View style={styles.fabRow} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={handleNewDictation}
          accessibilityRole="button"
          accessibilityLabel="Start a new dictation"
        >
          <MicGlyph size={30} color={colors.onPrimary} />
        </Pressable>
      </View>
    </ScreenContainer>
  );
};

const FAB_SIZE = 64;

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: FAB_SIZE + spacing.xl,
  },

  // ------------------------------------------------------------- greeting
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  greetingText: {
    flex: 1,
  },
  greeting: {
    ...typography.body,
    color: colors.textSecondary,
  },
  doctor: {
    color: colors.secondaryAccent,
    fontWeight: '600',
  },
  brand: {
    ...typography.largeHeading,
    textAlign: 'left',
    fontSize: 32,
    marginTop: 2,
  },
  brandSub: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCrossVertical: {
    position: 'absolute',
    width: 6,
    height: 24,
    borderRadius: 3,
    backgroundColor: colors.secondaryAccent,
  },
  logoCrossHorizontal: {
    position: 'absolute',
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.secondaryAccent,
  },
  readyLine: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  // ------------------------------------------------------------------ CTA
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryAccent,
    borderRadius: 18,
    padding: spacing.md,
    marginTop: spacing.md,
    elevation: 6,
    shadowColor: colors.primaryAccent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  ctaMic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 0.2,
  },
  ctaSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 2,
  },
  ctaChevron: {
    fontSize: 26,
    lineHeight: 28,
    color: colors.onPrimary,
  },

  // ---------------------------------------------------------------- stats
  sectionTitle: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    gap: 2,
  },
  statChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statGlyph: {
    fontSize: 17,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // -------------------------------------------------------- quick actions
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAction: {
    flexGrow: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  quickActionActive: {
    borderColor: colors.secondaryAccent,
  },
  quickChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGlyph: {
    fontSize: 15,
    fontWeight: '700',
  },
  quickLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // ---------------------------------------------------------------- list
  search: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reportBody: {
    flex: 1,
  },
  patientName: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '600',
  },
  reportMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDraft: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  statusFinal: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusTextDraft: {
    color: colors.warning,
  },
  statusTextFinal: {
    color: colors.success,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.textMuted,
    paddingHorizontal: 2,
  },

  // --------------------------------------------------------------- states
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.body,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyBody: {
    ...typography.mediumSubtitle,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondaryAccent,
  },

  // ------------------------------------------------------------------ fab
  fabRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.lg,
    alignItems: 'center',
  },
  fab: {
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
  },
  pressed: {
    opacity: 0.75,
  },
});

export default DashboardScreen;