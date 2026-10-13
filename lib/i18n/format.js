// Locale-aware output: numbers, percentages, dates, ranges, times, relative times and deadlines.
// fa → Persian digits and the Jalali calendar, en → Latin digits and the Gregorian calendar. Dates are built from
// lib/i18n/dates.js and the dictionary (dates.*), never from Intl calendars, so the server and the browser render
// the same text. Numbers use Intl (fa-IR gives Persian digits and the Persian decimal separator).
//
//   const fmt = createFormat("fa");
//   fmt.percent(0.85)                                → "۸۵٪"            (en: "85%")
//   fmt.date("2026-10-06")                           → "۱۴ مهر ۱۴۰۵"     (en: "Oct 6, 2026")
//   fmt.range("2026-09-23", "2026-10-06")            → "۱ تا ۱۴ مهر ۱۴۰۵"
//   fmt.due("2026-10-10", { today: "2026-10-13" })   → { text: "۳ روز تأخیر", tone: "overdue", days: -3 }
import { DEFAULT_LOCALE, INTL_LOCALE, calendarOf, isLocale } from "./config.js";
import { createT } from "./index.js";
import { parseNumber, toLocaleDigits } from "./digits.js";
import { ISO, diffDays, parseTimestamp, tehranParts, todayIso, weekdayIndex, ymd } from "./dates.js";

const DASH = "—";
const pad = (n) => String(n).padStart(2, "0");
const toNum = (v) => (typeof v === "number" ? v : typeof v === "string" ? parseNumber(v) : NaN);

// Word order per language; the words (month and weekday names, the range joiner) come from the dictionary.
// `month`/`weekdayShort` are the short names (the same as the full ones in Persian).
const PATTERNS = {
  fa: {
    date: {
      short: (p) => `${p.d} ${p.month}`,
      medium: (p) => `${p.d} ${p.month} ${p.y}`,
      long: (p) => `${p.weekday} ${p.d} ${p.monthLong} ${p.y}`,
      numeric: (p) => `${p.y}/${p.mm}/${p.dd}`,
      monthYear: (p) => `${p.monthLong} ${p.y}`,
      weekdayShort: (p) => `${p.weekdayShort} ${p.d} ${p.month}`,
    },
    rangeMonth: (a, b, to) => `${a.d} ${to} ${b.d} ${a.month} ${a.y}`,
    rangeYear: (a, b, to) => `${a.d} ${a.month} ${to} ${b.d} ${b.month} ${b.y}`,
    dateTime: (date, time) => `${date}، ${time}`,
  },
  en: {
    date: {
      short: (p) => `${p.month} ${p.d}`,
      medium: (p) => `${p.month} ${p.d}, ${p.y}`,
      long: (p) => `${p.weekday}, ${p.monthLong} ${p.d}, ${p.y}`,
      numeric: (p) => `${p.y}-${p.mm}-${p.dd}`,
      monthYear: (p) => `${p.monthLong} ${p.y}`,
      weekdayShort: (p) => `${p.weekdayShort}, ${p.month} ${p.d}`,
    },
    rangeMonth: (a, b, to) => `${a.month} ${a.d} ${to} ${b.d}, ${a.y}`,
    rangeYear: (a, b, to) => `${a.month} ${a.d} ${to} ${b.month} ${b.d}, ${b.y}`,
    dateTime: (date, time) => `${date}, ${time}`,
  },
};
export const DATE_STYLES = Object.keys(PATTERNS.fa.date);

/** The calendar day of an ISO day, a timestamp (its Tehran day) or a Date; null when there is none. */
function dayOf(value) {
  if (value === null || value === undefined || value === "" || value === DASH) return null;
  if (typeof value === "string" && ISO.test(value)) return value;
  return tehranParts(value)?.date ?? null;
}

const cache = new Map();

