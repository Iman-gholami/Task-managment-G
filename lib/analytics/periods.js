// Reporting periods (Jalali), like-for-like comparisons and time buckets.
import {
  ISO, addDays, diffDays, faDate, faDigits, faMonthLabel, faRange, fromJalali, jMonthEnd, jMonthStart, jSeasonEnd, jSeasonStart,
  jYearAgo, jYearEnd, jYearStart, maxIso, minIso, toJalali, weekStart, J_MONTHS, J_SEASONS,
} from "./calendar.js";

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

const seasonLabel = (iso) => { const j = toJalali(iso); return faDigits(`${J_SEASONS[Math.floor((j.jm - 1) / 3)]} ${j.jy}`); };
const yearLabel = (iso) => faDigits(`سال ${toJalali(iso).jy}`);

/** Calendar unit of a preset: the comparison steps back one whole unit. */
const UNIT = { month: "month", "prev-month": "month", season: "season", "prev-season": "season", year: "year" };
const UNITS = {
  month: { start: jMonthStart, end: jMonthEnd, label: faMonthLabel },
  season: { start: jSeasonStart, end: jSeasonEnd, label: seasonLabel },
  year: { start: jYearStart, end: jYearEnd, label: yearLabel },
};

/**
 * Resolves the selected period. `end` is the last day that has happened (min(to, today)),
 * so a running month is measured up to today and compared like for like.
 */
export function resolveRange({ p = "month", from, to } = {}, today) {
  let preset = PRESET_LABEL[p] ? p : "month";
  let r;
  if (preset === "custom") {
    if (ISO.test(from ?? "") && ISO.test(to ?? "") && from <= to) r = { from, to };
    else preset = "month";
  }
  const unit = UNIT[preset];
  if (preset.startsWith("last-")) {
    const n = Number(preset.slice(5));
    r = { from: addDays(today, -(n - 1)), to: today };
  } else if (UNIT[preset]) {
    const u = UNITS[UNIT[preset]];
    const anchor = preset.startsWith("prev-") ? addDays(u.start(today), -1) : today;
    r = { from: u.start(anchor), to: u.end(anchor) };
  }
  const end = minIso(r.to, today);
  const empty = end < r.from;
  const days = empty ? 0 : diffDays(r.from, end) + 1;
  const label = unit ? UNITS[unit].label(r.from) : faRange(r.from, r.to);
  return { preset, from: r.from, to: r.to, end: empty ? r.from : end, days, empty, partial: !empty && end < r.to, unit: unit ?? null, label };
}

/**
 * The period to compare with, the same length as the elapsed part of `range`.
 * Calendar presets step back one whole unit (month, season, year); rolling and custom ranges use the
 * days immediately before; "yoy" uses the same Jalali dates a year earlier.
 */
export function comparisonRange(range, mode = "prev") {
  if (mode === "none" || range.empty) return null;
  if (mode === "yoy") {
    const from = jYearAgo(range.from), to = jYearAgo(range.end);
    return { from, to, end: to, days: diffDays(from, to) + 1, label: "همین بازه در سال قبل", short: "سال قبل" };
  }
  if (range.unit) {
    const u = UNITS[range.unit];
    const start = u.start(addDays(range.from, -1));
    const unitEnd = u.end(start);
    const to = minIso(addDays(start, range.days - 1), unitEnd);
    const name = u.label(start);
    const label = range.partial ? `${faDigits(range.days)} روز اول ${name}` : name;
    return { from: start, to, end: to, days: diffDays(start, to) + 1, label, short: "دوره قبل" };
  }
  const to = addDays(range.from, -1);
  const from = addDays(to, -(range.days - 1));
  return { from, to, end: to, days: range.days, label: faDigits(`${range.days} روز قبل از آن`), short: "دوره قبل" };
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
  month: (iso) => addDays(jMonthEnd(iso), 1),
  season: (iso) => addDays(jSeasonEnd(iso), 1),
  year: (iso) => addDays(jYearEnd(iso), 1),
};
const bucketLabel = {
  day: (a) => faDate(a, { year: false }),
  week: (a, b) => `هفته ${faDate(weekStart(a), { year: false })}`,
  month: (a) => faMonthLabel(a),
  season: (a) => seasonLabel(a),
  year: (a) => faDigits(toJalali(a).jy),
};
const naturalStart = { day: (i) => i, week: weekStart, month: jMonthStart, season: jSeasonStart, year: jYearStart };

/**
 * Splits [from, to] into calendar buckets. Partial first and last buckets are flagged so charts
 * can say so (a week that started before the range is not a full week).
 */
export function buckets(from, to, gran) {
  const out = [];
  if (!from || !to || from > to) return out;
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 5000) {
    const next = nextStart[gran](cur);
    const bTo = minIso(addDays(next, -1), to);
    const full = naturalStart[gran](cur) === cur && addDays(bTo, 1) === next;
    out.push({ from: cur, to: bTo, label: bucketLabel[gran](cur, bTo), partial: gran !== "day" && !full });
    cur = next;
  }
  return out;
}

/** "مهر ۱۴۰۵" style label for one day of the Jalali month grid (date picker). */
export const monthTitle = (jy, jm) => faDigits(`${J_MONTHS[jm - 1]} ${jy}`);
export { fromJalali, maxIso };
