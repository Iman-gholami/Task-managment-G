// Reporting periods shared by dashboards, performance, reports and shift history.
// The server resolves the same keys (lib/server/stats.js → resolvePeriod).
import { TODAY, addDays, monthName } from "@/lib/format";

export const PERIODS = [["this", "This month"], ["last", "Last month"], ["quarter", "This quarter"]];

const iso = (d) => d.toISOString().slice(0, 10);
const validRange = (r) => r?.from && r?.to && r.from <= r.to;

/** Query string for a period key (plus a from/to range when `custom`). Invalid ranges fall back to this month. */
export const periodQuery = (period, range) =>
  period === "custom" && validRange(range) ? `period=custom&from=${range.from}&to=${range.to}` : `period=${period === "custom" ? "this" : period}`;

/**
 * The period immediately before `period`, with the same shape (month → previous month,
 * quarter → previous quarter, custom → the same number of days before it). Used for comparisons.
 * Returns { query, label } or null when there is nothing to compare.
 */
export function previousPeriod(period, range) {
  const [y, m] = TODAY.split("-").map(Number);
  const month = (offset) => ({ from: iso(new Date(Date.UTC(y, m - 1 + offset, 1))), to: iso(new Date(Date.UTC(y, m + offset, 0))) });
  let r, label;
  if (period === "this") { r = month(-1); label = `vs ${monthName(r.from)}`; }
  else if (period === "last") { r = month(-2); label = `vs ${monthName(r.from)}`; }
  else if (period === "quarter") {
    const q = Math.floor((m - 1) / 3) * 3;
    r = { from: iso(new Date(Date.UTC(y, q - 3, 1))), to: iso(new Date(Date.UTC(y, q, 0))) };
    label = "vs last quarter";
  } else if (period === "custom" && validRange(range)) {
    const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 864e5) + 1;
    const to = addDays(range.from, -1);
    r = { from: addDays(to, 1 - days), to };
    label = "vs previous period";
  } else return null;
  return { query: `period=custom&from=${r.from}&to=${r.to}`, label };
}
