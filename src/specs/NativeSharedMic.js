/**
 * @flow strict-local
 * @format
 *
 * One microphone owner serving both the recognizer and the recording.
 *
 * SpeechRecognizer and AudioRecord cannot share the microphone — measured on
 * device, the recognizer returns NO_MATCH on every utterance while a capture is
 * running. EXTRA_AUDIO_SOURCE (API 31+) inverts that: we own the microphone and
 * hand the recognizer a file descriptor, so one dictation produces both a live
 * transcript and a WAV.
 */

import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  /** False below API 31, or where no recognition service is installed. */
  +isSupported: () => Promise<boolean>;
  /** Resolves { path, sampleRate, bufferBytes }. */
  +start: (
    sampleRateHz: number,
    name: string,
    language: string,
    useSegmented: boolean,
  ) => Promise<Object>;
  +pause: () => Promise<boolean>;
  +resume: () => Promise<boolean>;
  /** Stops everything, finalises the WAV, resolves the final state. */
  +stop: () => Promise<Object>;
  /** Transcript, counters and capture statistics, for polling. */
  +getState: () => Promise<Object>;
  /**
   * Recording files. These live here rather than on the capture spike module,
   * which is registered in debug builds only — a release APK must be able to
   * read and delete the consultation it just recorded.
   */
  +readCaptureBase64: (path: string, maxBytes: number) => Promise<string>;
  /**
   * One byte range of a recording, wrapped as a WAV of its own.
   *
   * The transcription service reads only the first ~57 s of any submission, so
   * a long dictation is uploaded as several ranges of the one file rather than
   * as one request.
   */
  +readCaptureChunkBase64: (
    path: string,
    start: number,
    end: number,
  ) => Promise<string>;
  /** Moves each interior cut point to the quietest offset near it. */
  +snapChunkBoundaries: (
    path: string,
    boundaries: Array<number>,
    windowBytes: number,
  ) => Promise<Array<number>>;
  +deleteCapture: (path: string) => Promise<boolean>;
  +purgeCaptures: (olderThanMs: number) => Promise<number>;
}

export default (TurboModuleRegistry.get<Spec>('SharedMic'): ?Spec);
