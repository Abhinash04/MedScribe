import as_ from './as.js';
import bn from './bn.js';
import en from './en.js';
import gu from './gu.js';
import hi from './hi.js';
import kn from './kn.js';
import ml from './ml.js';
import mr from './mr.js';
import ne from './ne.js';
import or from './or.js';
import pa from './pa.js';
import ta from './ta.js';
import te from './te.js';
import ur from './ur.js';

const CATALOGS = {
  en,
  as: as_,
  bn,
  gu,
  hi,
  kn,
  ml,
  mr,
  ne,
  or,
  pa,
  ta,
  te,
  ur,
};

export const DEFAULT_CATALOG_CODE = 'en';

export function catalogFor(code) {
  return CATALOGS[code] ?? null;
}

export function hasCatalog(code) {
  return Boolean(CATALOGS[code]);
}

export function catalogCodes() {
  return Object.keys(CATALOGS);
}

export function allCatalogs() {
  return Object.values(CATALOGS);
}
