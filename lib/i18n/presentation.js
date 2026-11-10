import { localDate, localRange } from "../analytics/calendar.js";

// Dashboard statistics use Gregorian reporting periods. Localize the displayed Gregorian
// month name without changing or misrepresenting the dates actually used for aggregation.
export function dashboardMonth(iso, locale) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-gregory" : "en-US", {
    month: "short", timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function dashboardDay(iso, locale) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const weekday = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    weekday: "long", timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
  return `${weekday}${locale === "fa" ? "،" : ","} ${localDate(iso, locale)}`;
}

export const dashboardRange = (from, to, locale) => localRange(from, to, locale);

export function deadlineReason(iso, today, locale) {
  if (!iso || !today || iso === "—") return "";
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86400000);
  if (days <= 0) return "";
  const n = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(days);
  return locale === "fa" ? `${n} روز از سررسید گذشته` : `${n} ${days === 1 ? "day" : "days"} overdue`;
}
