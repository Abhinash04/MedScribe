export function shouldTeardownOnBackground({
  appState,
  isDictating,
  bubbleActive,
} = {}) {
  if (appState === 'active') {
    return false;
  }
  if (bubbleActive === true) {
    return false;
  }
  return isDictating === true;
}

export function shouldRestoreAudioCue({ appState, bubbleActive } = {}) {
  if (appState === 'active') {
    return false;
  }
  return bubbleActive !== true;
}

export function shouldFinalizeImmediately({ usesSharedMic } = {}) {
  return usesSharedMic === true;
}
