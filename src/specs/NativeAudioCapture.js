/**
 * @flow strict-local
 * @format
 *
 * Phase 1 spike only: PCM capture running alongside the system recognizer.
 * Not part of the production STT architecture.
 */

import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  +isCaptureSupported: () => Promise<boolean>;
  /** Resolves { path, sampleRate, bufferBytes, startedAt }. */
  +startCapture: (sampleRateHz: number, source: string) => Promise<Object>;
  /** Stops, finalises the WAV header, resolves the capture statistics. */
  +stopCapture: () => Promise<Object>;
  +getStats: () => Promise<Object>;
}

export default (TurboModuleRegistry.getEnforcing<Spec>('AudioCapture'): Spec);
