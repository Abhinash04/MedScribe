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
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import MicGlyph from '../components/MicGlyph';
import ScreenContainer from '../components/ScreenContainer';
import { REPORT_STATUS } from '../db/reportsRepository';
import { purgeAbandoned } from '../services/consultationAudio';
import { clearRefinementState } from '../services/transcriptRefinement';
import {
  clearActiveSession,
  getActiveSession,
} from '../services/sessionPersistenceService';
import useRecordingStore, {
  CONSULTATION_STAGE,
} from '../store/useRecordingStore';
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

const MiniBarChart = ({ color }) => (
  <View style={styles.miniBarChart}>
    <View style={[styles.bar, { height: 8, backgroundColor: color, opacity: 0.3 }]} />
    <View style={[styles.bar, { height: 14, backgroundColor: color, opacity: 0.5 }]} />
    <View style={[styles.bar, { height: 20, backgroundColor: color, opacity: 0.7 }]} />
    <View style={[styles.bar, { height: 26, backgroundColor: color, opacity: 1 }]} />
  </View>
);

const StatTile = ({ label, subLabel, value, tint, accent, iconName }) => (
  <View style={styles.statTile}>
    <View style={styles.statTileHeader}>
      <View style={[styles.statChip, { backgroundColor: tint }]}>
        <Icon name={iconName} size={16} color={accent} />
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
    </View>
    <View style={styles.statTileBody}>
      <View style={styles.statTileTextGroup}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statSubLabel}>{subLabel}</Text>
      </View>
      <MiniBarChart color={accent} />
    </View>
  </View>
);

