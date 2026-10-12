import "server-only";
import { db } from "@/lib/server/db";
import { CHECKLIST_GROUPS, changeSummary, describeChanges, isChecklistGroup, normalizeChecklist } from "@/lib/checklists";

/** A failure with the HTTP status the API should answer with. */
export class ChecklistError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

const toItem = (r) => ({
  id: r.id,
  title: r.title,
  hint: r.hint,
  kind: r.kind,
  shiftTypes: r.shift_types.split(",").filter(Boolean),
  active: !!r.active,
  ...(r.legacy_n ? { legacyN: r.legacy_n } : {}),
});

const itemsOf = (checklistId) =>
  db.prepare("SELECT * FROM shift_checklist_items WHERE checklist_id = ? AND removed_at IS NULL ORDER BY position, id").all(checklistId).map(toItem);

const groupsOf = (checklistId) =>
  db.prepare("SELECT team, enabled FROM shift_checklist_assignments WHERE checklist_id = ? ORDER BY team").all(checklistId).map((g) => ({ team: g.team, enabled: !!g.enabled }));

function toChecklist(r) {
  const items = itemsOf(r.id);
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    version: r.version,
    archived: !!r.archived_at,
    createdAt: r.created_at,
    createdBy: r.created_by,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by,
    items,
    activeCount: items.filter((it) => it.active).length,
    groups: groupsOf(r.id),
  };
}

export function getChecklist(id) {
  const r = db.prepare("SELECT * FROM shift_checklists WHERE id = ?").get(id);
  return r ? toChecklist(r) : null;
}

/** Every checklist that is not archived, alphabetically. */
export const listChecklists = () =>
  db.prepare("SELECT * FROM shift_checklists WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE, id").all().map(toChecklist);

/** One row per group that keeps a Shift Log: its checklist, whether it is on, and how many analysts it covers. */
export function listAssignments() {
  const rows = new Map(db.prepare(
    `SELECT a.*, c.name, c.version FROM shift_checklist_assignments a JOIN shift_checklists c ON c.id = a.checklist_id`
  ).all().map((r) => [r.team, r]));
  const analysts = Object.fromEntries(db.prepare(
    "SELECT team, COUNT(*) AS n FROM users WHERE active = 1 AND role = 'analyst' GROUP BY team"
  ).all().map((r) => [r.team, r.n]));
  return CHECKLIST_GROUPS.map((team) => {
    const r = rows.get(team);
    return {
      team,
      analysts: analysts[team] ?? 0,
      checklistId: r?.checklist_id ?? null,
      checklistName: r?.name ?? null,
      version: r?.version ?? null,
      enabled: !!r?.enabled,
      updatedAt: r?.updated_at ?? null,
      updatedBy: r?.updated_by ?? null,
    };
  });
}

/** The checklist new shift logs of a group copy, or null when the group has none or it is disabled. */
export function activeChecklistFor(team) {
  if (!isChecklistGroup(team)) return null;
  const r = db.prepare(
    `SELECT c.* FROM shift_checklist_assignments a JOIN shift_checklists c ON c.id = a.checklist_id
     WHERE a.team = ? AND a.enabled = 1 AND c.archived_at IS NULL`
  ).get(team);
  return r ? { id: r.id, name: r.name, version: r.version, items: itemsOf(r.id) } : null;
}

export const listVersions = (checklistId) =>
  db.prepare("SELECT version, name, items, summary, created_by, created_at FROM shift_checklist_versions WHERE checklist_id = ? ORDER BY version DESC")
    .all(checklistId)
    .map((v) => {
      const items = JSON.parse(v.items);
      return { version: v.version, name: v.name, summary: v.summary, by: v.created_by, at: v.created_at, items: items.length, activeItems: items.filter((it) => it.active).length };
    });

export const listEvents = (checklistId, limit = 40) =>
  db.prepare("SELECT id, team, action, detail, user_id AS by, at FROM shift_checklist_events WHERE checklist_id = ? ORDER BY id DESC LIMIT ?")
    .all(checklistId, limit)
    .map((e) => ({ ...e }));

const logEvent = (checklistId, team, action, detail, userId) =>
  db.prepare("INSERT INTO shift_checklist_events (checklist_id, team, action, detail, user_id) VALUES (?, ?, ?, ?, ?)").run(checklistId, team, action, detail, userId ?? null);

