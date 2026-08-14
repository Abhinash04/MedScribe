import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
  Animated,
  TextInput,
  Keyboard,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import IPCLogo from '../components/IPCLogo';
import BottomDock, { useDockClearance } from '../components/BottomDock';
import useStartConsultation from '../hooks/useStartConsultation';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useScaledStyles from '../hooks/useScaledStyles';
import createStyles from './styles/DashboardScreen.styles';

const MiniBarChart = ({ color, bars, styles }) => {
  const max = Math.max(...bars, 1);
  return (
    <View style={styles.miniBarChart}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={[
            styles.miniBar,
            {
              backgroundColor: color,
              height: (h / max) * 24,
              opacity: 0.35 + (i / bars.length) * 0.65,
            },
          ]}
        />
      ))}
    </View>
  );
};

const StatTile = ({ stat, styles }) => (
  <View style={styles.statTile}>
    <View style={styles.statTileHeader}>
      <View style={[styles.statChip, { backgroundColor: stat.bg }]}>
        <Icon name={stat.icon} size={20} color={stat.color} />
      </View>
      <MiniBarChart color={stat.color} bars={stat.bars} styles={styles} />
    </View>
    <View>
      <Text style={styles.statValue}>{stat.value}</Text>
      <Text style={styles.statLabel}>{stat.label}</Text>
      <Text style={styles.statSubLabel}>{stat.sub}</Text>
    </View>
  </View>
);

const QuickAction = ({ action, onPress, styles }) => (
  <Pressable style={styles.quickActionBtn} onPress={() => onPress(action.label)}>
    <View
      style={[
        styles.reportIconBox, // Reusing size shape
        { backgroundColor: action.bg, marginBottom: 8, marginRight: 0 },
      ]}
    >
      <Text style={{ fontSize: 22, color: action.color }}>{action.icon}</Text>
    </View>
    <Text style={[styles.quickActionLabel, { color: '#0f1628' }]}>{action.label}</Text>
  </Pressable>
);

