import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import IPCLogo from '../components/IPCLogo';
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
import { colors } from '../theme';
import { formatRelativeDateTime } from '../utils/datetime';
import styles from './styles/DashboardScreen.styles';

const RECENT_LIMIT = 3;

const AVATAR_TINTS = [
  { fill: colors.accentSoft, text: colors.secondaryAccent },
  { fill: colors.violetSoft, text: colors.violet },
  { fill: colors.warningSoft, text: colors.warningText },
  { fill: colors.successSoft, text: colors.successText },
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
    <View style={[styles.bar, styles.bar1, { backgroundColor: color }]} />
    <View style={[styles.bar, styles.bar2, { backgroundColor: color }]} />
    <View style={[styles.bar, styles.bar3, { backgroundColor: color }]} />
    <View style={[styles.bar, styles.bar4, { backgroundColor: color }]} />
  </View>
);

const StatTile = ({
  label,
  subLabel,
  value,
  tint,
  accent,
  glyph = accent,
  iconName,
}) => (
  <View style={styles.statTile}>
    <View style={styles.statTileHeader}>
      <View style={[styles.statChip, { backgroundColor: tint }]}>
        <Icon name={iconName} size={16} color={glyph} />
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

const QuickAction = ({
  label,
  subLabel,
  iconName,
  accent,
  glyph = accent,
  tint,
  active,
  onPress,
  style,
}) => (
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
    <View
      style={[styles.quickChip, { backgroundColor: tint, borderColor: accent }]}
    >
      <Icon name={iconName} size={22} color={glyph} />
    </View>
    <Text style={styles.quickLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.quickSubLabel} numberOfLines={1}>
      {subLabel}
    </Text>
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

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

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
    resetRecording();
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
          <IPCLogo size={42} />
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
            <View style={[styles.waveBar, styles.waveBar8]} />
            <View style={[styles.waveBar, styles.waveBar16]} />
            <View style={[styles.waveBar, styles.waveBar12]} />
            <View style={[styles.waveBar, styles.waveBar20]} />
          </View>

          <View style={styles.ctaMic}>
            <MicGlyph size={28} color="#2F6BFF" />
          </View>

          <View style={styles.waveContainerRight}>
            <View style={[styles.waveBar, styles.waveBar20]} />
            <View style={[styles.waveBar, styles.waveBar12]} />
            <View style={[styles.waveBar, styles.waveBar16]} />
            <View style={[styles.waveBar, styles.waveBar8]} />
          </View>

          <View style={styles.ctaText}>
            <Text
              style={styles.ctaTitle}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              Start New Recording
            </Text>
            <Text style={styles.ctaSubtitle} numberOfLines={2}>
              Tap to begin a new dictation
            </Text>
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
              style={({ pressed }) => [
                styles.resumeBtn,
                pressed && styles.pressed,
              ]}
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
            <View
              style={[
                styles.overviewIconContainer,
                { backgroundColor: colors.violetSoft },
              ]}
            >
              <Icon name="bar-chart-2" size={20} color={colors.violet} />
            </View>
            <View style={styles.overviewHeaderText}>
              <Text style={styles.overviewTitle}>Overview</Text>
              <Text style={styles.overviewSubtitle}>
                Quick summary of your reports
              </Text>
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
            glyph={colors.warningText}
          />
          <StatTile
            label="Finalized"
            subLabel="Completed reports"
            value={stats.final}
            iconName="check"
            tint={colors.successSoft}
            accent={colors.success}
            glyph={colors.successText}
          />
        </View>
      </View>

      <View style={styles.quickActionsHeader}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
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
          glyph={colors.warningText}
          active={draftsOnly}
          onPress={handleToggleDrafts}
          style={styles.quickBorderRight}
        />
        {/* {__DEV__ ? (
          <QuickAction
            label="STT Measure"
            subLabel="Speech to Text analytics"
            iconName="file-text"
            tint={colors.successSoft}
            accent={colors.success}
            glyph={colors.successText}
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
            glyph={colors.warningText}
            onPress={() => navigation.navigate('MicSpike')}
            style={styles.quickBorderRight}
          />
        ) : null} */}
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
            <Text style={styles.linkText}>
              {showAll ? 'Show less' : 'View all'}
            </Text>
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

export default DashboardScreen;
