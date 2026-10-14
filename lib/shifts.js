export const APP_TIME_ZONE = "Asia/Tehran";

export const SHIFT_TYPES = {
  morning: {
    key: "morning",
    label: "Morning",
    shortLabel: "Morning",
    start: "07:30",
    end: "15:15",
    hours: 7.75,
  },
  evening: {
    key: "evening",
    label: "Until 20:00",
    shortLabel: "Until 8",
    start: "07:30",
    end: "20:00",
    hours: 12.5,
    extended: true,
  },
  night: {
    key: "night",
    label: "Night",
    shortLabel: "Night",
    start: "20:00",
    end: "08:00",
    hours: 12,
    overnight: true,
  },
};

export const SHIFT_TYPE_KEYS = Object.keys(SHIFT_TYPES);

/** Non-working rota statuses. They never generate worked hours or a Shift Log. */
export const DAY_STATUS_TYPES = {
  off: { key: "off", label: "تعطیل شیفت", shortLabel: "تعطیل" },
  leave: { key: "leave", label: "مرخصی", shortLabel: "مرخصی" },
};
export const DAY_STATUS_KEYS = Object.keys(DAY_STATUS_TYPES);
export const ROSTER_KEYS = [...SHIFT_TYPE_KEYS, ...DAY_STATUS_KEYS];
export const isDayStatus = (value) => DAY_STATUS_KEYS.includes(value);

export const EXTENDED_SHIFT_TASK_TITLES = [
  "Prepare Daily Traffic Report",
  "Add IOCs to MISP and Share Them via Bale",
  "Upload Malicious IP and Domain Files to the Website",
];

export const isShiftType = (value) => SHIFT_TYPE_KEYS.includes(value);
export const shiftInfo = (value) => SHIFT_TYPES[value] ?? null;

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function monthBounds(month) {
  if (!/^\d{4}-\d{2}$/.test(month ?? "")) return null;
  const [year, rawMonth] = month.split("-").map(Number);
  if (rawMonth < 1 || rawMonth > 12) return null;
  const last = new Date(Date.UTC(year, rawMonth, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function scheduleStats(schedules) {
  const stats = {
    hours: 0,
    total: 0,
    thursdays: 0,
    fridays: 0,
    morning: 0,
    evening: 0,
    night: 0,
    off: 0,
    leave: 0,
  };
  for (const item of schedules) {
    const info = SHIFT_TYPES[item.shiftType];
    if (!isIsoDate(item.date)) continue;
    if (isDayStatus(item.shiftType)) {
      stats[item.shiftType] += 1;
      continue;
    }
    if (!info) continue;
    stats.total += 1;
    stats.hours += info.hours;
    stats[item.shiftType] += 1;
    const day = new Date(`${item.date}T00:00:00Z`).getUTCDay();
    if (day === 4) stats.thursdays += 1;
    if (day === 5) stats.fridays += 1;
  }
  stats.hours = Math.round(stats.hours * 100) / 100;
  return stats;
}

export function tehranDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
