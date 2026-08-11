import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  readonly getAnuvadiniToken: () => string;
  readonly getPravahKey: () => string;
}

export default TurboModuleRegistry.get<Spec>('AppConfig');
