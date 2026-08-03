import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppHeader from '../components/AppHeader';
import ScreenContainer from '../components/ScreenContainer';
import {
  RESTART_DELAY_MS,
  isTransientError,
} from '../constants/recordingStates';
import * as capture from '../services/audioCaptureService';
import { AUDIO_SOURCES } from '../services/audioCaptureService';
import {
  checkMicPermission,
  isGranted,
  requestMicPermission,
  RESULTS,
} from '../services/permissionService';
import * as speech from '../services/speechService';
import { colors, spacing, typography } from '../theme';

const PHASE_MS = 30000;
const SAMPLE_RATE = 16000;

export const SCRIPT =
  'Patient name is Hema Sharma. Age twenty two years. Gender female. ' +
  'Address is Sector twelve Dwarka New Delhi. Complains of fever cough and headache. ' +
  'Medical history of diabetes. Diagnosis is viral infection.';

const SCRIPT_WORDS = SCRIPT.toLowerCase().replace(/[.,]/g, '').split(/\s+/);

const PHASES = [
  {
    id: 'A',
    label: 'A · Recognizer only',
    hint: 'No capture. This is the baseline every other phase is scored against.',
    capture: null,
    captureDelayMs: 0,
  },
  {
    id: 'B',
    label: 'B · Recognizer + capture (MIC)',
    hint: 'Reproduces the first spike run under measurement.',
    capture: AUDIO_SOURCES.MIC,
    captureDelayMs: 0,
  },
  {
    id: 'C',
    label: 'C · Recognizer + capture (VOICE_RECOGNITION)',
    hint: 'Does the audio source change which client gets silenced?',
    capture: AUDIO_SOURCES.VOICE_RECOGNITION,
    captureDelayMs: 0,
  },
  {
    id: 'D',
    label: 'D · Capture starts 5 s late (MIC)',
    hint: 'Is the loser decided by start order?',
    capture: AUDIO_SOURCES.MIC,
    captureDelayMs: 5000,
  },
];

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
  text: '',
  lastFinalAt: 0,
  longestSilenceMs: 0,
});

function wordRecall(text) {
  if (!text) {
    return 0;
  }
  const heard = new Set(text.toLowerCase().replace(/[.,]/g, '').split(/\s+/));
  const hits = SCRIPT_WORDS.filter(word => heard.has(word)).length;
  return hits / SCRIPT_WORDS.length;
}

function scorePhase(phase, baselineRecall) {
  const { counters, stats } = phase;
  const recall = wordRecall(counters.text);
  const beginRatio = counters.ready > 0 ? counters.begin / counters.ready : 0;
  const meaningful =
    recall >= 0.6 && beginRatio >= 0.5 && counters.longestSilenceMs <= 20000;
  const relative = baselineRecall > 0 ? recall / baselineRecall : null;

  return {
    recall,
    beginRatio,
    meaningful,
    relative,
    degraded: relative !== null && relative < 0.7,
    silenced: stats ? stats.silencedSamples > 0 : null,
    audible: stats ? stats.silentRatio < 0.5 && stats.peakAmplitude > 1500 : null,
  };
}

