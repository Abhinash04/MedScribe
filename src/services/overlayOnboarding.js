export const INITIAL_ROUTE = {
  ONBOARDING: 'OverlayOnboarding',
  DASHBOARD: 'Dashboard',
};

export function resolveInitialRoute({
  overlayGranted,
  onboardingSeen,
  overlaySupported = true,
} = {}) {
  if (!overlaySupported) {
    return INITIAL_ROUTE.DASHBOARD;
  }
  if (overlayGranted === true) {
    return INITIAL_ROUTE.DASHBOARD;
  }
  if (onboardingSeen === true) {
    return INITIAL_ROUTE.DASHBOARD;
  }
  return INITIAL_ROUTE.ONBOARDING;
}
