// Reporting periods, like-for-like comparisons and time buckets, in the Jalali or the Gregorian calendar.
// Without options everything resolves in the Jalali calendar with Persian labels, as the analytics screens expect.
// `{ calendar, locale }` picks the calendar of the units (month, season/quarter, year) and the language of the labels.
import { addDays, diffDays, faDigits, fromJalali, maxIso, minIso, J_MONTHS } from "./calendar.js";
import { DEFAULT_LOCALE, calendarOf, isLocale } from "../i18n/config.js";
import { createT } from "../i18n/index.js";
import { createFormat } from "../i18n/format.js";
import {
  addMonths, isCalendar, isIsoDay, monthEnd, monthStart, quarterEnd, quarterStart, todayIso, weekStart, yearEnd, yearStart, ymd,
} from "../i18n/dates.js";

// Persian labels for the current analytics screens; new screens use presetLabel(t, key) and friends.
export const PRESETS = [
  ["month", "ماه جاری"],
  ["prev-month", "ماه گذشته"],
  ["season", "فصل جاری"],
  ["prev-season", "فصل گذشته"],
  ["year", "سال جاری"],
  ["last-7", "۷ روز اخیر"],
  ["last-30", "۳۰ روز اخیر"],
  ["last-90", "۹۰ روز اخیر"],
  ["last-365", "۱۲ ماه اخیر"],
  ["custom", "بازه دلخواه"],
];
export const PRESET_LABEL = Object.fromEntries(PRESETS);

export const COMPARISONS = [
  ["prev", "دوره قبل (هم‌اندازه)"],
  ["yoy", "همین بازه در سال قبل"],
  ["none", "بدون مقایسه"],
];

export const GRANULARITIES = [
  ["auto", "خودکار"],
  ["day", "روزانه"],
  ["week", "هفتگی"],
  ["month", "ماهانه"],
  ["season", "فصلی"],
  ["year", "سالانه"],
];
export const GRAN_LABEL = Object.fromEntries(GRANULARITIES);

export const PRESET_KEYS = PRESETS.map(([k]) => k);
export const COMPARISON_KEYS = COMPARISONS.map(([k]) => k);
export const GRANULARITY_KEYS = GRANULARITIES.map(([k]) => k);

// Dictionary keys are camelCase: "prev-month" → dates.presets.prevMonth, "last-30" → dates.presets.last30.
const dictKey = (key) => String(key).replace(/-(\w)/g, (_, c) => c.toUpperCase());
const tOf = (t) => (typeof t === "function" ? t : createT(t));

/** "ماه جاری" | "This month". `t` is a translator from createT (or a locale). */
export const presetLabel = (t, key) => tOf(t).maybe(`dates.presets.${dictKey(key)}`, undefined, PRESET_LABEL[key] ?? key);
/** "دورهٔ قبل (هم‌اندازه)" | "Previous period (same length)". */
export const comparisonLabel = (t, key) => tOf(t).maybe(`dates.comparisons.${key}`, undefined, key);
/** "هفتگی" | "Weekly". */
export const granularityLabel = (t, key) => tOf(t).maybe(`dates.granularities.${key}`, undefined, GRAN_LABEL[key] ?? key);

/** Calendar unit of a preset: the comparison steps back one whole unit. */
const UNIT = { month: "month", "prev-month": "month", season: "season", "prev-season": "season", year: "year" };
// A "season" is a Jalali season, or a quarter in the Gregorian calendar.
const UNITS = {
  month: { start: monthStart, end: monthEnd },
  season: { start: quarterStart, end: quarterEnd },
  year: { start: yearStart, end: yearEnd },
};

/**
 * Calendar and language for one call: the first valid calendar of `first` (filters.cal or range.calendar) and
 * `opts.calendar`, else the language's own calendar (Jalali by default).
 */
function context(opts = {}, first) {
  const locale = isLocale(opts?.locale) ? opts.locale : DEFAULT_LOCALE;
  const calendar = [first, opts?.calendar].find(isCalendar) ?? calendarOf(locale);
  const fmt = createFormat(locale);
  // Unit names ("مهر ۱۴۰۵", "October 2026") exist in the language's own calendar only; otherwise labels show the exact range.
  return { calendar, locale, fmt, t: createT(locale), named: calendar === fmt.calendar };
}

/** "مهر ۱۴۰۵" | "October 2026", "پاییز ۱۴۰۵" | "Q4 2026", "سال ۱۴۰۵" | "2026"; null when the calendars differ. */
function unitName(c, unit, iso) {
  if (!c.named) return null;
  if (unit === "month") return c.fmt.date(iso, "monthYear");
  const { y, m } = ymd(iso, c.calendar);
  const year = c.fmt.digits(y);
  if (unit === "season") return `${c.t(`dates.seasons.${Math.ceil(m / 3)}`)} ${year}`;
  return c.t("dates.period.year", { year });
}

/**
 * Resolves the selected period. `end` is the last day that has happened (min(to, today)),
 * so a running month is measured up to today and compared like for like.
 * Valid `from`/`to` in the filters pin the dates for any preset (a shared link shows the same days to everyone);
 * the preset keeps its calendar unit only when the pinned dates are exactly one whole unit.
 */
