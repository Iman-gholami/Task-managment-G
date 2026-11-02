import { fromJalali, jalaliMonthLength, toJalali } from "@/lib/analytics/calendar";

const digits = (text) => String(text).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
const pad = (n) => String(n).padStart(2, "0");

/** Display a stored Gregorian ISO day as a Solar Hijri date, without a timezone shift. */
export function taskDate(iso, locale = "en") {
  if (!iso || iso === "—") return "—";
  const { jy, jm, jd } = toJalali(iso);
  const result = `${jy}/${pad(jm)}/${pad(jd)}`;
  return locale === "fa" ? result.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]) : result;
}

/** Parse a typed Solar Hijri date, rejecting invalid dates rather than clamping them. */
export function parseTaskDate(value, min = "") {
  const raw = digits(value).trim();
  if (!raw) return { iso: "", error: null };
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(raw);
  if (!match) return { iso: null, error: "Enter a Solar Hijri date as YYYY/MM/DD." };
  const [, y, m, d] = match.map(Number);
  if (y < 1 || y > 3177 || m < 1 || m > 12 || d < 1 || d > jalaliMonthLength(y, m)) return { iso: null, error: "Enter a valid Solar Hijri date." };
  const iso = fromJalali(y, m, d);
  if (min && iso < min) return { iso: null, error: "The deadline cannot be before the start date." };
  return { iso, error: null };
}

/** Stored timestamps are UTC; display their date and time in Iran. */
export function taskWhen(timestamp, locale = "en") {
  if (!timestamp) return "—";
  const date = new Date(timestamp.includes("T") ? timestamp : `${timestamp.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  let time = `${part("hour")}:${part("minute")}`;
  if (locale === "fa") time = time.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  return `${taskDate(day, locale)} · ${time}`;
}
