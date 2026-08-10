import { getAnuvadiniToken } from '../services/appConfigService';
import { resolveTransport, TRANSPORT } from './endpoints';

export const CONCURRENT_CAPTURE_VERIFIED = true;
export function isCaptureEnabled() {
  return CONCURRENT_CAPTURE_VERIFIED;
}

export function isTranscriptionAvailable() {
  return resolveTransport(getAnuvadiniToken()) !== TRANSPORT.NONE;
}