export function resolveRange(filters, today = todayIso(), opts = {}) {
  const { p = "month", from, to, cal } = filters ?? {};
  const c = context(opts, cal);
  const pinned = isIsoDay(from) && isIsoDay(to) && from <= to;
  let preset = PRESET_LABEL[p] ? p : "month";
  if (preset === "custom" && !pinned) preset = "month";
  let unit = UNIT[preset] ?? null;
  let r;
  if (pinned) {
    r = { from, to };
    if (unit && !(UNITS[unit].start(from, c.calendar) === from && UNITS[unit].end(from, c.calendar) === to)) unit = null;
  } else if (preset.startsWith("last-")) {
    const n = Number(preset.slice(5));
    r = { from: addDays(today, -(n - 1)), to: today };
  } else {
    const u = UNITS[unit];
    const anchor = preset.startsWith("prev-") ? addDays(u.start(today, c.calendar), -1) : today;
    r = { from: u.start(anchor, c.calendar), to: u.end(anchor, c.calendar) };
  }
  const end = minIso(r.to, today);
  const empty = end < r.from;
  const days = empty ? 0 : diffDays(r.from, end) + 1;
  const label = (unit && unitName(c, unit, r.from)) || c.fmt.range(r.from, r.to);
  return {
    preset, from: r.from, to: r.to, end: empty ? r.from : end, days, empty, partial: !empty && end < r.to,
    unit, label, calendar: c.calendar,
  };
}

/**
 * The period to compare with, the same length as the elapsed part of `range`.
 * Calendar presets step back one whole unit (month, season, year) in the range's calendar; rolling and custom
 * ranges use the days immediately before; "yoy" uses the same calendar dates a year earlier.
 */
export function comparisonRange(range, mode = "prev", opts = {}) {
  if (mode === "none" || range.empty) return null;
  const c = context(opts, range.calendar);
  const short = c.t("dates.period.previous");
  if (mode === "yoy") {
    const from = addMonths(range.from, -12, c.calendar), to = addMonths(range.end, -12, c.calendar);
    return { from, to, end: to, days: diffDays(from, to) + 1, label: c.t("dates.period.sameLastYear"), short: c.t("dates.period.lastYear") };
  }
  if (range.unit) {
    const u = UNITS[range.unit];
    const start = u.start(addDays(range.from, -1), c.calendar);
    const unitEnd = u.end(start, c.calendar);
    const to = minIso(addDays(start, range.days - 1), unitEnd);
    const name = unitName(c, range.unit, start);
    const label = !name ? c.fmt.range(start, to) : range.partial ? c.t("dates.period.firstDays", { count: range.days, name }) : name;
    return { from: start, to, end: to, days: diffDays(start, to) + 1, label, short };
  }
  const to = addDays(range.from, -1);
  const from = addDays(to, -(range.days - 1));
  return { from, to, end: to, days: range.days, label: c.t("dates.period.daysBefore", { count: range.days }), short };
}

/** Bucket size for a range: days up to ~a month, weeks up to ~6 months, then months, then seasons. */
export function autoGranularity(days) {
  if (days <= 35) return "day";
  if (days <= 190) return "week";
  if (days <= 800) return "month";
  return "season";
}

const nextStart = {
  day: (iso) => addDays(iso, 1),
  week: (iso) => addDays(weekStart(iso), 7),
  month: (iso, cal) => addDays(monthEnd(iso, cal), 1),
  season: (iso, cal) => addDays(quarterEnd(iso, cal), 1),
  year: (iso, cal) => addDays(yearEnd(iso, cal), 1),
};
const naturalStart = { day: (i) => i, week: weekStart, month: monthStart, season: quarterStart, year: yearStart };

/**
 * Splits [from, to] into calendar buckets. Weeks start on Saturday in both calendars. Partial first and last buckets
 * are flagged so charts can say so (a week that started before the range is not a full week).
 */
export function buckets(from, to, gran, opts = {}) {
  const out = [];
  if (!from || !to || from > to) return out;
  if (gran === "auto") gran = autoGranularity(diffDays(from, to) + 1);
  if (!nextStart[gran]) gran = "day";
  const c = context(opts);
  const label = {
    day: (a) => c.fmt.date(a, "short"),
    week: (a) => c.t("dates.period.week", { date: c.fmt.date(weekStart(a), "short") }),
    month: (a, b) => unitName(c, "month", a) ?? c.fmt.range(a, b),
    season: (a, b) => unitName(c, "season", a) ?? c.fmt.range(a, b),
    year: (a, b) => (c.named ? c.fmt.digits(ymd(a, c.calendar).y) : c.fmt.range(a, b)),
  }[gran];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 5000) {
    const next = nextStart[gran](cur, c.calendar);
    const bTo = minIso(addDays(next, -1), to);
    const full = naturalStart[gran](cur, c.calendar) === cur && addDays(bTo, 1) === next;
    out.push({ from: cur, to: bTo, label: label(cur, bTo), partial: gran !== "day" && !full });
    cur = next;
  }
  return out;
}

/** "مهر ۱۴۰۵" style label for one day of the Jalali month grid (date picker). */
export const monthTitle = (jy, jm) => faDigits(`${J_MONTHS[jm - 1]} ${jy}`);
export { fromJalali, maxIso };
