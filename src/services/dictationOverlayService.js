let nativeModule;
let resolved = false;

function overlay() {
  if (!resolved) {
    resolved = true;
    try {
      nativeModule = require('../specs/NativeDictationOverlay').default;
    } catch {
      nativeModule = null;
    }
  }
  return nativeModule;
}

export function isAvailable() {
  return overlay() !== null && overlay() !== undefined;
}

export function canDrawOverlays() {
  const module = overlay();
  if (!module) {
    return false;
  }
  try {
    return module.canDrawOverlays();
  } catch {
    return false;
  }
}

export function isServiceRunning() {
  const module = overlay();
  if (!module) {
    return false;
  }
  try {
    return module.isServiceRunning();
  } catch {
    return false;
  }
}

export function getOverlayDiagnostics() {
  const module = overlay();
  if (!module) {
    return {
      canDrawOverlays: false,
      serviceRunning: false,
      windowAttached: false,
      sdkInt: 0,
      manufacturer: 'unavailable',
      model: 'unavailable',
      installerPackage: 'unavailable',
    };
  }
  try {
    return module.getOverlayDiagnostics();
  } catch {
    return {
      canDrawOverlays: false,
      serviceRunning: false,
      windowAttached: false,
      sdkInt: 0,
      manufacturer: 'error',
      model: 'error',
      installerPackage: 'error',
    };
  }
}

export async function requestOverlayPermission() {
  const module = overlay();
  if (!module) {
    return false;
  }
  try {
    return await module.requestOverlayPermission();
  } catch {
    return false;
  }
}

export async function startBubbleService() {
  const module = overlay();
  if (!module) {
    return false;
  }
  try {
    return await module.startBubbleService();
  } catch {
    return false;
  }
}

export async function stopBubbleService() {
  const module = overlay();
  if (!module) {
    return false;
  }
  try {
    return await module.stopBubbleService();
  } catch {
    return false;
  }
}

export async function beginDictationForeground() {
  const module = overlay();
  if (!module) {
    return false;
  }
  try {
    return await module.beginDictationForeground();
  } catch {
    return false;
  }
}

export async function endDictationForeground() {
  const module = overlay();
  if (!module) {
    return false;
  }
  try {
    return await module.endDictationForeground();
  } catch {
    return false;
  }
}

export function pushState(snapshot) {
  const module = overlay();
  if (!module) {
    return;
  }
  try {
    module.pushState(snapshot);
  } catch {}
}

export async function openReviewSurface() {
  const module = overlay();
  if (!module) {
    return false;
  }
  try {
    return await module.openReviewSurface();
  } catch {
    return false;
  }
}

export async function closeReviewSurface() {
  const module = overlay();
  if (!module) {
    return false;
  }
  try {
    return await module.closeReviewSurface();
  } catch {
    return false;
  }
}

export async function handoffToReport() {
  const module = overlay();
  if (!module) {
    return false;
  }
  try {
    return await module.handoffToReport();
  } catch {
    return false;
  }
}

export async function showOverlayMessage(text) {
  const module = overlay();
  if (!module || !text) {
    return false;
  }
  try {
    return await module.showOverlayMessage(text);
  } catch {
    return false;
  }
}

export function subscribeToCommands(handler) {
  const module = overlay();
  if (!module) {
    return null;
  }
  try {
    const subscription = module.onOverlayCommand(handler);
    return () => subscription?.remove?.();
  } catch {
    return null;
  }
}
