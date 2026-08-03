import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import AppHeader from '../components/AppHeader';
import ScreenContainer from '../components/ScreenContainer';
import { buildSpikeReport } from '../dev/spikeReport';
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
import * as sharedMic from '../services/sharedMicService';
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
  {
    id: 'E',
    label: 'E · Recognizer + capture (VOICE_COMMUNICATION)',
    hint: 'The source the platform reserves for calls — does it share better?',
    capture: AUDIO_SOURCES.VOICE_COMMUNICATION,
    captureDelayMs: 0,
  },
  {
    id: 'F',
    label: 'F · Recognizer + capture (CAMCORDER)',
    hint: 'The last untested source. Completes the contention matrix.',
    capture: AUDIO_SOURCES.CAMCORDER,
    captureDelayMs: 0,
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
  // Bumped by every run start, abort and unmount. Awaits taken inside a run
  // compare against the token they started with, so a run that was abandoned
  // while parked on the permission dialog or on startCapture cannot come back
  // and open the microphone under the next run.
  const runTokenRef = useRef(0);

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

  /** Releases a capture that finished starting after its run was abandoned. */
  const discardStaleCapture = useCallback(
    async label => {
      addLog(`${label} discarded — run no longer current`);
      try {
        await capture.stopCapture();
      } catch {}
    },
    [addLog],
  );

  const runPhase = useCallback(
    async (index, token) => {
      const phase = PHASES[index];
      setPhaseIndex(index);
      countersRef.current = emptyCounters();
      setLive(countersRef.current);
      addLog(`── phase ${phase.id} start (${phase.capture ?? 'no capture'})`);

      if (phase.capture && phase.captureDelayMs === 0) {
        try {
          const started = await capture.startCapture(SAMPLE_RATE, phase.capture);
          if (runTokenRef.current !== token) {
            await discardStaleCapture('capture');
            return null;
          }
          capturingRef.current = true;
          addLog(`capture ${started.source} → ${started.path}`);
        } catch (error) {
          addLog(`capture start failed: ${error?.message ?? error}`);
        }
      }

      if (runTokenRef.current !== token) {
        return null;
      }

      activeRef.current = true;
      await safeStart();

      if (phase.capture && phase.captureDelayMs > 0) {
        captureDelayRef.current = setTimeout(async () => {
          captureDelayRef.current = null;
          if (runTokenRef.current !== token) {
            return;
          }
          try {
            const started = await capture.startCapture(SAMPLE_RATE, phase.capture);
            if (runTokenRef.current !== token) {
              await discardStaleCapture('delayed capture');
              return;
            }
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
    [addLog, discardStaleCapture, safeStart, stopPhase],
  );

  const handleRun = useCallback(async () => {
    const token = runTokenRef.current + 1;
    runTokenRef.current = token;

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

    // The permission prompt is an await: the screen may have unmounted or a
    // newer run may have started while it was open.
    if (runTokenRef.current !== token) {
      return;
    }

    setResults([]);
    setLog([]);
    setRunning(true);
    abortedRef.current = false;

    const collected = [];
    for (let index = 0; index < PHASES.length; index += 1) {
      const outcome = await runPhase(index, token);
      // Abort and unmount both resolve the pending phase; without this check
      // the loop would start the next phase and re-open the microphone.
      if (abortedRef.current || runTokenRef.current !== token || !outcome) {
        break;
      }
      collected.push(outcome);
      setResults([...collected]);
      if (index < PHASES.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      if (abortedRef.current || runTokenRef.current !== token) {
        break;
      }
    }

    setRunning(false);
    setPhaseIndex(-1);
    addLog(abortedRef.current ? 'run aborted' : 'all phases complete');
  }, [addLog, runPhase]);

  const handleAbort = useCallback(async () => {
    abortedRef.current = true;
    runTokenRef.current += 1;
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
      runTokenRef.current += 1;
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

  // The shared-microphone path is structurally different from the phases
  // above: nothing contends, because one AudioRecord feeds both the recognizer
  // and the recording. Scored with the same criteria so the numbers compare.
  const handleRunSharedMic = useCallback(async (useSegmented = true) => {
    let permission = await checkMicPermission();
    if (permission === RESULTS.DENIED) {
      permission = await requestMicPermission();
    }
    if (!isGranted(permission)) {
      addLog(`permission not granted: ${permission}`);
      return;
    }

    if (!(await sharedMic.isSupported())) {
      addLog('SharedMic unsupported — needs Android 12+ and a recognition service.');
      return;
    }

    setRunning(true);
    addLog(`── shared mic start (${useSegmented ? 'segmented' : 'classic'})`);

    try {
      const started = await sharedMic.start(
        SAMPLE_RATE,
        'spike-shared',
        'en-IN',
        useSegmented,
      );
      addLog(`shared mic → ${started.path}`);
    } catch (error) {
      addLog(`shared mic start failed: ${error?.message ?? error}`);
      setRunning(false);
      return;
    }

    const endsAt = Date.now() + PHASE_MS;
    const ticker = setInterval(async () => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
      const state = await sharedMic.getState();
      if (state) {
        setLive({
          ...emptyCounters(),
          ready: state.ready,
          begin: state.begin,
          partials: state.partials,
          finals: state.finals,
          restarts: state.restarts,
          text: state.text,
        });
      }
    }, 500);

    await new Promise(resolve => setTimeout(resolve, PHASE_MS));
    clearInterval(ticker);

    const final = await sharedMic.stop();
    addLog('── shared mic done');

    if (final) {
      setResults(collected => [
        ...collected,
        {
          phase: {
            id: useSegmented ? 'G' : 'H',
            label: useSegmented
              ? 'G · Shared mic (segmented)'
              : 'H · Shared mic (classic per-utterance)',
            capture: 'sharedMic',
            captureDelayMs: 0,
          },
          counters: {
            ...emptyCounters(),
            ready: final.ready,
            begin: final.begin,
            partials: final.partials,
            finals: final.finals,
            restarts: final.restarts,
            text: final.text,
            errorsByCode: final.errorsByCode ?? {},
            firstPartialAtMs: final.firstPartialAtMs,
          },
          stats: {
            source: 'sharedMic',
            path: final.path,
            peakAmplitude: final.peakAmplitude,
            averageRms: final.averageRms,
            silentRatio: final.silentRatio,
            // Nothing contends here — we are the only client — so the
            // platform-silencing counters have nothing to report.
            silencedSamples: 0,
            configSamples: 0,
            maxConcurrentClients: 1,
            readErrors: final.droppedFrames,
            gapCount: 0,
            longestGapMs: 0,
            bytes: final.bytes,
          },
        },
      ]);
    }

    setRunning(false);
    setRemaining(0);
  }, [addLog]);

  const handleShareResults = async () => {
    if (!results.length) {
      return;
    }
    const text = buildSpikeReport(results, item =>
      scorePhase(item, item.phase.id === 'A' ? 0 : baselineRecall),
    );
    try {
      await Share.share({ message: text });
    } catch {}
  };

  return (
    <ScreenContainer>
      <AppHeader showBack onBackPress={() => navigation.goBack()} title="Mic Spike v2" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.scriptCard}>
          <Text style={styles.scriptLabel}>DICTATION SCRIPT (Read during test phase)</Text>
          <Text style={styles.scriptText} selectable>
            {SCRIPT}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.button, styles.buttonPrimary, running && styles.buttonDisabled]}
            onPress={handleRun}
            disabled={running}
            accessibilityRole="button"
            accessibilityLabel={`Run ${PHASES.length} phases`}
          >
            <Text style={styles.buttonPrimaryText}>Run {PHASES.length} phases</Text>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              running ? styles.buttonDanger : styles.buttonDangerDisabled,
            ]}
            onPress={handleAbort}
            disabled={!running}
            accessibilityRole="button"
            accessibilityLabel="Abort current run"
          >
            <Text style={running ? styles.buttonDangerText : styles.buttonDisabledText}>
              Abort
            </Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.buttonSecondary, running && styles.buttonDisabled]}
            onPress={() => handleRunSharedMic(true)}
            disabled={running}
            accessibilityRole="button"
            accessibilityLabel="Run shared mic segmented"
          >
            <Text style={styles.buttonSecondaryText}>Shared mic (segmented)</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.buttonSecondary, running && styles.buttonDisabled]}
            onPress={() => handleRunSharedMic(false)}
            disabled={running}
            accessibilityRole="button"
            accessibilityLabel="Run shared mic classic"
          >
            <Text style={styles.buttonSecondaryText}>Shared mic (classic)</Text>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              results.length ? styles.buttonSuccess : styles.buttonSecondaryDisabled,
            ]}
            onPress={handleShareResults}
            disabled={!results.length}
            accessibilityRole="button"
            accessibilityLabel="Share results"
          >
            <Text style={results.length ? styles.buttonSuccessText : styles.buttonDisabledText}>
              Share results
            </Text>
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
          const errors = Object.entries(item.counters.errorsByCode ?? {})
            .map(([code, count]) => `${code}×${count}`)
            .join(' ');
          // A diagnostic screen that crashes while reporting a result is worse
          // than useless, so every number is read defensively.
          const num = (value, digits = 0) => (value ?? 0).toFixed(digits);
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
                {`recall ${num(score.recall * 100)}%` +
                  (score.relative !== null
                    ? ` · vs baseline ${num(score.relative * 100)}%${score.degraded ? ' (DEGRADED)' : ''}`
                    : ' (baseline)') +
                  `\nready ${item.counters.ready} · begin ${item.counters.begin} (${num(score.beginRatio * 100)}%)` +
                  ` · partials ${item.counters.partials} · finals ${item.counters.finals}` +
                  `\nrestarts ${item.counters.restarts} · errors ${errors || 'none'} · fatal ${item.counters.fatal ?? 0}` +
                  `\nlongest silence ${num((item.counters.longestSilenceMs ?? 0) / 1000, 1)}s`}
              </Text>
              {item.stats ? (
                <Text style={styles.mono}>
                  {`capture ${item.stats.source ?? '—'} · peak ${item.stats.peakAmplitude ?? 0} · avgRMS ${num(item.stats.averageRms)}` +
                    ` · silent ${num((item.stats.silentRatio ?? 0) * 100)}%` +
                    `\nplatform silencing: ${item.stats.silencedSamples ?? 0}/${item.stats.configSamples ?? 0} samples` +
                    ` · max clients ${item.stats.maxConcurrentClients ?? 0}` +
                    `\nreadErrors ${item.stats.readErrors ?? 0} · gaps ${item.stats.gapCount ?? 0}`}
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
  content: { paddingBottom: spacing.xl, gap: spacing.sm },
  scriptCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  scriptLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  scriptText: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.sm,
    alignItems: 'center',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primaryAccent,
  },
  buttonPrimaryText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  buttonSecondary: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryDisabled,
  },
  buttonSecondaryText: {
    color: colors.primaryAccent,
    fontWeight: '600',
    fontSize: 13,
  },
  buttonDanger: {
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  buttonDangerText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  buttonDangerDisabled: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    opacity: 0.5,
  },
  buttonSecondaryDisabled: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    opacity: 0.5,
  },
  buttonSuccess: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.success,
  },
  buttonSuccessText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonDisabledText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  currentBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: spacing.md,
    gap: 4,
  },
  currentTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  currentHint: { fontSize: 12, color: colors.textSecondary },
  phaseCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.xs,
    gap: 4,
  },
  phaseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phaseTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
