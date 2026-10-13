// Calendar math on ISO day strings (YYYY-MM-DD) in the Jalali or the Gregorian calendar. Pure and deterministic:
// the Jalali conversion is lib/analytics/calendar.js (no Intl calendars), Gregorian math is UTC arithmetic on whole
// days, so the server and the browser always agree. The organisation's week starts on Saturday and Friday is the
// weekend in both calendars; timestamps are shown in Asia/Tehran.
import {
  ISO, addDays, diffDays, fromJalali, isLeapJalaliYear, jalaliMonthLength, toJalali, weekStart, weekdayIndex,
} from "../analytics/calendar.js";
import { APP_TIME_ZONE, isIsoDate, tehranDate } from "../shifts.js";

export const CALENDARS = ["jalali", "gregorian"];
export const isCalendar = (v) => CALENDARS.includes(v);
const G = "gregorian";

/** A real calendar day in ISO form ("2026-02-30" is not). */
export const isIsoDay = (v) => typeof v === "string" && isIsoDate(v);

export { ISO, addDays, diffDays, weekStart, weekdayIndex };

const pad = (n) => String(n).padStart(2, "0");
const G_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const isLeapGregorian = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export const isLeapYear = (y, cal) => (cal === G ? isLeapGregorian(y) : isLeapJalaliYear(y));

/** Moves months outside 1–12 into the neighbouring years: (1405, 13) → (1406, 1), (2026, 0) → (2025, 12). */
function normalizeMonth(y, m) {
  const k = y * 12 + (m - 1);
  return { y: Math.floor(k / 12), m: (((k % 12) + 12) % 12) + 1 };
}

export function monthLength(y, m, cal) {
  ({ y, m } = normalizeMonth(y, m));
  if (cal === G) return m === 2 && isLeapGregorian(y) ? 29 : G_MONTH_DAYS[m - 1];
  return jalaliMonthLength(y, m);
}

/** ISO day → { y, m, d } in the calendar. */
export function ymd(iso, cal) {
  if (cal === G) {
    const [y, m, d] = iso.split("-").map(Number);
    return { y, m, d };
  }
  const j = toJalali(iso);
  return { y: j.jy, m: j.jm, d: j.jd };
}

/** { y, m, d } in the calendar → ISO day. Months overflow into the next or previous year; the day is clamped to the month. */
export function fromYmd(y, m, d, cal) {
  ({ y, m } = normalizeMonth(y, m));
  const day = Math.min(Math.max(1, d), monthLength(y, m, cal));
  if (cal === G) return `${String(y).padStart(4, "0")}-${pad(m)}-${pad(day)}`;
  return fromJalali(y, m, day);
}

/** Same day `n` months later (or earlier), clamped to the month's length: Jan 31 + 1 → Feb 28/29. */
export function addMonths(iso, n, cal) {
  const { y, m, d } = ymd(iso, cal);
  return fromYmd(y, m + n, d, cal);
}

/** Friday is the weekend. */
export const isWeekend = (iso) => weekdayIndex(iso) === 6;
/** Friday on or after `iso`. */
export const weekEnd = (iso) => addDays(weekStart(iso), 6);

export const monthStart = (iso, cal) => { const { y, m } = ymd(iso, cal); return fromYmd(y, m, 1, cal); };
export const monthEnd = (iso, cal) => { const { y, m } = ymd(iso, cal); return fromYmd(y, m, monthLength(y, m, cal), cal); };

/** Quarter of the year, 1–4. In the Jalali calendar the quarters are the seasons (Farvardin–Khordad is spring). */
export const quarterOf = (iso, cal) => Math.ceil(ymd(iso, cal).m / 3);
export const quarterStart = (iso, cal) => { const { y } = ymd(iso, cal); return fromYmd(y, quarterOf(iso, cal) * 3 - 2, 1, cal); };
export const quarterEnd = (iso, cal) => {
  const { y } = ymd(iso, cal);
  const m = quarterOf(iso, cal) * 3;
  return fromYmd(y, m, monthLength(y, m, cal), cal);
};

export const yearStart = (iso, cal) => fromYmd(ymd(iso, cal).y, 1, 1, cal);
export const yearEnd = (iso, cal) => { const { y } = ymd(iso, cal); return fromYmd(y, 12, monthLength(y, 12, cal), cal); };

/** The 42 days (six Saturday-first weeks) of a month view; the month itself always fits. */
export function monthGrid(y, m, cal) {
  const first = weekStart(fromYmd(y, m, 1, cal));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** Today's date in Tehran. */
export const todayIso = () => tehranDate(new Date());

const LOCAL_TS = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;

/**
 * A timestamp as a Date. Database timestamps ("YYYY-MM-DD HH:MM:SS") are UTC, and so is any ISO string without a
 * zone, so the result never depends on the machine's time zone. Unreadable input gives an invalid Date.
 */
export function parseTimestamp(ts) {
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts !== "string" || !ts.trim()) return new Date(NaN);
  const s = ts.trim();
  if (!LOCAL_TS.test(s)) return new Date(s);
  return new Date(s.length === 10 ? `${s}T00:00:00Z` : `${s.replace(" ", "T")}Z`);
}

let tehranFormat = null;

/** Calendar day and wall-clock time in Tehran: { date: "2026-10-14", hour: 0, minute: 15 }, or null. */
export function tehranParts(ts) {
  const date = parseTimestamp(ts);
  if (Number.isNaN(date.getTime())) return null;
  tehranFormat ??= new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(tehranFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}
