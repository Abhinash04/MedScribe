export const OVERLAY_STATE = {
  GRANTED: 'granted',
  OEM_BACKGROUND_BLOCK: 'oem_background_block',
  RESTRICTED_SETTINGS: 'restricted_settings',
  NOT_GRANTED: 'not_granted',
};

const RESTRICTED_SETTINGS_SDK = 33;

const ADB_INSTALLERS = ['none', 'com.android.shell'];

const TRUSTED_INSTALLERS = ['com.android.vending'];

export function isAdbInstall(installerPackage) {
  return ADB_INSTALLERS.includes(String(installerPackage ?? '').trim());
}

export function isTrustedInstall(installerPackage) {
  return TRUSTED_INSTALLERS.includes(String(installerPackage ?? '').trim());
}

export function canBeRestricted({ sdkInt = 0, installerPackage = '' } = {}) {
  if (Number(sdkInt) < RESTRICTED_SETTINGS_SDK) {
    return false;
  }
  return !isAdbInstall(installerPackage) && !isTrustedInstall(installerPackage);
}

export function resolveOverlayState(diagnostics) {
  const info = diagnostics ?? {};

  if (info.canDrawOverlays === true) {
    return info.windowAttached === false && info.serviceRunning === true
      ? OVERLAY_STATE.OEM_BACKGROUND_BLOCK
      : OVERLAY_STATE.GRANTED;
  }

  return canBeRestricted(info)
    ? OVERLAY_STATE.RESTRICTED_SETTINGS
    : OVERLAY_STATE.NOT_GRANTED;
}

const GUIDANCE = {
  [OVERLAY_STATE.GRANTED]: {
    title: 'Overlay permission is active',
    body: 'MedScribe can draw the floating bubble over other apps.',
  },
  [OVERLAY_STATE.OEM_BACKGROUND_BLOCK]: {
    title: 'One more toggle is needed',
    body:
      'The permission is granted but your device is still blocking the bubble. ' +
      'Open this app’s permissions and turn on the separate "Display pop-up ' +
      'windows while running in background" setting.',
  },
  [OVERLAY_STATE.RESTRICTED_SETTINGS]: {
    title: 'Android has restricted this permission',
    body:
      'Because MedScribe was installed from a file rather than an app store, ' +
      'Android 13 and later block this permission by default. This is not a ' +
      'fault in MedScribe.\n\n' +
      'To allow it: open Settings › Apps › MedScribe, tap the three-dot menu ' +
      'in the top corner, choose "Allow restricted settings", then try again.',
  },
  [OVERLAY_STATE.NOT_GRANTED]: {
    title: 'Permission not granted yet',
    body: 'Open the permission screen and allow MedScribe to display over other apps.',
  },
};

export function guidanceFor(state) {
  return GUIDANCE[state] ?? GUIDANCE[OVERLAY_STATE.NOT_GRANTED];
}

export function describeDiagnostics(diagnostics) {
  const info = diagnostics ?? {};
  const state = resolveOverlayState(info);
  return {
    state,
    ...guidanceFor(state),
    lines: [
      `canDrawOverlays: ${info.canDrawOverlays}`,
      `windowAttached: ${info.windowAttached}`,
      `serviceRunning: ${info.serviceRunning}`,
      `installer: ${info.installerPackage}`,
      `android: API ${info.sdkInt}`,
      `device: ${info.manufacturer} ${info.model}`,
    ],
  };
}
