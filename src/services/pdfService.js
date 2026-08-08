import { buildReportDocument } from './reportDocument';

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
  const document = buildReportDocument(draft, meta);
  return nativeModule().exportReport(JSON.stringify(document));
}
export async function shareReport(path) {
  return nativeModule().shareReport(path);
}
