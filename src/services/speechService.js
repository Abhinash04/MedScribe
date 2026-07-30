import { makeMutable } from 'react-native-reanimated';
import VoiceToText, {
  VoiceToTextEvents,
} from '@appcitor/react-native-voice-to-text';

/**
 * Live microphone level, as raw RMS dB.
 *
 * Deliberately a Reanimated shared value rather than React state. Android
 * emits onRmsChanged 10-20x/second; routing that through a store made
 * RecordingScreen re-render its whole subtree at the same rate, which starved
 * partial-transcript updates and made text appear 2-3 seconds late. A shared
 * value updates the visualizer on the UI thread without ever rendering.
 */
export const amplitudeShared = makeMutable(0);

/**
 * Isolation layer over @appcitor/react-native-voice-to-text (SRS FR-3).
 *
 * Nothing outside this file imports the vendor package, so swapping the
 * speech engine — or mocking it in tests — touches one module.
 *
 * Notes on the underlying library (read from its source, v0.2.1):
 *  - There is no callback-assignment API; events come off a NativeEventEmitter.
 *  - Recognition is single-utterance: onResults / onEnd / onError all clear the
 *    native isListening flag. Continuous dictation is the caller's job.
 *  - startListening() rejects with "ALREADY_LISTENING" if called while active.
 *  - onSpeechVolumeChanged is only emitted when a listener is registered, so
 *    subscribe() always registers it.
 */

export const SPEECH_EVENTS = VoiceToTextEvents;

/**
 * Pulls the transcript out of either payload shape the library emits:
 * `{ value }` on the happy path, `{ results: { transcriptions: [...] } }` as
 * the structured form.
 */
const extractText = event => {
  if (!event) {
    return '';
  }

  if (typeof event.value === 'string' && event.value.length > 0) {
    return event.value;
  }

  const first = event.results?.transcriptions?.[0];
  return typeof first?.text === 'string' ? first.text : '';
};

const normalizeError = event => ({
  code: typeof event?.code === 'number' ? event.code : null,
  message: typeof event?.message === 'string' ? event.message : '',
});

export const start = () => VoiceToText.startListening();

export const stop = () => VoiceToText.stopListening();

export const destroy = () => VoiceToText.destroy();

export const isAvailable = () => VoiceToText.isRecognitionAvailable();

export const getSupportedLanguages = () => VoiceToText.getSupportedLanguages();

/**
 * Registers every relevant speech event and returns a single unsubscribe
 * function that removes all of them.
 *
 * Handlers receive normalized values, never raw native payloads:
 *   onStart()               onBegin()              onEnd()
 *   onResults(text)         onPartialResults(text)
 *   onError({ code, message })
 *   onVolumeChanged(rmsDb)
 */
/**
 * The native listeners are registered exactly once for the app's lifetime and
 * are never removed.
 *
 * This is deliberate. The library's native removeListeners() iterates its
 * event map while deleting from it:
 *
 *   for (eventName in eventListeners.keys) { ... eventListeners.remove(...) }
 *
 * which throws ConcurrentModificationException — surfaced in logcat as
 * "Exception in native call" every time a subscription is torn down. Removing
 * a listener is the only way to trigger it, so we simply never do: handlers
 * are swapped on the JS side instead, and the native registration is stable.
 */
let nativeSubscriptions = null;
let activeHandlers = null;

const dispatch = (name, arg) => {
  const handler = activeHandlers?.[name];
  if (handler) {
    handler(arg);
  }
};

function ensureNativeListeners() {
  if (nativeSubscriptions) {
    return;
  }

  nativeSubscriptions = [
    VoiceToText.addEventListener(SPEECH_EVENTS.START, () =>
      dispatch('onStart'),
    ),
    VoiceToText.addEventListener(SPEECH_EVENTS.BEGIN, () =>
      dispatch('onBegin'),
    ),
    VoiceToText.addEventListener(SPEECH_EVENTS.END, () => dispatch('onEnd')),
    VoiceToText.addEventListener(SPEECH_EVENTS.RESULTS, event =>
      dispatch('onResults', extractText(event)),
    ),
    VoiceToText.addEventListener(SPEECH_EVENTS.PARTIAL_RESULTS, event =>
      dispatch('onPartialResults', extractText(event)),
    ),
    VoiceToText.addEventListener(SPEECH_EVENTS.ERROR, event =>
      dispatch('onError', normalizeError(event)),
    ),
    // Registered unconditionally: the native module gates volume emission on
    // its listener count, so skipping this kills the waveform entirely.
    //
    // Writes straight to the shared value — no dispatch to JS handlers, so
    // this high-frequency event never triggers a React render.
    VoiceToText.addEventListener(SPEECH_EVENTS.VOLUME_CHANGED, event => {
      amplitudeShared.value = typeof event?.value === 'number' ? event.value : 0;
    }),
  ];
}

export function subscribe(handlers = {}) {
  ensureNativeListeners();
  activeHandlers = handlers;

  return () => {
    // Only clear if a later subscriber hasn't already taken over.
    if (activeHandlers === handlers) {
      activeHandlers = null;
    }
  };
}