function snapshot(checklistId, actorId, summary) {
  const c = db.prepare("SELECT name, version FROM shift_checklists WHERE id = ?").get(checklistId);
  db.prepare("INSERT INTO shift_checklist_versions (checklist_id, version, name, items, summary, created_by) VALUES (?, ?, ?, ?, ?, ?)")
    .run(checklistId, c.version, c.name, JSON.stringify(itemsOf(checklistId)), summary, actorId ?? null);
}

function assertUniqueName(name, exceptId = 0) {
  const clash = db.prepare("SELECT id FROM shift_checklists WHERE archived_at IS NULL AND name = ? COLLATE NOCASE AND id != ?").get(name, exceptId);
  if (clash) throw new ChecklistError(409, "Another checklist already has this name.", { field: "name" });
}

const insertItem = (checklistId, it, position) =>
  db.prepare("INSERT INTO shift_checklist_items (checklist_id, title, hint, kind, shift_types, position, active) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(checklistId, it.title, it.hint, it.kind, it.shiftTypes.join(","), position, it.active ? 1 : 0);

/**
 * New checklist: blank, or a copy of another checklist's items (`copyFrom`). Copies never carry the original
 * routine's activity numbers, so per-activity reports keep describing the standard routine only.
 */
export function createChecklist(input, actorId) {
  return transaction(() => {
    let items = Array.isArray(input?.items) ? input.items.map(({ id, legacyN, ...it }) => it) : [];
    let source = null;
    if (input?.copyFrom !== undefined && input.copyFrom !== null && input.copyFrom !== "") {
      source = getChecklist(Number(input.copyFrom));
      if (!source || source.archived) throw new ChecklistError(404, "The checklist to copy from was not found.");
      items = source.items.map(({ id, legacyN, ...it }) => it);
    }
    const { value, message, errors } = normalizeChecklist({ name: input?.name, description: input?.description, items });
    if (message) throw new ChecklistError(400, message, { errors });
    assertUniqueName(value.name);

    const { lastInsertRowid } = db.prepare("INSERT INTO shift_checklists (name, description, created_by, updated_by) VALUES (?, ?, ?, ?)")
      .run(value.name, value.description, actorId, actorId);
    const id = Number(lastInsertRowid);
    value.items.forEach((it, i) => insertItem(id, it, i));
    const summary = source ? `Created as a copy of “${source.name}”` : "Created";
    snapshot(id, actorId, summary);
    logEvent(id, null, "created", `${summary} · ${value.items.length} item${value.items.length === 1 ? "" : "s"}`, actorId);
    return getChecklist(id);
  });
}

/**
 * Saves a whole definition in one step and records it as the next version. `input.version` is the version
 * the editor started from; if someone saved in the meantime the save is refused instead of overwriting them.
 * Items missing from the draft are removed (kept in the audit trail); new items have no id.
 */
export function saveChecklist(id, input, actorId) {
  return transaction(() => {
    const current = getChecklist(id);
    if (!current || current.archived) throw new ChecklistError(404, "Checklist not found.");
    if (input?.version !== undefined && Number(input.version) !== current.version) {
      throw new ChecklistError(409, "Someone else saved this checklist while you were editing. Reload it to see their version, then apply your changes again.", { conflict: true });
    }
    const { value, message, errors } = normalizeChecklist(input);
    if (message) throw new ChecklistError(400, message, { errors });
    const known = new Map(current.items.map((it) => [it.id, it]));
    if (value.items.some((it) => it.id !== null && !known.has(it.id))) {
      throw new ChecklistError(409, "An item in your draft no longer belongs to this checklist. Reload it and try again.", { conflict: true });
    }
    assertUniqueName(value.name, id);

    const changes = describeChanges(current, value);
    if (!changes.any) return { checklist: current, changes };

    const inUse = current.groups.filter((g) => g.enabled).map((g) => g.team);
    if (inUse.length && !value.items.some((it) => it.active)) {
      throw new ChecklistError(400, `${inUse.join(", ")} ${inUse.length === 1 ? "uses" : "use"} this checklist. Keep at least one active item, or disable the checklist for ${inUse.length === 1 ? "that group" : "those groups"} first.`);
    }

    const version = current.version + 1;
    db.prepare("UPDATE shift_checklists SET name = ?, description = ?, version = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?")
      .run(value.name, value.description, version, actorId, id);
    const update = db.prepare(
      `UPDATE shift_checklist_items SET title = ?, hint = ?, kind = ?, shift_types = ?, active = ?, position = ?,
         updated_at = CASE WHEN title = ? AND hint = ? AND kind = ? AND shift_types = ? AND active = ? THEN updated_at ELSE datetime('now') END
       WHERE id = ?`
    );
    value.items.forEach((it, i) => {
      if (it.id === null) return insertItem(id, it, i);
      const types = it.shiftTypes.join(","), active = it.active ? 1 : 0;
      update.run(it.title, it.hint, it.kind, types, active, i, it.title, it.hint, it.kind, types, active, it.id);
    });
    const kept = new Set(value.items.map((it) => it.id).filter(Boolean));
    const remove = db.prepare("UPDATE shift_checklist_items SET removed_at = datetime('now'), active = 0, updated_at = datetime('now') WHERE id = ?");
    for (const it of current.items) if (!kept.has(it.id)) remove.run(it.id);

    const summary = changeSummary(changes);
    snapshot(id, actorId, summary);
    logEvent(id, null, "saved", `Version ${version} · ${summary}`, actorId);
    return { checklist: getChecklist(id), changes };
  });
}

/** Archives a checklist nobody uses. Shift logs created from it keep their copy of its items. */
export function archiveChecklist(id, actorId) {
  return transaction(() => {
    const current = getChecklist(id);
    if (!current || current.archived) throw new ChecklistError(404, "Checklist not found.");
    if (current.groups.length) {
      const teams = current.groups.map((g) => g.team).join(", ");
      throw new ChecklistError(409, `${teams} still ${current.groups.length === 1 ? "uses" : "use"} this checklist. Assign another checklist first.`);
    }
    db.prepare("UPDATE shift_checklists SET archived_at = datetime('now'), updated_by = ?, updated_at = datetime('now') WHERE id = ?").run(actorId, id);
    logEvent(id, null, "archived", "Archived; existing shift logs keep their copy", actorId);
    return { ok: true };
  });
}

/**
 * Chooses a group's checklist and/or turns it on or off: { checklistId?: number | null, enabled?: boolean }.
 * checklistId null removes the assignment. Shift logs that already have activity keep the items they started with.
 */
export function setAssignment(team, input, actorId) {
  if (!isChecklistGroup(team)) throw new ChecklistError(400, "Choose a SOC group that keeps a Shift Log.");
  return transaction(() => {
    const current = db.prepare("SELECT a.*, c.name FROM shift_checklist_assignments a JOIN shift_checklists c ON c.id = a.checklist_id WHERE a.team = ?").get(team);

    if (input?.checklistId === null) {
      if (current) {
        db.prepare("DELETE FROM shift_checklist_assignments WHERE team = ?").run(team);
        logEvent(current.checklist_id, team, "unassigned", `Removed from ${team}`, actorId);
      }
      return listAssignments().find((a) => a.team === team);
    }

    const checklistId = input?.checklistId === undefined ? current?.checklist_id : Number(input.checklistId);
    if (!Number.isInteger(checklistId) || checklistId < 1) throw new ChecklistError(400, "Choose a checklist for this group.");
    const checklist = getChecklist(checklistId);
    if (!checklist || checklist.archived) throw new ChecklistError(404, "Checklist not found.");
    const enabled = input?.enabled === undefined ? (current ? !!current.enabled : true) : input.enabled === true;
    if (enabled && !checklist.activeCount) {
      throw new ChecklistError(400, `“${checklist.name}” has no active items yet. Add at least one before using it for ${team}.`);
    }

    db.prepare(
      `INSERT INTO shift_checklist_assignments (team, checklist_id, enabled, updated_by, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(team) DO UPDATE SET checklist_id = excluded.checklist_id, enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
    ).run(team, checklistId, enabled ? 1 : 0, actorId);

    if (current?.checklist_id !== checklistId) {
      logEvent(checklistId, team, "assigned", current ? `Assigned to ${team}, replacing “${current.name}”` : `Assigned to ${team}`, actorId);
      if (current) logEvent(current.checklist_id, team, "unassigned", `Replaced by “${checklist.name}” for ${team}`, actorId);
    }
    if (!current || !!current.enabled !== enabled) {
      if (current || !enabled) logEvent(checklistId, team, enabled ? "enabled" : "disabled", `${enabled ? "Enabled" : "Disabled"} for ${team}`, actorId);
    }
    return listAssignments().find((a) => a.team === team);
  });
}

/** Route helper: answers a refused checklist change with its status, message and (for forms) per-field errors. */
export function checklistFailure(e) {
  if (!(e instanceof ChecklistError)) throw e;
  return Response.json({ error: e.message, ...(e.conflict ? { conflict: true } : {}), ...(e.errors ? { errors: e.errors } : {}) }, { status: e.status });
}
