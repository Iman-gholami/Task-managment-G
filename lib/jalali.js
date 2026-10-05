// Solar Hijri (Jalali) calendar helpers, shared by the server and the UI. Built on the
// `persian` calendar of Intl (the same one the Persian shift screens use), so every screen
// agrees on where a month starts. Dates in and out are ISO (Gregorian) "YYYY-MM-DD" strings.

export const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const JALALI_SEASONS = ["بهار", "تابستان", "پاییز", "زمستان"];
/** Persian weekday names, indexed like Date#getUTCDay (0 = Sunday). */
export const WEEKDAYS_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

const CAL = new Intl.DateTimeFormat("en-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
const FA = "۰۱۲۳۴۵۶۷۸۹";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const utc = (s) => new Date(`${s}T00:00:00Z`);
const addDays = (s, n) => new Date(utc(s).getTime() + n * 864e5).toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, "0");

export const faDigits = (v) => String(v).replace(/\d/g, (d) => FA[d]);
export const isIsoDate = (s) => ISO_DATE.test(s ?? "") && !Number.isNaN(utc(s).getTime()) && utc(s).toISOString().slice(0, 10) === s;

/** { year, month, day } of an ISO date in the Jalali calendar. */
export function jalaliParts(s) {
  const p = Object.fromEntries(CAL.formatToParts(utc(s)).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}

/** "1405/07/13" (or with Persian digits). Empty for a missing date. */
export function fmtJalali(s, { fa = false } = {}) {
  if (!s || !isIsoDate(String(s).slice(0, 10))) return "";
  const { year, month, day } = jalaliParts(String(s).slice(0, 10));
  const out = `${year}/${pad(month)}/${pad(day)}`;
  return fa ? faDigits(out) : out;
}

/** "YYYY-MM" key of the Jalali month an ISO date falls in. */
export function jalaliMonthKey(s) {
  const { year, month } = jalaliParts(s);
  return `${year}-${pad(month)}`;
}

const nowruzCache = new Map();
/** ISO date of 1 Farvardin of a Jalali year (around 20–21 March). */
function nowruz(year) {
  if (!nowruzCache.has(year)) {
    let d = `${year + 621}-03-17`;
    for (let i = 0; i < 10 && !(jalaliParts(d).year === year && jalaliParts(d).month === 1); i++) d = addDays(d, 1);
    nowruzCache.set(year, d);
  }
  return nowruzCache.get(year);
}

// Months 1–6 have 31 days and 7–11 have 30, so only Esfand's length depends on the year.
const monthStart = (year, month) => (month > 12 ? nowruz(year + 1) : addDays(nowruz(year), month <= 7 ? (month - 1) * 31 : 186 + (month - 7) * 30));

export const jalaliMonthRange = (year, month) => ({ from: monthStart(year, month), to: addDays(monthStart(year, month + 1), -1) });
export const jalaliSeasonRange = (year, season) => ({ from: monthStart(year, season * 3 - 2), to: addDays(monthStart(year, season * 3 + 1), -1) });
export const jalaliYearRange = (year) => ({ from: nowruz(year), to: addDays(nowruz(year + 1), -1) });

export const monthLabel = (year, month) => `${JALALI_MONTHS[month - 1]} ${faDigits(year)}`;
export const seasonLabel = (year, season) => `${JALALI_SEASONS[season - 1]} ${faDigits(year)}`;
export const yearLabel = (year) => `سال ${faDigits(year)}`;

/** Label for a "YYYY-MM" month key: "مهر ۱۴۰۵". */
export function monthKeyLabel(key) {
  const [y, m] = String(key).split("-").map(Number);
  return y && m >= 1 && m <= 12 ? monthLabel(y, m) : String(key);
}

/** Every "YYYY-MM" Jalali month key that overlaps the range. */
export function monthKeysBetween(from, to) {
  const keys = [];
  let { year, month } = jalaliParts(from);
  const end = jalaliMonthKey(to);
  for (let i = 0; i < 240; i++) {
    const key = `${year}-${pad(month)}`;
    keys.push(key);
    if (key >= end) break;
    month === 12 ? ((year += 1), (month = 1)) : (month += 1);
  }
  return keys;
}

const plausibleYear = (y) => Number.isInteger(y) && y >= 1390 && y <= 1500;

/**
 * Resolves a report period from query parameters:
 *   period=month&key=1405-07 · period=season&key=1405-3 · period=year&key=1405 · period=custom&from&to
 * Anything invalid falls back to the current Jalali month. Returns { period, key, from, to, label, month? }
 * where `month` is set when the period is exactly one Jalali month (the month evaluations belong to).
 */
export function resolveJalaliPeriod(q = {}, today) {
  const now = jalaliParts(today);
  const key = String(q.key ?? "");
  if (q.period === "season") {
    const [, y, s] = key.match(/^(\d{4})-([1-4])$/) ?? [];
    if (plausibleYear(Number(y))) return { period: "season", key, ...jalaliSeasonRange(Number(y), Number(s)), label: seasonLabel(Number(y), Number(s)) };
  }
  if (q.period === "year" && plausibleYear(Number(key)) && /^\d{4}$/.test(key)) {
    return { period: "year", key, ...jalaliYearRange(Number(key)), label: yearLabel(Number(key)) };
  }
  if (q.period === "custom" && isIsoDate(q.from) && isIsoDate(q.to) && q.from <= q.to) {
    return { period: "custom", key: `${q.from}_${q.to}`, from: q.from, to: q.to, label: `${fmtJalali(q.from, { fa: true })} تا ${fmtJalali(q.to, { fa: true })}` };
  }
  if (q.period === "month" || !q.period) {
    const [, y, m] = key.match(/^(\d{4})-(\d{2})$/) ?? [];
    if (plausibleYear(Number(y)) && Number(m) >= 1 && Number(m) <= 12) {
      return { period: "month", key, month: key, ...jalaliMonthRange(Number(y), Number(m)), label: monthLabel(Number(y), Number(m)) };
    }
  }
  const current = `${now.year}-${pad(now.month)}`;
  return { period: "month", key: current, month: current, ...jalaliMonthRange(now.year, now.month), label: monthLabel(now.year, now.month) };
}

/** Choices for a period picker, newest first: the last 12 months, the last 4 seasons and the last 2 years. */
export function periodChoices(today) {
  const { year, month } = jalaliParts(today);
  const months = Array.from({ length: 12 }, (_, i) => {
    const m0 = month - 1 - i;
    const y = year + Math.floor(m0 / 12);
    const m = ((m0 % 12) + 12) % 12 + 1;
    return { period: "month", key: `${y}-${pad(m)}`, label: monthLabel(y, m) };
  });
  const season = Math.ceil(month / 3);
  const seasons = Array.from({ length: 4 }, (_, i) => {
    const s0 = season - 1 - i;
    const y = year + Math.floor(s0 / 4);
    const s = ((s0 % 4) + 4) % 4 + 1;
    return { period: "season", key: `${y}-${s}`, label: seasonLabel(y, s) };
  });
  const years = [year, year - 1].map((y) => ({ period: "year", key: String(y), label: yearLabel(y) }));
  return { months, seasons, years };
}
