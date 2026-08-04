/**
 * @flow strict-local
 * @format
 *
 * PCM capture. Two scopes share one implementation: the phase-1 spike, which
 * writes to external app storage, and a consultation, whose audio is patient
 * data and stays in internal storage.
 */

import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  +isCaptureSupported: () => Promise<boolean>;
  /** `scope` is 'spike' or 'consultation'. Resolves { path, sampleRate, bufferBytes, startedAt }. */
  +startCapture: (
    sampleRateHz: number,
    source: string,
    scope: string,
    name: string,
  ) => Promise<Object>;
  /** Stops writing without closing the file, so a paused dictation records nothing. */
  +pauseCapture: () => Promise<boolean>;
  +resumeCapture: () => Promise<boolean>;
  /** Stops, finalises the WAV header, resolves the capture statistics. */
  +stopCapture: () => Promise<Object>;
  +getStats: () => Promise<Object>;
  /** Base64 of the file at `path`, rejected above `maxBytes`. */
  +readCaptureBase64: (path: string, maxBytes: number) => Promise<string>;
  +deleteCapture: (path: string) => Promise<boolean>;
  /** Deletes consultation captures older than `olderThanMs`; resolves the count. */
  +purgeCaptures: (olderThanMs: number) => Promise<number>;
}

// Registered in debug builds only — this is the contention spike, not the
// production path — so its absence must be a null rather than a throw.
export default (TurboModuleRegistry.get<Spec>('AudioCapture'): ?Spec);
