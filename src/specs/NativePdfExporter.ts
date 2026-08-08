import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  readonly exportReport: (documentJson: string) => Promise<string>;
  readonly shareReport: (path: string) => Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('PdfExporter');
