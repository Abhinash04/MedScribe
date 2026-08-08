import getIpcReportHtml from '../templates/ipcReportTemplate';
import { draftValues } from './reportDraft';

/**
 * Isolation layer for the native PDF exporter.
 *
 * No screen imports the TurboModule directly — the same rule `speechService`
 * applies to the speech vendor. Replacing the Kotlin exporter (with a cloud
 * renderer, say) touches this file only.
 *
 * The module is resolved lazily and the failure is caught deliberately: the
 * spec uses `getEnforcing`, which throws at import time on a JS-only reload
 * that has not yet been paired with a native rebuild. Failing at call time
 * with a readable message beats a white screen on launch.
 */

let cached = null;

function nativeModule() {
  if (cached) {
    return cached;
  }

  try {
    cached = require('../specs/NativePdfExporter').default;
  } catch {
    throw new Error(
      'PDF export is unavailable in this build. Rebuild the app natively ' +
        '(npm run android) so the exporter module is compiled in.',
    );
  }

  return cached;
}

export function isAvailable() {
  try {
    return !!nativeModule();
  } catch {
    return false;
  }
}
export async function exportReport(draft, meta = {}) {
  const data = draftValues(draft);
  const htmlContent = getIpcReportHtml(data);
  return nativeModule().exportReport(htmlContent);
}
export async function shareReport(path) {
  return nativeModule().shareReport(path);
}
