/**
 * @flow strict-local
 * @format
 *
 * Build-time configuration that must not live in a committed source file.
 *
 * The Anuvadini credential is injected through `android/local.properties` into
 * BuildConfig, so it never reaches Git. It is still extractable from a compiled
 * APK — build-time injection is not secrecy — which is why the long-term
 * arrangement puts the token behind our own service instead.
 */

import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  /** Empty string when the build had no token configured. */
  +getAnuvadiniToken: () => string;
}

export default (TurboModuleRegistry.get<Spec>('AppConfig'): ?Spec);