/** Formatting helpers for one language (cached, so every caller shares the Intl objects). */
export function createFormat(locale = DEFAULT_LOCALE) {
  const lang = isLocale(locale) ? locale : DEFAULT_LOCALE;
  if (cache.has(lang)) return cache.get(lang);
  const t = createT(lang);
  const tag = INTL_LOCALE[lang];
  const calendar = calendarOf(lang);
  const P = PATTERNS[lang];

  const memo = new Map();
  const intl = (key, make) => {
    let v = memo.get(key);
    if (!v) memo.set(key, (v = make()));
    return v;
  };
  const words = {};
  const word = (family, i) => ((words[family] ??= {})[i] ??= t(`dates.${family}.${i}`));
  const rtf = (numeric) => intl(`rt:${numeric}`, () => new Intl.RelativeTimeFormat(tag, { numeric }));

  const digits = (str) => toLocaleDigits(str, lang);

  /** 1234.5 → "۱۲۳۴٫۵" / "1234.5"; grouping from five digits on ("۱۲٬۳۴۵"); "—" when there is no number. */
  function number(v, { digits: max = 1, min = 0, signed = false } = {}) {
    const n = toNum(v);
    if (!Number.isFinite(n)) return DASH;
    const nf = intl(`n:${max}:${min}:${signed}`, () => new Intl.NumberFormat(tag, {
      minimumFractionDigits: min,
      maximumFractionDigits: Math.max(min, max),
      useGrouping: "min2",
      signDisplay: signed ? "exceptZero" : "negative", // never "-0"
    }));
    return nf.format(n);
  }
  const int = (v) => number(Math.round(toNum(v)), { digits: 0 });
  const decimal = (v, d = 1) => number(v, { digits: d });
  /** A share (0–1) as a percentage: 0.85 → "۸۵٪" / "85%". */
  function percent(share, d = 0) {
    const n = toNum(share);
    if (!Number.isFinite(n)) return DASH;
    return intl(`p:${d}`, () => new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: d, useGrouping: "min2", signDisplay: "negative" })).format(n);
  }

  /** Month 1–12 of the language's calendar (Jalali in fa, Gregorian in en). */
  const monthName = (m, { short = false } = {}) => word(short ? "monthsShort" : "months", m);
  /** Weekday 0–6, 0 = Saturday. */
  const weekdayName = (i, { short = false, narrow = false } = {}) => word(narrow ? "weekdaysNarrow" : short ? "weekdaysShort" : "weekdays", i);

  function parts(iso) {
    const { y, m, d } = ymd(iso, calendar);
    const wd = weekdayIndex(iso);
    return {
      year: y, monthNo: m,
      y: digits(y), d: digits(d), mm: digits(pad(m)), dd: digits(pad(d)),
      month: monthName(m, { short: true }), monthLong: monthName(m),
      weekday: weekdayName(wd), weekdayShort: weekdayName(wd, { short: true }),
    };
  }

  /**
   * "short" ۱۴ مهر | Oct 14 · "medium" ۱۴ مهر ۱۴۰۵ | Oct 14, 2026 · "long" سه‌شنبه ۱۴ مهر ۱۴۰۵ | Wednesday, October 14, 2026
   * · "numeric" ۱۴۰۵/۰۷/۱۴ | 2026-10-14 · "monthYear" مهر ۱۴۰۵ | October 2026 · "weekdayShort" سه‌شنبه ۱۴ مهر | Wed, Oct 14.
   * Accepts an ISO day, a timestamp (shown as its Tehran day) or a Date.
   */
  function date(value, style = "medium") {
    const day = dayOf(value);
    if (!day) return DASH;
    return (P.date[style] ?? P.date.medium)(parts(day));
  }
  /** Short date within the reference day's year, medium otherwise. */
  const near = (day, ref) => date(day, ymd(day, calendar).y === ymd(ref, calendar).y ? "short" : "medium");

  /** "۱ تا ۱۴ مهر ۱۴۰۵" | "Oct 1 – 14, 2026"; across months "۲۵ شهریور تا ۱۴ مهر ۱۴۰۵"; across years two full dates. */
  function range(from, to) {
    const a = dayOf(from), b = dayOf(to);
    if (!a || !b || a === b) return date(a ?? b);
    const pa = parts(a), pb = parts(b);
    const sep = t("dates.rangeTo");
    if (pa.year !== pb.year) return `${P.date.medium(pa)} ${sep} ${P.date.medium(pb)}`;
    return pa.monthNo === pb.monthNo ? P.rangeMonth(pa, pb, sep) : P.rangeYear(pa, pb, sep);
  }

  const clock = (hour, minute) => digits(`${pad(hour)}:${pad(minute)}`);
  /** Tehran wall-clock time, 24-hour: "۱۴:۳۰" | "14:30". A plain "7:30" is only localized. */
  function time(ts) {
    if (typeof ts === "string" && /^\d{1,2}:\d{2}$/.test(ts)) return digits(ts.padStart(5, "0"));
    const p = tehranParts(ts);
    return p ? clock(p.hour, p.minute) : DASH;
  }
  /** "۱۴ مهر ۱۴۰۵، ۱۴:۳۰" | "Oct 14, 2026, 14:30" (Tehran). */
  function dateTime(ts, style = "medium") {
    const p = tehranParts(ts);
    return p ? P.dateTime(date(p.date, style), clock(p.hour, p.minute)) : DASH;
  }

  /**
   * "همین حالا" | "just now" under 45 seconds, then minutes, hours, and calendar days in Tehran up to six
   * ("دیروز" | "yesterday", "۲ روز پیش" | "2 days ago"); older times show the date. Future times read "in …".
   */
  function relative(ts, now = Date.now()) {
    const at = parseTimestamp(ts), ref = parseTimestamp(now);
    if (Number.isNaN(at.getTime()) || Number.isNaN(ref.getTime())) return DASH;
    const secs = (ref.getTime() - at.getTime()) / 1000;
    const abs = Math.abs(secs), sign = secs < 0 ? 1 : -1;
    if (abs < 45) return t("dates.relative.justNow");
    if (abs < 3600) return rtf("auto").format(sign * Math.max(1, Math.floor(abs / 60)), "minute");
    const a = tehranParts(at).date, b = tehranParts(ref).date;
    const days = diffDays(a, b);
    if (abs < 86400 || days === 0) return rtf("auto").format(sign * Math.floor(abs / 3600), "hour");
    // Only ±1 day has a word of its own ("yesterday"); "پریروز" would have no English counterpart.
    if (Math.abs(days) <= 6) return rtf(Math.abs(days) === 1 ? "auto" : "always").format(-days, "day");
    return near(a, b);
  }

  /**
   * A deadline in words. `days` is the signed number of days from `today` (Tehran today by default).
   * Overdue → "۳ روز تأخیر" | "3 days overdue"; today, tomorrow; up to a week → "۵ روز دیگر" | "In 5 days"; later → the date.
   * Closed tasks show the plain date. tone: "overdue", "soon" (within two days), "normal", or "none" without a date.
   */
  function due(iso, { open = true, today } = {}) {
    const day = dayOf(iso);
    if (!day) return { text: t("dates.due.none"), tone: "none", days: null };
    const ref = dayOf(today) ?? todayIso();
    const days = diffDays(ref, day);
    if (!open) return { text: near(day, ref), tone: "normal", days };
    const tone = days < 0 ? "overdue" : days <= 2 ? "soon" : "normal";
    let text;
    if (days < 0) text = t("dates.due.overdue", { count: -days });
    else if (days === 0) text = t("dates.due.today");
    else if (days === 1) text = t("dates.due.tomorrow");
    else if (days <= 7) text = t("dates.due.inDays", { count: days });
    else text = near(day, ref);
    return { text, tone, days };
  }

  /** "۶٫۵ ساعت" | "6.5 h". */
  function hours(v) {
    const n = toNum(v);
    return Number.isFinite(n) ? t("dates.units.hours", { value: number(n, { digits: 1 }) }) : DASH;
  }
  /** "۲٫۵ روز" | "2.5 days". */
  function days(v) {
    const n = toNum(v);
    if (!Number.isFinite(n)) return DASH;
    const shown = Math.round(n * 10) / 10;
    return t("dates.units.days", { value: number(shown, { digits: 1 }), count: shown });
  }
  /** "الف، ب، و ج" | "a, b, and c". */
  function list(items) {
    const xs = [...(items ?? [])].filter((x) => x !== null && x !== undefined && x !== "").map(String);
    return intl("list", () => new Intl.ListFormat(tag, { type: "conjunction" })).format(xs);
  }

  const fmt = {
    locale: lang, calendar,
    number, int, decimal, percent, digits,
    monthName, weekdayName,
    date, range, time, dateTime, relative, due,
    hours, days, list,
  };
  cache.set(lang, fmt);
  return fmt;
}