const MicSpikeScreen = ({ navigation }) => {
  const [phaseIndex, setPhaseIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [results, setResults] = useState([]);
  const [live, setLive] = useState(emptyCounters());
  const [log, setLog] = useState([]);

  const countersRef = useRef(emptyCounters());
  const activeRef = useRef(false);
  const restartTimerRef = useRef(null);
  const phaseTimerRef = useRef(null);
  const tickRef = useRef(null);
  const captureDelayRef = useRef(null);
  const capturingRef = useRef(false);
  const resolvePhaseRef = useRef(null);
  const abortedRef = useRef(false);

  const addLog = useCallback(line => {
    console.log('[SPIKE2]', line);
    setLog(previous => [`${new Date().toISOString().slice(11, 19)} ${line}`, ...previous].slice(0, 80));
  }, []);

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
      const code = String(error?.code ?? '');
      if (code !== 'ALREADY_LISTENING') {
        addLog(`start rejected: ${code}`);
      }
    }
  }, [addLog]);

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

  useEffect(() => {
    const unsubscribe = speech.subscribe({
      onStart: () => {
        countersRef.current.ready += 1;
        clearRestart();
      },
      onBegin: () => {
        countersRef.current.begin += 1;
        clearRestart();
      },
      onEnd: () => {
        countersRef.current.ends += 1;
        if (activeRef.current) {
          scheduleRestart();
        }
      },
      onResults: text => {
        if (text && activeRef.current) {
          const now = Date.now();
          const counters = countersRef.current;
          counters.finals += 1;
          counters.text = `${counters.text} ${text}`.trim();
          if (counters.lastFinalAt) {
            counters.longestSilenceMs = Math.max(
              counters.longestSilenceMs,
              now - counters.lastFinalAt,
            );
          }
          counters.lastFinalAt = now;
          addLog(`final: ${text}`);
        }
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
        const counters = countersRef.current;
        counters.errorsByCode[code] = (counters.errorsByCode[code] ?? 0) + 1;
        if (!isTransientError(code)) {
          counters.fatal += 1;
          addLog(`FATAL error ${code}: ${message}`);
        }
        scheduleRestart();
      },
    });

    return () => {
      unsubscribe();
      speech.stop().catch(() => {});
    };
  }, [addLog, clearRestart, scheduleRestart]);

  const stopPhase = useCallback(async () => {
    activeRef.current = false;
    clearRestart();
    if (captureDelayRef.current) {
      clearTimeout(captureDelayRef.current);
      captureDelayRef.current = null;
    }

    try {
      await speech.stop();
    } catch {}

    let stats = null;
    if (capturingRef.current) {
      try {
        stats = await capture.stopCapture();
        capturingRef.current = false;
      } catch (error) {
        addLog(`capture stop failed: ${error?.message ?? error}`);
      }
    }

    const counters = { ...countersRef.current, errorsByCode: { ...countersRef.current.errorsByCode } };
    return { counters, stats };
  }, [addLog, clearRestart]);

  const runPhase = useCallback(
    async index => {
      const phase = PHASES[index];
      setPhaseIndex(index);
      countersRef.current = emptyCounters();
      setLive(countersRef.current);
      addLog(`── phase ${phase.id} start (${phase.capture ?? 'no capture'})`);

      if (phase.capture && phase.captureDelayMs === 0) {
        try {
          const started = await capture.startCapture(SAMPLE_RATE, phase.capture);
          capturingRef.current = true;
          addLog(`capture ${started.source} → ${started.path}`);
        } catch (error) {
          addLog(`capture start failed: ${error?.message ?? error}`);
        }
      }

      activeRef.current = true;
      await safeStart();

      if (phase.capture && phase.captureDelayMs > 0) {
        captureDelayRef.current = setTimeout(async () => {
          captureDelayRef.current = null;
          try {
            const started = await capture.startCapture(SAMPLE_RATE, phase.capture);
            capturingRef.current = true;
            addLog(`capture (delayed) ${started.source} → ${started.path}`);
          } catch (error) {
            addLog(`delayed capture failed: ${error?.message ?? error}`);
          }
        }, phase.captureDelayMs);
      }

      const endsAt = Date.now() + PHASE_MS;
      tickRef.current = setInterval(() => {
        setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
        setLive({ ...countersRef.current, errorsByCode: { ...countersRef.current.errorsByCode } });
      }, 500);

      return new Promise(resolve => {
        resolvePhaseRef.current = resolve;
        phaseTimerRef.current = setTimeout(async () => {
          phaseTimerRef.current = null;
          if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
          }
          const outcome = await stopPhase();
          const frozen = { phase, ...outcome };
          console.log(
            '[SPIKE2-PHASE]',
            JSON.stringify({
              id: phase.id,
              source: phase.capture,
              counters: outcome.counters,
              capture: outcome.stats
                ? { ...outcome.stats, timeline: undefined }
                : null,
            }),
          );
          addLog(`── phase ${phase.id} done`);
          resolve(frozen);
        }, PHASE_MS);
      });
    },
    [addLog, safeStart, stopPhase],
  );

  const handleRun = useCallback(async () => {
    let permission = await checkMicPermission();
    if (permission === RESULTS.DENIED) {
      permission = await requestMicPermission();
    }
    if (!isGranted(permission)) {
      addLog(`permission not granted: ${permission}`);
      return;
    }
    if (!capture.isAvailable()) {
      addLog('AudioCapture native module missing — rebuild natively.');
      return;
    }

    setResults([]);
    setLog([]);
    setRunning(true);
    abortedRef.current = false;

    const collected = [];
    for (let index = 0; index < PHASES.length; index += 1) {
      const outcome = await runPhase(index);
      // Abort and unmount both resolve the pending phase; without this check
      // the loop would start the next phase and re-open the microphone.
      if (abortedRef.current || !outcome) {
        break;
      }
      collected.push(outcome);
      setResults([...collected]);
      if (index < PHASES.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      if (abortedRef.current) {
        break;
      }
    }

    setRunning(false);
    setPhaseIndex(-1);
    addLog(abortedRef.current ? 'run aborted' : 'all phases complete');
  }, [addLog, runPhase]);

  const handleAbort = useCallback(async () => {
    abortedRef.current = true;
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    // Resolve with the frozen snapshot stopPhase returns, not the live ref,
    // which later phases would keep mutating.
    const outcome = await stopPhase();
    resolvePhaseRef.current?.({ phase: PHASES[Math.max(0, phaseIndex)], ...outcome });
    resolvePhaseRef.current = null;
    setRunning(false);
    setPhaseIndex(-1);
    addLog('aborted');
  }, [addLog, phaseIndex, stopPhase]);

  useEffect(
    () => () => {
      activeRef.current = false;
      abortedRef.current = true;
      clearRestart();
      // Release the awaiting run loop, otherwise it stays parked on a promise
      // that can never settle once this screen is gone.
      resolvePhaseRef.current?.(null);
      resolvePhaseRef.current = null;
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (captureDelayRef.current) clearTimeout(captureDelayRef.current);
      if (capturingRef.current) capture.stopCapture().catch(() => {});
    },
    [clearRestart],
  );

  const baseline = results.find(item => item.phase.id === 'A');
  const baselineRecall = baseline ? wordRecall(baseline.counters.text) : 0;
  const current = phaseIndex >= 0 ? PHASES[phaseIndex] : null;

  return (
    <ScreenContainer>
      <AppHeader showBack onBackPress={() => navigation.goBack()} title="Mic Spike v2" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.script} selectable>
          Read this continuously, in every phase:{'\n'}
          {SCRIPT}
        </Text>

        <View style={styles.row}>
          <Pressable
            style={[styles.button, running && styles.buttonDisabled]}
            onPress={handleRun}
            disabled={running}
          >
            <Text style={styles.buttonText}>Run 4 phases</Text>
          </Pressable>
          <Pressable
            style={[styles.button, !running && styles.buttonDisabled]}
            onPress={handleAbort}
            disabled={!running}
          >
            <Text style={styles.buttonText}>Abort</Text>
          </Pressable>
        </View>

        {current ? (
          <View style={styles.currentBox}>
            <Text style={styles.currentTitle}>
              {current.label} · {remaining}s left
            </Text>
            <Text style={styles.currentHint}>{current.hint}</Text>
            <Text style={styles.mono}>
              {`ready ${live.ready} · begin ${live.begin} · partials ${live.partials} · finals ${live.finals}`}
            </Text>
          </View>
        ) : null}

        {results.map(item => {
          const score = scorePhase(item, item.phase.id === 'A' ? 0 : baselineRecall);
          const errors = Object.entries(item.counters.errorsByCode)
            .map(([code, count]) => `${code}×${count}`)
            .join(' ');
          return (
            <View key={item.phase.id} style={styles.phaseCard}>
              <View style={styles.phaseHead}>
                <Text style={styles.phaseTitle}>{item.phase.label}</Text>
                <Text
                  style={[
                    styles.badge,
                    score.meaningful ? styles.pass : styles.fail,
                  ]}
                >
                  {score.meaningful ? 'TRANSCRIBED' : 'NO TRANSCRIPTION'}
                </Text>
              </View>
              <Text style={styles.mono}>
                {`recall ${(score.recall * 100).toFixed(0)}%` +
                  (score.relative !== null
                    ? ` · vs baseline ${(score.relative * 100).toFixed(0)}%${score.degraded ? ' (DEGRADED)' : ''}`
                    : ' (baseline)') +
                  `\nready ${item.counters.ready} · begin ${item.counters.begin} (${(score.beginRatio * 100).toFixed(0)}%)` +
                  ` · partials ${item.counters.partials} · finals ${item.counters.finals}` +
                  `\nrestarts ${item.counters.restarts} · errors ${errors || 'none'} · fatal ${item.counters.fatal}` +
                  `\nlongest silence ${(item.counters.longestSilenceMs / 1000).toFixed(1)}s`}
              </Text>
              {item.stats ? (
                <Text style={styles.mono}>
                  {`capture ${item.stats.source} · peak ${item.stats.peakAmplitude} · avgRMS ${item.stats.averageRms.toFixed(0)}` +
                    ` · silent ${(item.stats.silentRatio * 100).toFixed(0)}%` +
                    `\nplatform silencing: ${item.stats.silencedSamples}/${item.stats.configSamples} samples` +
                    ` · max clients ${item.stats.maxConcurrentClients}` +
                    `\nreadErrors ${item.stats.readErrors} · gaps ${item.stats.gapCount}`}
                </Text>
              ) : null}
              {item.stats?.path ? (
                <Text style={styles.file} selectable>
                  {item.stats.path}
                </Text>
              ) : null}
              <Text style={styles.transcript} selectable>
                {item.counters.text || '— nothing transcribed —'}
              </Text>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Log</Text>
        {log.map((line, index) => (
          <Text key={`${index}-${line}`} style={styles.logLine} selectable>
            {line}
          </Text>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl, gap: spacing.xs },
  script: {
    ...typography.body,
    fontSize: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  button: {
    backgroundColor: colors.primaryAccent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  currentBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 2,
  },
  currentTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  currentHint: { fontSize: 12, color: colors.textSecondary },
  phaseCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: 4,
  },
  phaseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phaseTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  pass: { backgroundColor: colors.success },
  fail: { backgroundColor: colors.danger },
  sectionTitle: { ...typography.body, fontWeight: '700', marginTop: spacing.md },
  mono: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  file: { fontSize: 10, color: colors.secondaryAccent },
  transcript: { fontSize: 12, color: colors.textPrimary, fontStyle: 'italic' },
  logLine: { fontSize: 10, color: colors.textMuted },
});

export default MicSpikeScreen;
