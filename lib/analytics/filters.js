// Analytics filters live in the URL so every view is shareable and the Excel export
// receives exactly what the screen shows. The same parser runs in the browser and in the API.
import { ISO } from "./calendar.js";
import { GROUP_BY_KEY, LEVELS, PRIO_KEYS, QUAL_KEYS, SHIFT_KEYS } from "./labels.js";
import { COMPARISONS, GRANULARITIES, PRESET_LABEL } from "./periods.js";

export const DEFAULTS = { p: "month", from: "", to: "", cmp: "prev", g: "auto", team: "", level: "", role: "", prio: "", cx: "", q: "", shift: "", demo: "" };
const ALLOWED = {
  p: (v) => !!PRESET_LABEL[v],
  from: (v) => ISO.test(v),
  to: (v) => ISO.test(v),
  cmp: (v) => COMPARISONS.some(([k]) => k === v),
  g: (v) => GRANULARITIES.some(([k]) => k === v),
  team: (v) => !!GROUP_BY_KEY[v],
  level: (v) => LEVELS.includes(v),
  role: (v) => v === "analyst" || v === "engineer",
  prio: (v) => PRIO_KEYS.includes(v),
  cx: (v) => ["1", "2", "3", "4"].includes(v),
  q: (v) => QUAL_KEYS.includes(v),
  shift: (v) => SHIFT_KEYS.includes(v),
  demo: (v) => v === "1",
};
export const FILTER_KEYS = Object.keys(DEFAULTS);
/** Filters that narrow the data (as opposed to choosing the period, comparison or bucket size). */
export const DATA_FILTERS = ["team", "level", "role", "prio", "cx", "q", "shift"];
export const ADVANCED_FILTERS = ["role", "prio", "cx", "q", "shift"];

/** `params` is URLSearchParams, a Next.js ReadonlyURLSearchParams or a plain object. */
export function parseFilters(params) {
  const get = (k) => (typeof params?.get === "function" ? params.get(k) : params?.[k]) ?? "";
  const f = {};
  for (const k of FILTER_KEYS) {
    const v = String(get(k));
    f[k] = v && ALLOWED[k](v) ? v : DEFAULTS[k];
  }
  if (f.p !== "custom") { f.from = ""; f.to = ""; }
  // A level only exists inside SOC.
  if (f.level && f.team && f.team !== "soc") f.level = "";
  return f;
}

/** Query string for filters (defaults omitted). `extra` adds page-specific keys (compare ids, trend metric…). */
export function filterQuery(f, extra = {}) {
  const q = new URLSearchParams();
  for (const k of FILTER_KEYS) if (f[k] && f[k] !== DEFAULTS[k]) q.set(k, f[k]);
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  return q.toString();
}

export const activeDataFilters = (f) => DATA_FILTERS.filter((k) => f[k]).length;

/**
 * Narrows facts to the filters. People filters (team, level, role) choose whose data counts;
 * task filters (priority, complexity, quality) only narrow tasks; the shift filter only narrows SOC data.
 */
export function applyFilters(facts, f) {
  const group = f.team ? GROUP_BY_KEY[f.team].name : null;
  const people = facts.people.filter((p) =>
    (!group || p.group === group) && (!f.level || p.level === f.level) && (!f.role || p.role === f.role));
  if (people.length === facts.people.length && !f.prio && !f.cx && !f.q && !f.shift) return facts;
  const ids = new Set(people.map((p) => p.id));
  const tasks = facts.tasks.filter((t) => ids.has(t.a) && (!f.prio || t.prio === f.prio) && (!f.cx || t.cx === Number(f.cx)) && (!f.q || t.quality === f.q));
  const shifts = facts.shifts.filter((s) => ids.has(s.a) && (!f.shift || s.type === f.shift));
  let tickets = facts.tickets.filter((t) => ids.has(t.a));
  if (f.shift) {
    const keep = new Set(shifts.map((s) => `${s.a}|${s.date}`));
    tickets = tickets.filter((t) => keep.has(`${t.a}|${t.date}`));
  }
  return { ...facts, people, tasks, shifts, tickets };
}
