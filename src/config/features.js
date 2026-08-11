import {
  getAnuvadiniToken,
  getPravahKey,
} from '../services/appConfigService';
import {
  resolveTransport,
  resolveTranslationTransport,
  TRANSPORT,
} from './endpoints';

export const CONCURRENT_CAPTURE_VERIFIED = true;
export function isCaptureEnabled() {
  return CONCURRENT_CAPTURE_VERIFIED;
}

export function isTranscriptionAvailable() {
  return resolveTransport(getAnuvadiniToken()) !== TRANSPORT.NONE;
}

export function isTranslationAvailable() {
  return resolveTranslationTransport(getPravahKey()) !== TRANSPORT.NONE;
}
