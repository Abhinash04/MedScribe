import { Platform } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  check,
  openSettings,
  request,
} from 'react-native-permissions';
import { RECORDING_STATE } from '../constants/recordingStates';

/**
 * Microphone permission (SRS FR-2, Constraint: the speech library ships no
 * permission helper and its native startListening() hard-rejects with
 * "PERMISSION_DENIED" when RECORD_AUDIO is missing).
 *
 * react-native-permissions is used over core PermissionsAndroid because it
 * distinguishes BLOCKED ("don't ask again") from DENIED and ships
 * openSettings() — both required to handle the blocked flow.
 */
const MIC_PERMISSION = Platform.select({
  android: PERMISSIONS.ANDROID.RECORD_AUDIO,
  ios: PERMISSIONS.IOS.MICROPHONE,
});

export const checkMicPermission = () => check(MIC_PERMISSION);

export const requestMicPermission = () => request(MIC_PERMISSION);

export const openAppSettings = () => openSettings();

export const isGranted = result =>
  result === RESULTS.GRANTED || result === RESULTS.LIMITED;

/**
 * Maps a react-native-permissions result onto the app state machine.
 * LIMITED is treated as granted — iOS may grant restricted access, which is
 * still enough to record.
 *
 * Only an explicit UNAVAILABLE yields the dead-end "unavailable" screen.
 * Anything unrecognized falls back to PERMISSION_DENIED, which is recoverable:
 * a one-time grant that Android silently revoked, or an OEM-specific result
 * string, must leave the doctor with a working "Grant access" button rather
 * than a message claiming the device cannot do speech recognition at all.
 */
export const toRecordingState = result => {
  switch (result) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return RECORDING_STATE.LISTENING;
    case RESULTS.BLOCKED:
      return RECORDING_STATE.PERMISSION_BLOCKED;
    case RESULTS.UNAVAILABLE:
      return RECORDING_STATE.UNAVAILABLE;
    case RESULTS.DENIED:
    default:
      return RECORDING_STATE.PERMISSION_DENIED;
  }
};

export { RESULTS };
