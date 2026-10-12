// Shift log checklists: the model shared by the API, the server and the screens.
// Pure functions only (no database access), so they run in the browser, on the server and in unit tests.
import { SOC_TEAMS } from "./roles.js";
import { EXTENDED_SHIFT_TASK_TITLES, SHIFT_TYPE_KEYS } from "./shifts.js";

/** Groups that keep a Shift Log and can therefore be given a checklist. Only SOC analysts keep shift logs. */
export const CHECKLIST_GROUPS = SOC_TEAMS;
export const isChecklistGroup = (team) => CHECKLIST_GROUPS.includes(team);

/** Item types. Each maps to behaviour the Shift Log, reports and analytics already understand. */
export const ITEM_KINDS = {
  basic: { label: "Standard", hint: "A plain check-off item." },
  monitor: { label: "Monitoring", hint: "Analysts mark it clean or report an issue." },
  report: { label: "Traffic report", hint: "Counts as a daily traffic report in reports." },
  misp: { label: "IOC sharing", hint: "Adds an IOC count, Bale sharing and a MISP reference. IOCs feed reports." },
  files: { label: "File upload", hint: "A check-off item for publishing files." },
};
export const ITEM_KIND_KEYS = Object.keys(ITEM_KINDS);

export const CHECKLIST_LIMITS = { name: 80, description: 280, title: 160, hint: 240, items: 40 };

// [historical activity number, title, kind]
const STANDARD_ITEMS = [
  [1, "Review Logged Incidents in Splunk Incident Review", "basic"],
  [2, "Upload Malicious IP and Domain Files to the Website", "files"],
  [3, "Review Scanner and Sensor Dashboards", "monitor"],
  [4, "Prepare Daily Traffic Report", "report"],
  [5, "Monitor Website Status in Grafana", "monitor"],
  [6, "Monitor Security Center Website", "monitor"],
  [7, "Monitor Security News", "basic"],
  [8, "Add IOCs to MISP and Share Them via Bale", "misp"],
];
const EXTENDED_ONLY = new Set(EXTENDED_SHIFT_TASK_TITLES);

/**
 * The checklist every SOC analyst used before checklists became configurable, item for item.
 * `legacyN` keeps each item's historical activity number (1–8), so reports and analytics stay continuous.
 */
export const STANDARD_CHECKLIST = {
  name: "Standard SOC routine",
  description: "The original Shift Log routine, migrated unchanged. Items limited to “Until 20:00” appear only on extended shifts.",
  items: STANDARD_ITEMS.map(([legacyN, title, kind]) => ({
    legacyN,
    title,
    kind,
    hint: "",
    shiftTypes: EXTENDED_ONLY.has(title) ? ["evening"] : [...SHIFT_TYPE_KEYS],
    active: true,
  })),
};

const text = (v) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const line = (v) => text(v).replace(/\s+/g, " ").trim();

function firstMessage(errors) {
  if (errors.form) return errors.form;
  if (errors.name) return errors.name;
  if (errors.description) return errors.description;
  const [index, e] = Object.entries(errors.items ?? {})[0] ?? [];
  if (!e) return "Check the checklist and try again.";
  return `Item ${Number(index) + 1}: ${e.form ?? e.title ?? e.hint ?? e.kind ?? e.shiftTypes}`;
}

/**
 * Validates and normalises a checklist definition: { name, description, items: [{ id?, title, hint, kind, shiftTypes, active }] }.
 * Item order is the display order. Returns { value, errors, message }; `errors` is null when the definition is valid,
 * otherwise { form?, name?, description?, items?: { [index]: { form?, title?, hint?, kind?, shiftTypes? } } }.
 */
