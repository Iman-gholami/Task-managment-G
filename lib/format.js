export const TODAY = new Date().toISOString().slice(0, 10);

export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export const STATUS = { backlog: "Backlog", todo: "To Do", progress: "In Progress", review: "Review", done: "Done", blocked: "Blocked", returned: "Returned", cancelled: "Cancelled" };
export const PRIO = { low: "Low", normal: "Normal", high: "High", critical: "Critical" };
export const CX = ["", "Simple", "Medium", "Complex", "Advanced"];
export const QUAL = { excellent: "Excellent", good: "Good", acceptable: "Acceptable", needs: "Needs Improvement" };

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Deterministic (timezone/locale independent) so server and client render identically.
export function fmtDate(iso) {
  if (!iso || iso === "—") return "—";
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function weekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export const initials = (name) => name.split(" ").map((w) => w[0]).join("");

export const isOpen = (t) => !["done", "cancelled"].includes(t.status);

const dayDiff = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(TODAY + "T00:00:00Z")) / 864e5);

/** Deadline in words: "Today", "Tomorrow", "In 3 days", "2 days overdue", or "Oct 8" when far away. */
export function dueLabel(iso, open = true) {
  if (!iso || iso === "—") return null;
  const d = dayDiff(iso);
  if (!open) return fmtDate(iso);
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d <= 7) return `In ${d} days`;
  return fmtDate(iso);
}

/** Timestamp from the API ("YYYY-MM-DD HH:MM:SS" UTC or ISO) → "Today 11:22", "Yesterday 09:10", "Sep 21". */
export function when(ts) {
  if (!ts) return "—";
  const t = new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
  if (Number.isNaN(t.getTime())) return ts;
  const date = t.toISOString().slice(0, 10);
  const time = t.toTimeString().slice(0, 5);
  const d = dayDiff(date);
  if (d === 0) return `Today ${time}`;
  if (d === -1) return `Yesterday ${time}`;
  return fmtDate(date);
}

/** "Sep 1 – 30, 2026", "Jul 1 – Sep 30, 2026", or two full dates across years. */
export function fmtRange(from, to) {
  if (!from || !to) return "";
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (fy === ty && fm === tm) return `${MONTHS[fm - 1]} ${fd} – ${td}, ${ty}`;
  if (fy === ty) return `${MONTHS[fm - 1]} ${fd} – ${MONTHS[tm - 1]} ${td}, ${ty}`;
  return `${longDate(from)} – ${longDate(to)}`;
}

/** Short month name of an ISO date: "Sep". */
export const monthName = (iso) => MONTHS[Number(iso.split("-")[1]) - 1];

/** Labels for the last `n` calendar months ending with the current one: ["Apr 2026", …, "Sep 2026"]. */
export function lastMonths(n, end = TODAY) {
  const [y, m] = end.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - n + i, 1));
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  });
}

/** Labels for the last `n` days ending today: ["Thu Sep 24", …]. */
export function lastDays(n, end = TODAY) {
  return Array.from({ length: n }, (_, i) => {
    const iso = addDays(end, i - n + 1);
    return `${weekday(iso)} ${fmtDate(iso)}`;
  });
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
