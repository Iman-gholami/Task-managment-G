// Number formatting for the Persian analytics screens. Missing values render as "—", never as 0.
import { MIN_BASE_FOR_CHANGE } from "./config.js";

const NF = Object.fromEntries(["fa", "en"].map((locale) => [locale, [0, 1, 2].map((digits) =>
  new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: digits })
)]));
const formatter = (locale, digits) => NF[locale === "en" ? "en" : "fa"][Math.max(0, Math.min(2, digits))];

export const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** 1234.5 → "۱٬۲۳۴٫۵"; null → "—". */
export const fmtNum = (v, digits = 1, locale = "fa") => (isNum(v) ? formatter(locale, digits).format(v) : "—");
export const fmtInt = (v, locale = "fa") => fmtNum(isNum(v) ? Math.round(v) : v, 0, locale);
/** A share (0–1) as a percentage: 0.853 → "۸۵٪". */
export const fmtPct = (v, digits = 0, locale = "fa") => (isNum(v) ? `${formatter(locale, digits).format(v * 100)}${locale === "fa" ? "٪" : "%"}` : "—");
export const fmtDays = (v, locale = "fa") => (isNum(v) ? `${formatter(locale, 1).format(v)} ${locale === "fa" ? "روز" : v === 1 ? "day" : "days"}` : "—");
export const fmtHours = (v, locale = "fa") => (isNum(v) ? `${formatter(locale, 0).format(v)} ${locale === "fa" ? "ساعت" : v === 1 ? "hour" : "hours"}` : "—");

/** Formats a value by metric kind (see METRICS in metrics.js). */
export function fmtMetric(v, kind, locale = "fa") {
  if (kind === "rate") return fmtPct(v, 0, locale);
  if (kind === "days") return fmtDays(v, locale);
  if (kind === "avg") return fmtNum(v, 1, locale);
  return fmtNum(v, isNum(v) && !Number.isInteger(v) ? 1 : 0, locale);
}

/**
 * Change between two values. Rates change in percentage points; counts in percent, and only when
 * the earlier value is big enough for a percentage to mean something.
 * Returns { dir: "up" | "down" | "flat", text, value } or null when there is nothing honest to say.
 */
export function change(now, before, kind = "count", locale = "fa") {
  if (!isNum(now) || !isNum(before)) return null;
  if (kind === "rate") {
    const pts = (now - before) * 100;
    if (Math.abs(pts) < 0.5) return { dir: "flat", text: locale === "fa" ? "بدون تغییر" : "No change", value: 0 };
    return { dir: pts > 0 ? "up" : "down", text: `${formatter(locale, 0).format(Math.abs(pts))} ${locale === "fa" ? "واحد درصد" : "percentage points"}`, value: pts / 100 };
  }
  if (Math.abs(before) < (kind === "days" || kind === "avg" ? 1e-9 : MIN_BASE_FOR_CHANGE)) {
    const d = now - before;
    if (Math.abs(d) < 1e-9) return { dir: "flat", text: locale === "fa" ? "بدون تغییر" : "No change", value: 0 };
    return { dir: d > 0 ? "up" : "down", text: fmtNum(Math.abs(d), kind === "count" ? 0 : 1, locale), value: null, absolute: true };
  }
  const pct = (now - before) / Math.abs(before);
  if (Math.abs(pct) < 0.005) return { dir: "flat", text: locale === "fa" ? "بدون تغییر" : "No change", value: 0 };
  return { dir: pct > 0 ? "up" : "down", text: `${formatter(locale, 0).format(Math.abs(pct) * 100)}${locale === "fa" ? "٪" : "%"}`, value: pct };
}

/** Median of a numeric list (null when empty). */
export function median(xs) {
  const v = xs.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Safe division: null when the denominator is 0. */
export const ratio = (a, b) => (b ? a / b : null);
