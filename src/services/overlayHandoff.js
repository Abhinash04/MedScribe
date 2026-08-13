import { isTranslationReady } from '../store/useRecordingStore.js';

let pendingRoute = null;

export function requestReportHandoff(route = 'Report') {
  pendingRoute = route;
}

export function consumeReportHandoff() {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}

export function hasPendingHandoff() {
  return pendingRoute !== null;
}

export function canGenerateReport(state) {
  if (!state) {
    return false;
  }
  return isTranslationReady(state);
}
