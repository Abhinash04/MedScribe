import { makeMutable } from 'react-native-reanimated';
import VoiceToText, {
  VoiceToTextEvents,
} from '@appcitor/react-native-voice-to-text';

export const amplitudeShared = makeMutable(0);
export const SPEECH_EVENTS = VoiceToTextEvents;
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
export const destroy = async () => {
  try {
    return await VoiceToText.destroy();
  } finally {
    nativeSubscriptions = null;
  }
};

export const isAvailable = () => VoiceToText.isRecognitionAvailable();
export const getSupportedLanguages = () => VoiceToText.getSupportedLanguages();
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
    VoiceToText.addEventListener(SPEECH_EVENTS.VOLUME_CHANGED, event => {
      amplitudeShared.value = typeof event?.value === 'number' ? event.value : 0;
    }),
  ];
}

export function subscribe(handlers = {}) {
  ensureNativeListeners();
  activeHandlers = handlers;

  return () => {
    if (activeHandlers === handlers) {
      activeHandlers = null;
    }
  };
}
