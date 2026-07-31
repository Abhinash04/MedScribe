/**
 * Date and time formatting shared by the dashboard list and the PDF footer.
 *
 * Pure, with no React Native imports, so `scripts/test-report.mjs` can assert
 * the PDF payload under plain Node.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * "12 Mar 2026, 14:05" — deliberately not `toLocaleString`, which varies with
 * device locale and would make a saved report read differently on two phones.
 */
export function formatDateTime(epochMs) {
  if (!epochMs) {
    return '';
  }

  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return (
    `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Filename-safe stamp: `20260312-1405`. */
export function fileStamp(epochMs = Date.now()) {
  const date = new Date(epochMs);
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}
