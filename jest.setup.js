/* eslint-env jest */

jest.mock('./src/specs/NativeDictationOverlay', () => ({
  __esModule: true,
  default: {
    isSupported: jest.fn(() => false),
    hasPermission: jest.fn(async () => false),
    requestPermission: jest.fn(async () => false),
    show: jest.fn(async () => {}),
    hide: jest.fn(async () => {}),
    pushState: jest.fn(async () => {}),
    openReviewSurface: jest.fn(async () => {}),
    closeReviewSurface: jest.fn(async () => {}),
    handoffToReport: jest.fn(async () => {}),
    startDictationForeground: jest.fn(async () => {}),
    endDictationForeground: jest.fn(async () => {}),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

jest.mock('./src/specs/NativeAudioCue', () => ({
  __esModule: true,
  default: {
    playStartCue: jest.fn(async () => true),
    playStopCue: jest.fn(async () => true),
    playSpeech: jest.fn(async () => true),
    stopSpeech: jest.fn(async () => true),
    suppressSystemTones: jest.fn(async () => {}),
    restore: jest.fn(async () => {}),
  },
}));

jest.mock('./src/specs/NativeSharedMic', () => ({
  __esModule: true,
  default: {
    isSupported: jest.fn(() => false),
    start: jest.fn(async () => true),
    stop: jest.fn(async () => null),
    getState: jest.fn(() => ({ text: '', partial: '', active: false })),
  },
}));

jest.mock('./src/specs/NativeAppConfig', () => ({
  __esModule: true,
  default: {
    getAnuvadiniToken: jest.fn(() => ''),
    getPravahKey: jest.fn(() => ''),
  },
}));

jest.mock('./src/specs/NativePdfExporter', () => ({
  __esModule: true,
  default: {
    exportReport: jest.fn(async () => ''),
    isAvailable: jest.fn(() => false),
  },
}));

jest.mock('./src/specs/NativeAudioCapture', () => ({
  __esModule: true,
  default: {
    start: jest.fn(async () => true),
    stop: jest.fn(async () => null),
    discard: jest.fn(async () => {}),
  },
}));

// --- animation and gesture libraries -----------------------------------

jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    TapGestureHandler: View,
    ScrollView: View,
    State: {},
    Directions: {},
    Gesture: { Pan: () => ({ onUpdate: () => ({ onEnd: () => ({}) }) }) },
    GestureDetector: View,
  };
});

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {
    setString: jest.fn(),
    getString: jest.fn(async () => ''),
    hasString: jest.fn(async () => false),
  },
}));

jest.mock('react-native-linear-gradient', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

jest.mock('react-native-vector-icons/Feather', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

jest.mock('@react-native-vector-icons/material-design-icons', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({
    execute: jest.fn(async () => ({ rows: { _array: [] } })),
    executeSync: jest.fn(() => ({ rows: { _array: [] } })),
    transaction: jest.fn(async run => run({ execute: jest.fn(async () => ({ rows: { _array: [] } })) })),
    close: jest.fn(),
  })),
}));

jest.mock('@appcitor/react-native-voice-to-text', () => ({
  __esModule: true,
  default: {
    startListening: jest.fn(async () => {}),
    stopListening: jest.fn(async () => {}),
    destroy: jest.fn(async () => {}),
    isAvailable: jest.fn(async () => false),
    getSupportedLanguages: jest.fn(async () => []),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  },
}));

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: { ANDROID: {}, IOS: {} },
  RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
  check: jest.fn(async () => 'denied'),
  request: jest.fn(async () => 'denied'),
  openSettings: jest.fn(async () => {}),
}));