const QuickAction = ({ label, subLabel, iconName, accent, tint, active, onPress, style }) => (
  <Pressable
    style={({ pressed }) => [
      styles.quickAction,
      style,
      active && styles.quickActionActive,
      pressed && styles.pressed,
    ]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected: !!active }}
  >
    <View style={[styles.quickChip, { backgroundColor: tint, borderColor: accent }]}>
      <Icon name={iconName} size={22} color={accent} />
    </View>
    <Text style={styles.quickLabel} numberOfLines={1}>{label}</Text>
    <Text style={styles.quickSubLabel} numberOfLines={1}>{subLabel}</Text>
    <View style={[styles.quickIndicator, { backgroundColor: accent }]} />
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
  const restoreSession = useRecordingStore(state => state.restoreSession);

  const [unfinished, setUnfinished] = useState(null);
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

  // An interrupted consultation is offered here as well as on the recording
  // screen, because a crash on the report screen leaves nothing else to find.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const active = await getActiveSession();
        if (!cancelled) {
          setUnfinished(active?.segments?.length ? active : null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
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
    // A new consultation must never append onto the previous one's transcript.
    clearRefinementState();
    navigation.navigate('Recording');
  }, [resetRecording, navigation]);

  const handleOpen = useCallback(
    id => navigation.navigate('Report', { reportId: id }),
    [navigation],
  );

  const handleResumeUnfinished = useCallback(() => {
    if (!unfinished) {
      return;
    }
    restoreSession(unfinished);
    setUnfinished(null);
    if (unfinished.stage === CONSULTATION_STAGE.REPORT) {
      navigation.navigate('Report');
    } else if (unfinished.stage === CONSULTATION_STAGE.REVIEW) {
      navigation.navigate('TranscriptReview');
    } else {
      navigation.navigate('Recording', { resume: true });
    }
  }, [unfinished, restoreSession, navigation]);

  const handleDiscardUnfinished = useCallback(() => {
    Alert.alert(
      'Discard this consultation?',
      'The dictation and any report details captured for it will be removed.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await clearActiveSession(unfinished?.id);
            // Discarding the only unfinished consultation means no consultation
            // audio should survive it, and after a restart the path is no
            // longer known in memory.
            await purgeAbandoned(0);
            clearRefinementState();
            setUnfinished(null);
          },
        },
      ],
    );
  }, [unfinished]);

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
    // Read from the closure rather than nesting setQuery inside the setSearching
    // updater: React may invoke an updater twice, and a side effect in there
    // runs twice with it.
    if (searching) {
      setQuery('');
    }
    setSearching(!searching);
  }, [searching]);

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
          accessibilityLabel={`Open report for ${item.patientName || 'unnamed patient'
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

          <Icon name="chevron-right" size={20} color={colors.textMuted} />
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
        style={({ pressed }) => [styles.ctaWrapper, pressed && styles.pressed]}
        onPress={handleNewDictation}
        accessibilityRole="button"
        accessibilityLabel="Start new recording"
        accessibilityHint="Opens the dictation screen"
      >
        <LinearGradient
          colors={['#2F6BFF', '#7C4DFF']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.ctaCard}
        >
          <View style={styles.waveContainerLeft}>
            <View style={[styles.waveBar, { height: 8 }]} />
            <View style={[styles.waveBar, { height: 16 }]} />
            <View style={[styles.waveBar, { height: 12 }]} />
            <View style={[styles.waveBar, { height: 20 }]} />
          </View>
          
          <View style={styles.ctaMic}>
            <MicGlyph size={28} color="#2F6BFF" />
          </View>
          
          <View style={styles.waveContainerRight}>
            <View style={[styles.waveBar, { height: 20 }]} />
            <View style={[styles.waveBar, { height: 12 }]} />
            <View style={[styles.waveBar, { height: 16 }]} />
            <View style={[styles.waveBar, { height: 8 }]} />
          </View>

          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>Start New Recording</Text>
            <Text style={styles.ctaSubtitle} numberOfLines={2}>Tap to begin a new dictation</Text>
          </View>
          
          <View style={styles.ctaChevronContainer}>
            <Text style={styles.ctaChevron}>›</Text>
          </View>
        </LinearGradient>
      </Pressable>

      {unfinished ? (
        <View style={styles.resumeCard}>
          <Text style={styles.resumeTitle}>Unfinished consultation</Text>
          <Text style={styles.resumeMeta}>
            {formatRelativeDateTime(unfinished.updatedAt)} ·{' '}
            {unfinished.segments.length}{' '}
            {unfinished.segments.length === 1 ? 'utterance' : 'utterances'}
          </Text>
          <View style={styles.resumeActions}>
            <Pressable
              style={({ pressed }) => [styles.resumeBtn, pressed && styles.pressed]}
              onPress={handleResumeUnfinished}
              accessibilityRole="button"
              accessibilityLabel="Resume the unfinished consultation"
            >
              <Text style={styles.resumeBtnText}>Resume</Text>
            </Pressable>
            <Pressable
              onPress={handleDiscardUnfinished}
              accessibilityRole="button"
              accessibilityLabel="Discard the unfinished consultation"
            >
              <Text style={styles.linkText}>Discard</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadAll} accessibilityRole="button">
            <Text style={styles.linkText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.overviewContainer}>
        <View style={styles.overviewHeader}>
          <View style={styles.overviewHeaderLeft}>
            <View style={[styles.overviewIconContainer, { backgroundColor: colors.violetSoft }]}>
               <Icon name="bar-chart-2" size={20} color={colors.violet} />
            </View>
            <View style={styles.overviewHeaderText}>
              <Text style={styles.overviewTitle}>Overview</Text>
              <Text style={styles.overviewSubtitle}>Quick summary of your reports</Text>
            </View>
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatTile
            label="Total Reports"
            subLabel="All time"
            value={stats.total}
            iconName="file-text"
            tint={colors.accentSoft}
            accent={colors.secondaryAccent}
          />
          <StatTile
            label="Today"
            subLabel="Generated today"
            value={stats.today}
            iconName="clock"
            tint={colors.violetSoft}
            accent={colors.violet}
          />
          <StatTile
            label="Drafts"
            subLabel="Pending reports"
            value={stats.drafts}
            iconName="edit-2"
            tint={colors.warningSoft}
            accent={colors.warning}
          />
          <StatTile
            label="Finalized"
            subLabel="Completed reports"
            value={stats.final}
            iconName="check"
            tint={colors.successSoft}
            accent={colors.success}
          />
        </View>
      </View>

      <View style={styles.quickActionsHeader}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        <Text style={styles.viewAllTextQuick}>View All ›</Text>
      </View>
      
      <View style={styles.quickGrid}>
        <QuickAction
          label="New Consultation"
          subLabel="Start a new dictation"
          iconName="plus"
          tint={colors.violetSoft}
          accent={colors.secondaryAccent}
          onPress={handleNewDictation}
          style={styles.quickBorderRight}
        />
        <QuickAction
          label="Search Patients"
          subLabel="Find existing patients"
          iconName="search"
          tint={colors.violetSoft}
          accent={colors.secondaryAccent}
          active={searching}
          onPress={handleToggleSearch}
        />
        <QuickAction
          label="Pending Drafts"
          subLabel="Continue incomplete reports"
          iconName="alert-circle"
          tint={colors.warningSoft}
          accent={colors.warning}
          active={draftsOnly}
          onPress={handleToggleDrafts}
          style={styles.quickBorderRight}
        />
        {__DEV__ ? (
          <QuickAction
            label="STT Measure"
            subLabel="Speech to Text analytics"
            iconName="file-text"
            tint={colors.successSoft}
            accent={colors.success}
            onPress={() => navigation.navigate('SttMeasure')}
          />
        ) : null}
        {__DEV__ ? (
          <QuickAction
            label="Mic Spike"
            subLabel="Audio quality monitor"
            iconName="activity"
            tint={colors.warningSoft}
            accent={colors.warning}
            onPress={() => navigation.navigate('MicSpike')}
            style={styles.quickBorderRight}
          />
        ) : null}
        <QuickAction
          label={showAll ? 'Recent Only' : 'All Reports'}
          subLabel="View and manage reports"
          iconName="folder"
          tint={colors.infoLight}
          accent={colors.info}
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
    backgroundColor: colors.surfaceSoft,
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
  ctaWrapper: {
    marginTop: spacing.md,
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  waveContainerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 8,
  },
  waveContainerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 8,
    marginRight: 8,
  },
  waveBar: {
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 1,
  },
  ctaMic: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    flex: 1,
    marginRight: 6,
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  ctaSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  ctaChevronContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaChevron: {
    fontSize: 22,
    lineHeight: 24,
    color: '#7C4DFF',
    marginLeft: 2, // optical center for chevron
  },

  // ---------------------------------------------------------------- overview
  overviewContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: spacing.md,
    marginTop: spacing.lg,
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingHorizontal: 4,
  },
  overviewHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  overviewHeaderText: {
    flex: 1,
  },
  overviewIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  overviewSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: '#000000',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  statTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTileLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  statTileBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statTileTextGroup: {
    flex: 1,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statSubLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  miniBarChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 26,
  },
  bar: {
    width: 5,
    borderRadius: 2.5,
  },

  // -------------------------------------------------------- quick actions
  quickActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  quickActionsTitle: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: '#000000',
  },
  viewAllTextQuick: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondaryAccent,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: spacing.md,
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickAction: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  quickBorderRight: {
    borderRightWidth: 1,
    borderColor: '#F0F0F0',
  },
  quickActionActive: {
    backgroundColor: colors.primarySoft,
  },
  quickChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  quickSubLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 10,
  },
  quickIndicator: {
    width: 28,
    height: 2,
    borderRadius: 1,
  },

  // ---------------------------------------------------------------- list
  search: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    padding: spacing.md,
    paddingRight: 12,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reportBody: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reportMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextDraft: {
    color: colors.warning,
  },
  statusTextFinal: {
    color: colors.success,
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
  resumeCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.secondaryAccent,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  resumeTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resumeMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  resumeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  resumeBtn: {
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  resumeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
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