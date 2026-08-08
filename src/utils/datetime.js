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

export function formatRelativeDateTime(epochMs, now = Date.now()) {
  if (!epochMs) {
    return '';
  }

  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (date.getTime() >= startOfToday.getTime()) {
    return `Today, ${time}`;
  }
  if (date.getTime() >= startOfToday.getTime() - dayMs) {
    return `Yesterday, ${time}`;
  }
  return formatDateTime(epochMs);
}

export function fileStamp(epochMs = Date.now()) {
  const date = new Date(epochMs);
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}
