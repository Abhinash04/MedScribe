import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  readonly playCue: (kind: string) => Promise<boolean>;
  readonly suppressSystemTones: (watchdogMs: number) => Promise<string>;
  readonly restoreSystemTones: () => Promise<boolean>;
  readonly playSpeech: (audioBase64: string) => Promise<boolean>;
  readonly stopSpeech: () => Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AudioCue');
