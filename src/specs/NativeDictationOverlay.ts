import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';
import type {EventEmitter} from 'react-native/Libraries/Types/CodegenTypes';

export type OverlaySnapshot = {
  phase: string;
  transcript: string;
  partial: string;
  detail: string;
  durationSeconds: number;
  level: number;
  canPause: boolean;
  canStop: boolean;
  canReview: boolean;
};

export type OverlayCommand = {
  action: string;
};

export type OverlayDiagnostics = {
  canDrawOverlays: boolean;
  serviceRunning: boolean;
  windowAttached: boolean;
  sdkInt: number;
  manufacturer: string;
  model: string;
  installerPackage: string;
};

export interface Spec extends TurboModule {
  readonly canDrawOverlays: () => boolean;
  readonly isServiceRunning: () => boolean;
  readonly getOverlayDiagnostics: () => OverlayDiagnostics;
  readonly requestOverlayPermission: () => Promise<boolean>;
  readonly startBubbleService: () => Promise<boolean>;
  readonly stopBubbleService: () => Promise<boolean>;
  readonly beginDictationForeground: () => Promise<boolean>;
  readonly endDictationForeground: () => Promise<boolean>;
  readonly pushState: (snapshot: OverlaySnapshot) => void;
  readonly setExpanded: (expanded: boolean) => void;
  readonly openReviewSurface: () => Promise<boolean>;
  readonly closeReviewSurface: () => Promise<boolean>;
  readonly handoffToReport: () => Promise<boolean>;
  readonly showOverlayMessage: (text: string) => Promise<boolean>;
  readonly onOverlayCommand: EventEmitter<OverlayCommand>;
}

export default TurboModuleRegistry.get<Spec>('DictationOverlay');
