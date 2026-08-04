import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppHeader from '../components/AppHeader';
import ScreenContainer from '../components/ScreenContainer';
import {
  RESTART_DELAY_MS,
  isTransientError,
} from '../constants/recordingStates';
import { CRITICAL_VALUES, FIXTURE_SCRIPT } from '../dev/dictationFixture';
import { buildReport } from '../dev/sttMetrics';
import {
  checkMicPermission,
  isGranted,
  requestMicPermission,
  RESULTS,
} from '../services/permissionService';
import * as speech from '../services/speechService';
import { colors, spacing, typography } from '../theme';

const SAFETY_STOP_MS = 90000;

const emptyCounters = () => ({
  starts: 0,
  ready: 0,
  begin: 0,
  ends: 0,
  restarts: 0,
  partials: 0,
  finals: 0,
  errorsByCode: {},
  fatal: 0,
});

const SttBaselineScreen = ({ navigation }) => {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [counters, setCounters] = useState(emptyCounters());
  const [report, setReport] = useState(null);
  const [label, setLabel] = useState('baseline');

  const countersRef = useRef(emptyCounters());
  const finalsRef = useRef([]);
  const gapsRef = useRef([]);
  const gapOpenedAtRef = useRef(0);
  const activeRef = useRef(false);
  const restartTimerRef = useRef(null);
  const tickRef = useRef(null);
  const startedAtRef = useRef(0);

  const clearRestart = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const safeStart = useCallback(async () => {
    if (!activeRef.current) {
      return;
    }
    try {
      await speech.start();
      countersRef.current.starts += 1;
    } catch (error) {
      if (String(error?.code ?? '') !== 'ALREADY_LISTENING') {
        console.log('[STT-BASE]', 'start rejected', error?.code, error?.message);
      }
    }
  }, []);

  const scheduleRestart = useCallback(() => {
    if (!activeRef.current || restartTimerRef.current) {
      return;
    }
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      countersRef.current.restarts += 1;
      safeStart();
    }, RESTART_DELAY_MS);
  }, [safeStart]);

  const openGap = useCallback(() => {
    if (activeRef.current && !gapOpenedAtRef.current) {
      gapOpenedAtRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    const unsubscribe = speech.subscribe({
      onStart: () => {
        countersRef.current.ready += 1;
        if (gapOpenedAtRef.current) {
          gapsRef.current.push(Date.now() - gapOpenedAtRef.current);
          gapOpenedAtRef.current = 0;
        }
        clearRestart();
      },
      onBegin: () => {
        countersRef.current.begin += 1;
        clearRestart();
      },
      onEnd: () => {
        countersRef.current.ends += 1;
        openGap();
        if (activeRef.current) {
          scheduleRestart();
        }
      },
      onResults: text => {
        if (text && activeRef.current) {
          countersRef.current.finals += 1;
          finalsRef.current.push(text);
          console.log('[STT-BASE]', 'final:', text);
        }
        openGap();
        if (activeRef.current) {
          scheduleRestart();
        }
      },
      onPartialResults: text => {
        if (text && activeRef.current) {
          countersRef.current.partials += 1;
        }
      },
      onError: ({ code, message }) => {
        if (!activeRef.current) {
          return;
        }
        const current = countersRef.current;
        current.errorsByCode[code] = (current.errorsByCode[code] ?? 0) + 1;
        if (!isTransientError(code)) {
          current.fatal += 1;
          console.log('[STT-BASE]', 'FATAL', code, message);
        }
        openGap();
        scheduleRestart();
      },
    });

    return () => {
      unsubscribe();
      speech.stop().catch(() => {});
    };
  }, [clearRestart, openGap, scheduleRestart]);

  const finish = useCallback(async () => {
    activeRef.current = false;
    clearRestart();
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    try {
      await speech.stop();
    } catch {}

    const transcript = finalsRef.current.join(' ').trim();
    const built = buildReport({
      transcript,
      finals: finalsRef.current,
      gaps: gapsRef.current,
      counters: countersRef.current,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
    });
    built.label = label;
    built.durationMs = Date.now() - startedAtRef.current;
    setReport(built);
    console.log('[STT-BASE-REPORT]', JSON.stringify(built));
    setRunning(false);
  }, [clearRestart, label]);

  const handleStart = useCallback(async () => {
    let permission = await checkMicPermission();
    if (permission === RESULTS.DENIED) {
      permission = await requestMicPermission();
    }
    if (!isGranted(permission)) {
      console.log('[STT-BASE]', 'permission not granted', permission);
      return;
    }

    countersRef.current = emptyCounters();
    finalsRef.current = [];
    gapsRef.current = [];
    gapOpenedAtRef.current = 0;
    startedAtRef.current = Date.now();
    setCounters(countersRef.current);
    setReport(null);
    setRunning(true);
    activeRef.current = true;

    tickRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAtRef.current);
      setCounters({
        ...countersRef.current,
        errorsByCode: { ...countersRef.current.errorsByCode },
      });
      if (Date.now() - startedAtRef.current >= SAFETY_STOP_MS) {
        finish();
      }
    }, 500);

    await safeStart();
  }, [finish, safeStart]);

  useEffect(
    () => () => {
      activeRef.current = false;
      clearRestart();
      if (tickRef.current) {
        clearInterval(tickRef.current);
      }
    },
    [clearRestart],
  );

  const errorSummary = Object.entries(counters.errorsByCode)
    .map(([code, count]) => `${code}×${count}`)
    .join(' ');

  return (
    <ScreenContainer>
      <AppHeader showBack onBackPress={() => navigation.goBack()} title="STT Measure" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.scriptBox}>
          <Text style={styles.scriptLabel}>READ EXACTLY THIS, ONCE, THEN TAP STOP</Text>
          <Text style={styles.script} selectable>
            {FIXTURE_SCRIPT}
          </Text>
        </View>

        <View style={styles.row}>
          {['baseline', 'patch A', 'patch B', 'patch C'].map(item => (
            <Pressable
              key={item}
              style={[styles.tag, label === item && styles.tagActive]}
              onPress={() => setLabel(item)}
              disabled={running}
            >
              <Text style={[styles.tagText, label === item && styles.tagTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <Pressable
            style={[styles.button, running && styles.buttonDisabled]}
            onPress={handleStart}
            disabled={running}
          >
            <Text style={styles.buttonText}>Start</Text>
          </Pressable>
          <Pressable
            style={[styles.button, !running && styles.buttonDisabled]}
            onPress={finish}
            disabled={!running}
          >
            <Text style={styles.buttonText}>Stop &amp; score</Text>
          </Pressable>
        </View>

        {running ? (
          <Text style={styles.mono}>
            {`${Math.floor(elapsed / 1000)}s · sessions ${counters.ready} · restarts ${counters.restarts}\n` +
              `partials ${counters.partials} · finals ${counters.finals} · errors ${errorSummary || 'none'}`}
          </Text>
        ) : null}

        {report ? (
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>{report.label}</Text>
            <Text style={styles.metricBig}>
              Overall word recall: {report.overallRecall}% ({report.overallHits})
            </Text>
            <Text
              style={[
                styles.metricBig,
                report.criticalRecall.split('/')[0] === report.criticalRecall.split('/')[1]
                  ? styles.good
                  : styles.bad,
              ]}
            >
              Critical-value recall: {report.criticalRecall}
            </Text>

            {CRITICAL_VALUES.map(value => {
              const hit = report.criticalDetail.find(item => item.key === value.key);
              return (
                <Text key={value.key} style={styles.mono}>
                  {hit?.found ? '✓' : '✗'} {value.label}
                </Text>
              );
            })}

            <Text style={styles.mono}>
              {`\nsessions ${report.sessions} · restarts ${report.restarts}\n` +
                `median gap ${report.medianGapMs}ms · max gap ${report.maxGapMs}ms (${report.measuredGaps} measured)\n` +
                `duplicate words ${report.duplicateWords}${report.duplicateExamples.length ? ` (${report.duplicateExamples.join(' | ')})` : ''}\n` +
                `partials ${report.partials} · finals ${report.finals}\n` +
                `errors ${Object.entries(report.errorsByCode).map(([c, n]) => `${c}×${n}`).join(' ') || 'none'} · fatal ${report.fatalErrors}\n` +
                `locale ${report.locale} · duration ${Math.round(report.durationMs / 1000)}s`}
            </Text>

            {report.missingWords.length ? (
              <Text style={styles.mono}>missing: {report.missingWords.join(' ')}</Text>
            ) : null}

            <Text style={styles.transcript} selectable>
              {report.transcript || '— nothing transcribed —'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl, gap: spacing.xs },
  scriptBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  scriptLabel: { fontSize: 10, fontWeight: '700', color: colors.primaryAccent, letterSpacing: 0.8 },
  script: { ...typography.body, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  tagActive: { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent },
  tagText: { fontSize: 12, color: colors.textSecondary },
  tagTextActive: { color: colors.onPrimary, fontWeight: '700' },
  button: {
    backgroundColor: colors.primaryAccent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  reportCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.md,
    gap: 2,
  },
  reportTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase' },
  metricBig: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  good: { color: colors.success },
  bad: { color: colors.danger },
  mono: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  transcript: { fontSize: 12, color: colors.textPrimary, fontStyle: 'italic', marginTop: spacing.xs },
});

export default SttBaselineScreen;
