import en from './en.js';
import hi from './hi.js';

const CATALOGS = { en, hi };

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
