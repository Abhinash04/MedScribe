export const INITIAL_ROUTE = {
  ONBOARDING: 'OverlayOnboarding',
  DASHBOARD: 'Dashboard',
};

export function resolveInitialRoute({
  overlayGranted,
  micGranted,
  onboardingSeen,
  overlaySupported = true,
} = {}) {
  if (onboardingSeen === true) {
    return INITIAL_ROUTE.DASHBOARD;
  }
  if (micGranted !== true) {
    return INITIAL_ROUTE.ONBOARDING;
  }
  if (!overlaySupported) {
    return INITIAL_ROUTE.DASHBOARD;
  }
  if (overlayGranted === true) {
    return INITIAL_ROUTE.DASHBOARD;
  }
  return INITIAL_ROUTE.ONBOARDING;
}
