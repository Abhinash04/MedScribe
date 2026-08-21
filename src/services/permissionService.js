import { Platform } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  check,
  openSettings,
  request,
} from 'react-native-permissions';
import { RECORDING_STATE } from '../constants/recordingStates';

const MIC_PERMISSION = Platform.select({
  android: PERMISSIONS.ANDROID.RECORD_AUDIO,
  ios: PERMISSIONS.IOS.MICROPHONE,
});

export const checkMicPermission = () => check(MIC_PERMISSION);

export const requestMicPermission = () => request(MIC_PERMISSION);

export const openAppSettings = () => openSettings().catch(() => false);

export const isGranted = result =>
  result === RESULTS.GRANTED || result === RESULTS.LIMITED;
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
