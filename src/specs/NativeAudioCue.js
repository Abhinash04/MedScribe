/**
 * @flow strict-local
 * @format
 *
 * TurboModule spec for dictation audio cues and system-tone suppression.
 *
 * Codegen reads this file — see the `codegenConfig` block in package.json —
 * and generates the abstract `NativeAudioCueSpec` class that
 * `AudioCueModule.kt` implements. Editing the signatures here requires a
 * native rebuild, never just a Metro reload.
 *
 * Two responsibilities, deliberately in one module because they are two halves
 * of the same problem: the system RecognitionService plays its own start/end
 * tone on every recognizer session, and the auto-restart loop starts one per
 * utterance. Suppressing those tones is what makes room for a single, meaningful
 * cue of our own at session start and resume.
 */

import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  /** Plays one short tone. `kind` is 'start' | 'resume' | 'stop'. */
  +playCue: (kind: string) => Promise<boolean>;
  /**
   * Mutes the streams that carry the recognizer's tones and arms a watchdog
   * that restores them after `watchdogMs` even if JavaScript never calls back.
   * Resolves with the comma-joined list of streams actually muted.
   */
  +suppressSystemTones: (watchdogMs: number) => Promise<string>;
  /** Unmutes everything this module muted. Safe when nothing is muted. */
  +restoreSystemTones: () => Promise<boolean>;
}

export default (TurboModuleRegistry.getEnforcing<Spec>('AudioCue'): Spec);