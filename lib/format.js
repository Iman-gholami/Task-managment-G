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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
