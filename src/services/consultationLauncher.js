export const PLAY_MODE = {
  HEADLESS: 'headless',
  OPEN_APP: 'openApp',
};

export const OPEN_APP_CAUSE = {
  MIC_NOT_GRANTED: 'mic_not_granted',
  NO_SHARED_MIC: 'no_shared_mic',
  UNFINISHED_SESSION: 'unfinished_session',
};

export const RECORDING_ROUTE = 'Recording';

const headless = () => ({ mode: PLAY_MODE.HEADLESS, cause: null, route: null });
const openApp = cause => ({
  mode: PLAY_MODE.OPEN_APP,
  cause,
  route: RECORDING_ROUTE,
});

export function planPlayAction({
  micGranted = false,
  sharedMicSupported = false,
  hasUnfinishedSession = false,
} = {}) {
  if (hasUnfinishedSession === true) {
    return openApp(OPEN_APP_CAUSE.UNFINISHED_SESSION);
  }
  if (micGranted !== true) {
    return openApp(OPEN_APP_CAUSE.MIC_NOT_GRANTED);
  }
  if (sharedMicSupported !== true) {
    return openApp(OPEN_APP_CAUSE.NO_SHARED_MIC);
  }
  return headless();
}
