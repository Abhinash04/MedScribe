let nativeModule;
let resolved = false;

function appConfig() {
  if (!resolved) {
    resolved = true;
    try {
      nativeModule = require('../specs/NativeAppConfig').default;
    } catch {
      nativeModule = null;
    }
  }
  return nativeModule;
}

export function getAnuvadiniToken() {
  const module = appConfig();
  if (!module) {
    return '';
  }
  try {
    return module.getAnuvadiniToken() || '';
  } catch {
    return '';
  }
}

export function hasAnuvadiniToken() {
  return getAnuvadiniToken().length > 0;
}

export function getPravahKey() {
  const module = appConfig();
  // The method-presence guard is what lets JS shipped ahead of the native
  // rebuild degrade to "translation not configured" instead of crashing.
  if (!module || typeof module.getPravahKey !== 'function') {
    return '';
  }
  try {
    return module.getPravahKey() || '';
  } catch {
    return '';
  }
}

export function hasPravahKey() {
  return getPravahKey().length > 0;
}