const DashboardScreen = ({ navigation }) => {
  const styles = useScaledStyles(createStyles);
  const insets = useSafeAreaInsets();
  const reports = useReportsStore(state => state.reports);
  const loading = useReportsStore(state => state.loading);
  const loaded = useReportsStore(state => state.loaded);
  const error = useReportsStore(state => state.error);
  const loadAll = useReportsStore(state => state.loadAll);
  const remove = useReportsStore(state => state.remove);
  const restoreSession = useRecordingStore(state => state.restoreSession);
  const startConsultation = useStartConsultation();
  const clearance = useDockClearance();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [unfinished, setUnfinished] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good Morning';
    }
    return hour < 17 ? 'Good Afternoon' : 'Good Evening';
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
      Keyboard.dismiss();
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

  const statsObj = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    return {
      total: reports.length,
      today: reports.filter(report => report.createdAt >= todayMs).length,
      drafts: reports.filter(report => report.status !== REPORT_STATUS.FINAL).length,
      final: reports.filter(report => report.status === REPORT_STATUS.FINAL).length,
    };
  }, [reports]);

  const statsList = [
    { label: 'Total Reports', sub: 'All time', value: statsObj.total, color: '#6c63ff', bg: '#ede9ff', icon: 'file-text', bars: [3, 5, 4, 6, 5, 7] },
    { label: "Today's", sub: 'Generated today', value: statsObj.today, color: '#06b6d4', bg: '#e0f9ff', icon: 'clock', bars: [2, 3, 2, 4, 3, 5] },
    { label: 'Drafts', sub: 'Pending reports', value: statsObj.drafts, color: '#f97316', bg: '#fff0e6', icon: 'edit-2', bars: [4, 3, 5, 3, 4, 2] },
    { label: 'Finalized', sub: 'Completed reports', value: statsObj.final, color: '#10b981', bg: '#e6f9f2', icon: 'check-circle', bars: [2, 4, 3, 5, 4, 6] },
  ];

  const quickActions = [
    { icon: '🔍', label: 'Search', color: '#6c63ff', bg: '#ede9ff' },
    { icon: '✏️', label: 'Drafts', color: '#f97316', bg: '#fff0e6' },
    // { icon: '🗓️', label: 'Schedule', color: '#06b6d4', bg: '#e0f9ff' },
    // { icon: '📝', label: 'Templates', color: '#10b981', bg: '#e6f9f2' },
  ];

  const visibleReports = useMemo(() => {
    let filtered = reports;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        r =>
          (r.patientName || '').toLowerCase().includes(q) ||
          (r.consultationType || '').toLowerCase().includes(q)
      );
    }
    if (activeTab === 'finalized') {
      filtered = filtered.filter(r => r.status === REPORT_STATUS.FINAL);
    } else if (activeTab === 'drafts') {
      filtered = filtered.filter(r => r.status !== REPORT_STATUS.FINAL);
    }
    return searchQuery.trim().length > 0 ? filtered : filtered.slice(0, 5); // Limit to recent 5 if not searching
  }, [reports, activeTab, searchQuery]);

  const handleOpen = useCallback(
    id => navigation.navigate('Report', { reportId: id }),
    [navigation],
  );

  const handleQuickAction = useCallback((label) => {
    if (label === 'Search') {
      navigation.navigate('Patients');
    } else if (label === 'Drafts') {
      navigation.navigate('Reports', { filter: 'drafts' });
    }
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }) => {
      const isFinal = item.status === REPORT_STATUS.FINAL;
      return (
        <Pressable style={styles.reportRow} onPress={() => handleOpen(item.id)}>
          <View
            style={[
              styles.reportIconBox,
              { backgroundColor: isFinal ? '#e6f9f2' : '#fff0e6' },
            ]}
          >
            <Text style={styles.reportIconText}>{isFinal ? '✅' : '✏️'}</Text>
          </View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportName}>{item.patientName || 'Unnamed Patient'}</Text>
            <Text style={styles.reportMeta}>
              {item.consultationType || 'General'} · Age {item.patientAge || '--'}
            </Text>
          </View>
          <View style={styles.reportStatusBox}>
            <View
              style={[
                styles.reportStatusBadge,
                { backgroundColor: isFinal ? '#e6f9f2' : '#fff0e6' },
              ]}
            >
              <Text
                style={[
                  styles.reportStatusText,
                  { color: isFinal ? '#10b981' : '#f97316' },
                ]}
              >
                {isFinal ? 'Finalized' : 'Draft'}
              </Text>
            </View>
            <Text style={styles.reportTime}>{formatRelativeDateTime(item.createdAt)}</Text>
          </View>
        </Pressable>
      );
    },
    [handleOpen, styles],
  );

  const header = (
    <View style={styles.pageBackground}>
      <LinearGradient
        colors={['#6c63ff', '#8b5cf6', '#a78bfa']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.heroDecorCircle1} />
        <View style={styles.heroDecorCircle2} />
        <View style={styles.heroDecorCircle3} />

        <View style={styles.heroTopRow}>
          <View>
            <View style={styles.greetingPill}>
              <Animated.View style={[styles.greetingDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.greetingText}>{greeting}, Doctor</Text>
            </View>
            <Text style={styles.brandTitle}>MedScribe</Text>
            <Text style={styles.brandSub}>Medical Dictation Assistant</Text>
          </View>
          <View style={styles.bellBtn}>
            <IPCLogo size={44} />
          </View>
        </View>

        <View style={styles.searchBar}>
          <Icon name="search" size={18} color="rgba(255,255,255,0.7)" />
          <TextInput
            style={[styles.searchText, { flex: 1, color: '#fff', padding: 0 }]}
            placeholder="Search patients, reports…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>
      </LinearGradient>

      <View style={styles.recordCardContainer}>
        <Pressable style={styles.recordBtn} onPress={startConsultation}>
          <LinearGradient
            colors={['#6c63ff', '#a78bfa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.recordIconBg}
          >
            <Icon name="mic" size={22} color="#fff" />
          </LinearGradient>
          <View style={styles.recordTextCol}>
            <Text style={styles.recordTitle}>Start New Recording</Text>
            <Text style={styles.recordSubtitle}>Tap to begin a new dictation</Text>
          </View>
          <View style={styles.recordChevronBg}>
            <Icon name="chevron-right" size={18} color="#6c63ff" />
          </View>
        </Pressable>
      </View>

      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.sectionSubtitle}>Quick summary of your reports</Text>
          </View>
          <View style={styles.weekBtn}>
            <Text style={styles.weekBtnText}>This week</Text>
          </View>
        </View>
        <View style={styles.statGrid}>
          {statsList.map((s, i) => (
            <StatTile key={i} stat={s} styles={styles} />
          ))}
        </View>
      </View>

      <View style={styles.quickActionsContainer}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {quickActions.map((a, i) => (
            <QuickAction key={i} action={a} onPress={handleQuickAction} styles={styles} />
          ))}
        </View>
      </View>

      <View style={styles.recentReportsContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Reports</Text>
          <Pressable onPress={() => navigation.navigate('Reports')}>
            <Text style={styles.viewAllBtnText}>View all →</Text>
          </Pressable>
        </View>

        <View style={styles.tabsRow}>
          {['all', 'finalized', 'drafts'].map(tab => (
            <Pressable
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === tab && styles.tabBtnTextActive,
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  const empty =
    loading && !loaded ? (
      <View style={styles.emptyCard}>
        <ActivityIndicator color="#6c63ff" />
      </View>
    ) : error ? (
      <View style={[styles.recentReportsContainer, { paddingTop: 0 }]}>
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={loadAll}
            accessibilityRole="button"
            accessibilityLabel="Try loading reports again"
          >
            <Text style={styles.linkText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    ) : (
      <View style={[styles.recentReportsContainer, { paddingTop: 0 }]}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>No reports here</Text>
          {/* <Text style={styles.emptyBody}>Try a different filter</Text> */}
        </View>
      </View>
    );

  const footer = (
    <View style={{ paddingBottom: clearance }} />
  );

  return (
    <View style={styles.pageBackground}>
      <FlatList
        data={visibleReports}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
      <BottomDock active="Dashboard" />
    </View>
  );
};

export default DashboardScreen;
