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
