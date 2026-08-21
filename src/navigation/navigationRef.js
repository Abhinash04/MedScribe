import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

let queued = null;

export function navigateWhenReady(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
    return true;
  }
  queued = { name, params };
  return false;
}

export function flushPendingNavigation() {
  if (!queued || !navigationRef.isReady()) {
    return false;
  }
  const { name, params } = queued;
  queued = null;
  navigationRef.navigate(name, params);
  return true;
}

export function clearPendingNavigation() {
  queued = null;
}
