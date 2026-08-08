import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  readonly isCaptureSupported: () => Promise<boolean>;
  readonly startCapture: (
    sampleRateHz: number,
    source: string,
    scope: string,
    name: string,
  ) => Promise<Object>;
  readonly pauseCapture: () => Promise<boolean>;
  readonly resumeCapture: () => Promise<boolean>;
  readonly stopCapture: () => Promise<Object>;
  readonly getStats: () => Promise<Object>;
  readonly readCaptureBase64: (path: string, maxBytes: number) => Promise<string>;
  readonly deleteCapture: (path: string) => Promise<boolean>;
  readonly purgeCaptures: (olderThanMs: number) => Promise<number>;
}

export default TurboModuleRegistry.get<Spec>('AudioCapture');