export function normalizeChecklist(input = {}) {
  const L = CHECKLIST_LIMITS;
  const errors = {};
  const name = line(input.name);
  if (!name) errors.name = "Give the checklist a name.";
  else if (name.length > L.name) errors.name = `Keep the name under ${L.name} characters.`;
  const description = text(input.description).trim();
  if (description.length > L.description) errors.description = `Keep the description under ${L.description} characters.`;

  if (input.items !== undefined && !Array.isArray(input.items)) errors.form = "Checklist items must be a list.";
  const raw = Array.isArray(input.items) ? input.items : [];
  if (raw.length > L.items) errors.form = `A checklist can have at most ${L.items} items.`;

  const itemErrors = {};
  const ids = new Set();
  const titles = new Set();
  const items = raw.slice(0, L.items).map((it, i) => {
    const e = {};
    const id = it?.id === undefined || it?.id === null || it?.id === "" ? null : Number(it.id);
    if (id !== null && !(Number.isInteger(id) && id > 0)) e.form = "This item is not valid.";
    else if (id !== null && ids.has(id)) e.form = "This item appears twice.";
    if (id !== null) ids.add(id);

    const title = line(it?.title);
    if (!title) e.title = "Describe what the analyst should do.";
    else if (title.length > L.title) e.title = `Keep the title under ${L.title} characters.`;
    else if (titles.has(title.toLowerCase())) e.title = "Another item already has this title.";
    titles.add(title.toLowerCase());

    const hint = line(it?.hint);
    if (hint.length > L.hint) e.hint = `Keep the guidance under ${L.hint} characters.`;
    const kind = it?.kind === undefined || it?.kind === null || it?.kind === "" ? "basic" : it.kind;
    if (!ITEM_KIND_KEYS.includes(kind)) e.kind = "Choose an item type.";
    const shiftTypes = Array.isArray(it?.shiftTypes) ? SHIFT_TYPE_KEYS.filter((k) => it.shiftTypes.includes(k)) : [...SHIFT_TYPE_KEYS];
    if (!shiftTypes.length) e.shiftTypes = "Pick at least one shift.";
    const active = it?.active === undefined ? true : it.active === true;

    if (Object.keys(e).length) itemErrors[i] = e;
    return { id, title, hint, kind, shiftTypes, active };
  });
  if (Object.keys(itemErrors).length) errors.items = itemErrors;

  const valid = Object.keys(errors).length === 0;
  return { value: { name, description, items }, errors: valid ? null : errors, message: valid ? null : firstMessage(errors) };
}

/** True when two versions of an item have the same content (ids and order aside). */
export const sameChecklistItem = (a, b) =>
  a.title === b.title && (a.hint ?? "") === (b.hint ?? "") && a.kind === b.kind && a.shiftTypes.join() === b.shiftTypes.join() && !!a.active === !!b.active;

/** What changed between a saved definition (`before`, items with ids) and a draft (`after`; new items have no id). */
export function describeChanges(before, after) {
  const prev = new Map(before.items.map((it) => [it.id, it]));
  const kept = after.items.filter((it) => it.id !== null && it.id !== undefined && prev.has(it.id));
  const keptIds = new Set(kept.map((it) => it.id));
  const added = after.items.length - kept.length;
  const removed = before.items.filter((it) => !keptIds.has(it.id)).length;
  const edited = kept.filter((it) => !sameChecklistItem(prev.get(it.id), it)).length;
  const reordered = before.items.filter((it) => keptIds.has(it.id)).map((it) => it.id).join() !== kept.map((it) => it.id).join();
  const details = before.name !== after.name || (before.description ?? "") !== (after.description ?? "");
  return { added, removed, edited, reordered, details, any: !!(added || removed || edited || reordered || details) };
}

/** "2 added · 1 removed · reordered" — for save confirmations and the audit trail. */
export function changeSummary(c) {
  const parts = [];
  if (c.added) parts.push(`${c.added} added`);
  if (c.removed) parts.push(`${c.removed} removed`);
  if (c.edited) parts.push(`${c.edited} edited`);
  if (c.reordered) parts.push("reordered");
  if (c.details) parts.push("name or description changed");
  return parts.join(" · ") || "no changes";
}

/** Items of a checklist that apply to one shift type, as Shift Log activities (a snapshot: later edits never change it). */
export function activitiesForShift(items, shiftType) {
  return items
    .filter((it) => it.active && it.shiftTypes.includes(shiftType))
    .map((it, i) => ({
      n: i + 1,
      itemId: it.id,
      ...(it.legacyN ? { legacyN: it.legacyN } : {}),
      title: it.title,
      kind: it.kind,
      ...(it.hint ? { hint: it.hint } : {}),
      done: false,
      ...(it.kind === "misp" ? { iocs: 0, bale: false, mispRef: "" } : {}),
    }));
}

/**
 * Historical activity number (1–8) of a logged activity, used by per-activity reports and analytics.
 * Logs written before checklists were configurable have no `itemId`, and their `n` is that number.
 * Items added through the checklist editor have none (null).
 */
export function legacyActivityNumber(act) {
  if (act?.itemId === undefined || act?.itemId === null) return Number.isInteger(act?.n) && act.n >= 1 && act.n <= 8 ? act.n : null;
  return act.legacyN ?? null;
}
