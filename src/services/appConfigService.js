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

/**
 * Build-time configuration, isolated so nothing above this file knows it came
 * from BuildConfig.
 *
 * The token is returned to the caller that needs it and never logged, never
 * put in an error, and never included in the diagnostic dump.
 */
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

/** For the UI, which needs to say "not configured" without seeing the value. */
export function hasAnuvadiniToken() {
  return getAnuvadiniToken().length > 0;
}
