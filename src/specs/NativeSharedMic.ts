import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  readonly isSupported: () => Promise<boolean>;
  readonly start: (
    sampleRateHz: number,
    name: string,
    language: string,
    useSegmented: boolean,
  ) => Promise<Object>;
  readonly pause: () => Promise<boolean>;
  readonly resume: () => Promise<boolean>;
  readonly stop: () => Promise<Object>;
  readonly getState: () => Promise<Object>;
  readonly readCaptureBase64: (path: string, maxBytes: number) => Promise<string>;
  readonly readCaptureChunkBase64: (
    path: string,
    start: number,
    end: number,
  ) => Promise<string>;
  readonly snapChunkBoundaries: (
    path: string,
    boundaries: Array<number>,
    windowBytes: number,
  ) => Promise<Array<number>>;
  readonly deleteCapture: (path: string) => Promise<boolean>;
  readonly purgeCaptures: (olderThanMs: number) => Promise<number>;
}

export default TurboModuleRegistry.get<Spec>('SharedMic');