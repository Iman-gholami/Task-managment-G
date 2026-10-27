import "server-only";
import { db } from "@/lib/server/db";
import { isManager, isShiftEligible, shiftChecklistTeam } from "@/lib/roles";
import { SHIFT_TYPES, isDayStatus, isIsoDate, isShiftType, scheduleStats, tehranDate } from "@/lib/shifts";
import { activitiesForShift } from "@/lib/checklists";
import { activeChecklistFor } from "@/lib/server/shift-checklists";
import { listAnalyzedTickets, analyzedTicketSummary } from "@/lib/server/l2-analyzed-tickets";

export const today = () => tehranDate();

const rel = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const toTask = (r) => ({ id: r.id, title: r.title, description: r.description, a: r.assignee, team: r.team, status: r.status, prio: r.prio, cx: r.cx, due: r.due, hours: r.hours, quality: r.quality, createdBy: r.created_by, reviewRequired: !!r.review_required, upd: rel(r.updated_at) });

export const listUsers = () =>
  db.prepare("SELECT id, name, email, role, team, color, assist, province, active FROM users ORDER BY name").all().map((u) => ({ ...u, active: !!u.active }));

export const getUser = (id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id);

export const listTasks = () => db.prepare("SELECT * FROM tasks ORDER BY id DESC").all().map(toTask);
export const getTask = (id) => {
  const r = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return r ? toTask(r) : null;
};

export function createTask({ title, description = "", a, prio, cx, due, reviewRequired = true }, by) {
  const assignee = getUser(a);
  const max = db.prepare("SELECT MAX(CAST(SUBSTR(id, 3) AS INTEGER)) AS m FROM tasks").get().m || 1000;
  const id = `T-${max + 1}`;
  db.prepare("INSERT INTO tasks (id, title, description, assignee, team, status, prio, cx, due, review_required, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, datetime('now'))")
    .run(id, title, description, a, assignee.team, prio, cx, due || "—", reviewRequired ? 1 : 0, by);
  recordTransition(id, null, "todo", by);
  return getTask(id);
}

const TASK_FIELDS = { status: "status", prio: "prio", cx: "cx", hours: "hours", quality: "quality", due: "due", title: "title", description: "description", a: "assignee", team: "team", reviewRequired: "review_required" };
const recordTransition = (taskId, from, to, userId) =>
  db.prepare("INSERT INTO task_transitions (task_id, from_status, to_status, user_id) VALUES (?, ?, ?, ?)").run(taskId, from, to, userId ?? null);

/** Applies a validated patch. `by` is the acting user, recorded with any status change. */
export function updateTask(id, patch, by = null) {
  const before = patch.status ? db.prepare("SELECT status FROM tasks WHERE id = ?").get(id)?.status : null;
  const keys = Object.keys(patch).filter((k) => k in TASK_FIELDS);
  if (keys.length) {
    db.prepare(`UPDATE tasks SET ${keys.map((k) => `${TASK_FIELDS[k]} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...keys.map((k) => patch[k]), id);
  }
  if (patch.status === "progress") db.prepare("UPDATE tasks SET started_at = COALESCE(started_at, datetime('now')), completed_at = NULL, quality = NULL WHERE id = ?").run(id);
  if (patch.status === "done") db.prepare("UPDATE tasks SET completed_at = datetime('now') WHERE id = ?").run(id);
  if (patch.status && before && patch.status !== before) recordTransition(id, before, patch.status, by);
  return getTask(id);
}

export const addEvent = (taskId, userId, text) =>
  db.prepare("INSERT INTO task_events (task_id, user_id, text) VALUES (?, ?, ?)").run(taskId, userId, text);

export function getTaskDetails(id) {
  const t = db.prepare("SELECT started_at, completed_at, created_by FROM tasks WHERE id = ?").get(id);
  return {
    startedAt: t?.started_at ?? null,
    completedAt: t?.completed_at ?? null,
    createdBy: t?.created_by ?? null,
    checklist: db.prepare("SELECT id, label, done FROM checklist_items WHERE task_id = ? ORDER BY position, id").all(id).map((c) => ({ ...c, done: !!c.done })),
    comments: db.prepare("SELECT id, user_id AS by, body, created_at AS at, edited_at AS edited FROM comments WHERE task_id = ? ORDER BY id").all(id).map((c) => ({ ...c })),
    attachments: db.prepare("SELECT id, name, size, mime, user_id AS by, created_at AS at FROM attachments WHERE task_id = ? ORDER BY id").all(id).map((a) => ({ ...a })),
    events: db.prepare("SELECT id, user_id AS by, text, created_at AS at FROM task_events WHERE task_id = ? ORDER BY id DESC LIMIT 30").all(id).map((e) => ({ ...e })),
  };
}

export function addChecklistItem(taskId, label) {
  const pos = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM checklist_items WHERE task_id = ?").get(taskId).p;
  db.prepare("INSERT INTO checklist_items (task_id, label, position) VALUES (?, ?, ?)").run(taskId, label, pos);
}
export const getChecklistItem = (id) => db.prepare("SELECT * FROM checklist_items WHERE id = ?").get(id);
export function updateChecklistItem(id, { done, label }) {
  if (done !== undefined) db.prepare("UPDATE checklist_items SET done = ? WHERE id = ?").run(done ? 1 : 0, id);
  if (label !== undefined) db.prepare("UPDATE checklist_items SET label = ? WHERE id = ?").run(label, id);
}
export const deleteChecklistItem = (id) => db.prepare("DELETE FROM checklist_items WHERE id = ?").run(id);

export const addComment = (taskId, userId, body) => db.prepare("INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)").run(taskId, userId, body);
export const getComment = (id) => db.prepare("SELECT * FROM comments WHERE id = ?").get(id);
export const editComment = (id, body) => db.prepare("UPDATE comments SET body = ?, edited_at = datetime('now') WHERE id = ?").run(body, id);
export const deleteComment = (id) => db.prepare("DELETE FROM comments WHERE id = ?").run(id);

export const addAttachment = (a) =>
  db.prepare("INSERT INTO attachments (task_id, user_id, name, size, mime, path) VALUES (?, ?, ?, ?, ?, ?)").run(a.taskId, a.userId, a.name, a.size, a.mime, a.path);
export const getAttachment = (id) => db.prepare("SELECT * FROM attachments WHERE id = ?").get(id);
export const deleteAttachment = (id) => db.prepare("DELETE FROM attachments WHERE id = ?").run(id);

// ---- Shift scheduling -------------------------------------------------------
const isSocAnalystUser = isShiftEligible;
const toSchedule = (r) => r && ({
  id: r.id,
  userId: r.user_id,
  date: r.date,
  shiftType: r.shift_type,
  createdBy: r.created_by,
  updatedBy: r.updated_by,
});

export function getCenterHoliday(date) {
  return db.prepare(
    "SELECT date, note, created_by AS createdBy, updated_by AS updatedBy FROM shift_center_holidays WHERE date = ?"
  ).get(date) ?? null;
}

export function listCenterHolidays(from, to) {
  return db.prepare(
    "SELECT date, note, created_by AS createdBy, updated_by AS updatedBy FROM shift_center_holidays WHERE date BETWEEN ? AND ? ORDER BY date"
  ).all(from, to);
}

export function getShiftSchedule(userId, date = today()) {
  return toSchedule(db.prepare("SELECT * FROM shift_schedules WHERE user_id = ? AND date = ?").get(userId, date));
}

export function getDayStatus(userId, date = today()) {
  return db.prepare("SELECT status FROM shift_day_statuses WHERE user_id = ? AND date = ?").get(userId, date)?.status ?? null;
}

export function listDayStatuses(from, to) {
  return db.prepare(
    `SELECT s.*, u.name, u.team, u.color
     FROM shift_day_statuses s JOIN users u ON u.id = s.user_id
     WHERE s.date BETWEEN ? AND ? AND u.active = 1
     ORDER BY s.date, u.name`
  ).all(from, to).map((r) => ({
    id: `status:${r.user_id}:${r.date}`,
    userId: r.user_id, date: r.date, shiftType: r.status,
    createdBy: r.created_by, updatedBy: r.updated_by,
    name: r.name, team: r.team, color: r.color,
  }));
}

export function listShiftSchedules(from, to) {
  const scheduled = db.prepare(
    `SELECT s.*, u.name, u.team, u.color
     FROM shift_schedules s JOIN users u ON u.id = s.user_id
     WHERE s.date BETWEEN ? AND ? AND u.active = 1
     ORDER BY s.date, u.name`
  ).all(from, to).map((r) => ({ ...toSchedule(r), name: r.name, team: r.team, color: r.color }));
  return [...scheduled, ...listDayStatuses(from, to)].sort(
    (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)
  );
}

export function scheduleStatsByUser(schedules) {
  const grouped = {};
  for (const s of schedules) (grouped[s.userId] ??= []).push(s);
  return Object.fromEntries(Object.entries(grouped).map(([id, rows]) => [id, scheduleStats(rows)]));
}

function shiftLogHasProgress(userId, date) {
  const row = db.prepare("SELECT data, completed_at FROM shift_logs WHERE user_id = ? AND date = ?").get(userId, date);
  if (!row) return false;
  if (row.completed_at) return true;
  const activities = JSON.parse(row.data);
  if (activities.some((a) => a.done || a.issue || (a.iocs ?? 0) > 0 || a.note)) return true;
  if (db.prepare("SELECT 1 FROM l2_analyzed_tickets WHERE user_id = ? AND date = ? LIMIT 1").get(userId, date)) return true;
  return db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND date = ?").get(userId, date).n > 0;
}

function deleteEmptyShiftLog(userId, date) {
  if (!shiftLogHasProgress(userId, date)) db.prepare("DELETE FROM shift_logs WHERE user_id = ? AND date = ?").run(userId, date);
}

export function setShiftSchedule(userId, date, shiftType, actorId) {
  const analyst = getUser(userId);
  if (!isSocAnalystUser(analyst)) throw new Error("Only active SOC shift staff can be scheduled.");
  if (!isIsoDate(date)) throw new Error("Invalid shift date.");
  if (!isShiftType(shiftType)) throw new Error("Invalid shift type.");
  if (getDayStatus(userId, date)) throw new Error("Remove the day-off or leave status before assigning a work shift.");

  const existing = getShiftSchedule(userId, date);
  const logRow = db.prepare("SELECT shift_type FROM shift_logs WHERE user_id = ? AND date = ?").get(userId, date);
  const currentType = existing?.shiftType ?? logRow?.shift_type ?? null;
  if (currentType && currentType !== shiftType) {
    if (shiftLogHasProgress(userId, date)) throw new Error("This shift log already has activity and the shift type can no longer be changed.");
    deleteEmptyShiftLog(userId, date);
  }

  db.prepare(
    `INSERT INTO shift_schedules (user_id, date, shift_type, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET shift_type = excluded.shift_type, updated_by = excluded.updated_by, updated_at = datetime('now')`
  ).run(userId, date, shiftType, actorId, actorId);
  return getShiftSchedule(userId, date);
}

export function removeShiftSchedule(userId, date) {
  if (!isIsoDate(date)) throw new Error("Invalid shift date.");
  if (shiftLogHasProgress(userId, date)) throw new Error("This shift log already has activity and the assignment cannot be removed.");
  deleteEmptyShiftLog(userId, date);
  db.prepare("DELETE FROM shift_schedules WHERE user_id = ? AND date = ?").run(userId, date);
}

/** An explicit off/leave day is never a worked shift and never creates a Shift Log. */
export function setDayStatus(userId, date, status, actorId) {
  const person = getUser(userId);
  if (!isSocAnalystUser(person)) throw new Error("Only active SOC shift staff may receive a day status.");
  if (!isIsoDate(date)) throw new Error("Invalid shift date.");
  if (!isDayStatus(status)) throw new Error("Invalid day status.");
  if (getShiftSchedule(userId, date)) throw new Error("Remove the work shift before assigning a day status.");
  if (shiftLogHasProgress(userId, date)) throw new Error("This shift log already has activity and the day cannot be changed.");
  deleteEmptyShiftLog(userId, date);
  db.prepare(
    `INSERT INTO shift_day_statuses (user_id, date, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE
     SET status = excluded.status, updated_by = excluded.updated_by, updated_at = datetime('now')`
  ).run(userId, date, status, actorId, actorId);
}

export function removeDayStatus(userId, date) {
  if (!isIsoDate(date)) throw new Error("Invalid shift date.");
  db.prepare("DELETE FROM shift_day_statuses WHERE user_id = ? AND date = ?").run(userId, date);
}

// ---- Shift logs -------------------------------------------------------------
// A log copies the items of its group's checklist (lib/server/shift-checklists.js) when it is created, so editing
// a checklist never changes a log that has started. checklist_version is 0 for a log created while the group had
// no active checklist, and NULL for logs written before checklists were configurable (the built-in routine).
const BUILT_IN = { id: null, name: "Built-in SOC routine", version: null, builtIn: true };
const sourceKey = (id, version) => `${id ?? "-"}:${version ?? "built-in"}`;

/** A request that should fail with a specific HTTP status (`stale`: the client's copy of the log is out of date). */
export class ShiftLogError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

function hydrateShiftLog(row) {
  if (!row) return null;
  const shiftType = row.shift_type || getShiftSchedule(row.user_id, row.date)?.shiftType || "morning";
  const tickets = db.prepare("SELECT number AS no, ref, description AS desc FROM tickets WHERE user_id = ? AND date = ? ORDER BY id").all(row.user_id, row.date).map((t) => ({ ...t }));
  const checklist = row.team === "SOC · L2" ? null : row.checklist_version === null || row.checklist_version === undefined
    ? BUILT_IN
    : row.checklist_id ? { id: row.checklist_id, name: row.checklist_name, version: row.checklist_version } : null;
  return {
    date: row.date,
    shiftType,
    shift: SHIFT_TYPES[shiftType] ?? SHIFT_TYPES.morning,
    team: row.team ?? null,
    checklist,
    activities: JSON.parse(row.data),
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    tickets,
    analyzedTickets: row.team === "SOC · L2" ? listAnalyzedTickets(row.user_id, row.date) : [],
    analyzedTicketStats: row.team === "SOC · L2" ? analyzedTicketSummary(row.user_id, row.date) : { total: 0, falsePositive: 0, truePositive: 0 },
  };
}

/**
 * Today's log for an analyst, created from their group's checklist on first access. While nothing has been
 * recorded in it, it follows the group's current checklist (a manager's change applies straight away);
 * once the analyst has started, it keeps the items it started with.
 */
export function getShiftLog(userId, date = today()) {
  const schedule = getShiftSchedule(userId, date);
  if (!schedule) return null;
  const team = shiftChecklistTeam(getUser(userId)) ?? null;
  // Layer 2 work is ticket analysis only; do not attach Layer 1/legacy routine checklists.
  const checklist = team === "SOC · L2" ? null : activeChecklistFor(team);
  const source = [checklist?.id ?? null, checklist ? checklist.version : 0, checklist?.name ?? null, team];
  const data = () => JSON.stringify(checklist ? activitiesForShift(checklist.items, schedule.shiftType) : []);

  let row = db.prepare("SELECT * FROM shift_logs WHERE user_id = ? AND date = ?").get(userId, date);
  if (!row) {
    db.prepare("INSERT INTO shift_logs (user_id, date, data, shift_type, checklist_id, checklist_version, checklist_name, team) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(userId, date, data(), schedule.shiftType, ...source);
    row = db.prepare("SELECT * FROM shift_logs WHERE user_id = ? AND date = ?").get(userId, date);
  } else if (!row.completed_at && sourceKey(row.checklist_id, row.checklist_version) !== sourceKey(source[0], source[1]) && !shiftLogHasProgress(userId, date)) {
    db.prepare(
      `UPDATE shift_logs SET data = ?, shift_type = ?, checklist_id = ?, checklist_version = ?, checklist_name = ?, team = ?, updated_at = datetime('now')
       WHERE user_id = ? AND date = ?`
    ).run(data(), schedule.shiftType, ...source, userId, date);
    row = db.prepare("SELECT * FROM shift_logs WHERE user_id = ? AND date = ?").get(userId, date);
  }
  return hydrateShiftLog(row);
}

const text = (v, max) => String(v ?? "").slice(0, max);

/** Only known fields, with their expected types. */
function cleanActivityPatch(patch) {
  const out = {};
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key === "done" || key === "bale") out[key] = value === true;
    else if (key === "iocs") out[key] = Math.max(0, Math.trunc(Number(value) || 0));
    else if (key === "mispRef") out[key] = text(value, 200);
    else if (key === "note") out[key] = text(value, 1000);
    else if (key === "issue") {
      const summary = value && typeof value === "object" ? text(value.summary, 300).trim() : "";
      out.issue = summary ? { summary, description: text(value.description, 2000), ref: text(value.ref, 200) } : null;
    }
  }
  return out;
}

/**
 * Applies a patch to activity `n` of a log's activities. `itemId`, when given, is the checklist item the client
 * believes is activity `n`; a mismatch means the client's copy is stale, so nothing is changed.
 * `stamp` adds audit fields (manager corrections). Ticking an activity records when it was done.
 */
export function patchActivities(activities, n, patch, itemId, stamp = {}) {
  const target = activities.find((a) => a.n === n);
  if (!target) throw new ShiftLogError(404, "Shift activity was not found.");
  if (itemId !== undefined && (target.itemId ?? null) !== (itemId ?? null)) {
    throw new ShiftLogError(409, "Your checklist changed since this page was opened. The latest version is now shown; check the item again.", { stale: true });
  }
  const clean = cleanActivityPatch(patch);
  if (!Object.keys(clean).length) throw new ShiftLogError(400, "No editable shift-log fields were provided.");
  return activities.map((a) => {
    if (a !== target) return a;
    const next = { ...a, ...clean, ...stamp };
    if ("done" in clean && clean.done !== !!a.done) {
      if (clean.done) next.doneAt = new Date().toISOString();
      else delete next.doneAt;
    }
    return next;
  });
}

export function updateActivity(userId, n, patch, itemId, date = today()) {
  if (getUser(userId)?.team === "SOC · L2")
    throw new ShiftLogError(403, "Layer 2 shift logs accept ticket analysis only.");
  const log = getShiftLog(userId, date);
  if (!log) throw new ShiftLogError(404, "No shift is scheduled for this day.");
  if (log.completedAt) throw new ShiftLogError(409, "Shift is already completed");
  const activities = patchActivities(log.activities, n, patch, itemId);
  db.prepare("UPDATE shift_logs SET data = ?, updated_at = datetime('now') WHERE user_id = ? AND date = ?").run(JSON.stringify(activities), userId, log.date);
  return activities;
}

export function findShiftLog(userId, date = today()) {
  return hydrateShiftLog(db.prepare("SELECT * FROM shift_logs WHERE user_id = ? AND date = ?").get(userId, date));
}

export function listShiftLogs(userId, from, to) {
  return db.prepare("SELECT * FROM shift_logs WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC").all(userId, from, to).map((r) => {
    const acts = JSON.parse(r.data);
    return {
      date: r.date,
      shiftType: r.shift_type || "morning",
      completed: !!r.completed_at,
      done: acts.filter((a) => a.done).length,
      total: acts.length,
      iocs: acts.filter((a) => a.kind === "misp").reduce((sum, a) => sum + (Number(a.iocs) || 0), 0),
      issues: acts.filter((a) => a.issue).length,
      report: acts.some((a) => a.kind === "report" && a.done),
      checklist: r.checklist_version === null ? BUILT_IN.name : r.checklist_name,
      checklistVersion: r.checklist_version || null,
      tickets: db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND date = ?").get(userId, r.date).n,
      analyzedTickets: analyzedTicketSummary(userId, r.date).total,
    };
  });
}

export function setShiftCompleted(userId, completed, date = today()) {
  const log = getShiftLog(userId, date);
  if (!log) throw new Error("No shift is scheduled for today.");
  db.prepare("UPDATE shift_logs SET completed_at = ?, updated_at = datetime('now') WHERE user_id = ? AND date = ?")
    .run(completed ? new Date().toISOString() : null, userId, log.date);
  return getShiftLog(userId, date);
}

export function addTicket(userId, { no, ref = "", desc = "" }, date = today()) {
  const log = getShiftLog(userId, date);
  if (!log) throw new Error("No shift is scheduled for today.");
  db.prepare("INSERT INTO tickets (user_id, date, number, ref, description) VALUES (?, ?, ?, ?, ?)").run(userId, log.date, no, ref, desc);
  return getShiftLog(userId, date).tickets;
}

export function shiftStatusToday() {
  const rows = db.prepare(
    `SELECT s.user_id, s.shift_type, l.data, l.completed_at
     FROM shift_schedules s LEFT JOIN shift_logs l ON l.user_id = s.user_id AND l.date = s.date
     WHERE s.date = ?`
  ).all(today());
  const status = Object.fromEntries(rows.map((r) => [r.user_id, r.completed_at ? "completed" : r.data && JSON.parse(r.data).some((a) => a.done) ? "active" : "scheduled"]));
  for (const row of db.prepare("SELECT user_id, status FROM shift_day_statuses WHERE date = ?").all(today())) {
    status[row.user_id] = row.status;
  }
  return status;
}

export const listAllTickets = () =>
  db.prepare("SELECT user_id AS a, date, number AS no, ref, description AS desc FROM tickets ORDER BY date DESC, id DESC").all().map((t) => ({ ...t }));

// ---- Shift change requests --------------------------------------------------
const toChangeRequest = (r) => r && ({
  id: r.id,
  requesterId: r.requester_id,
  requesterName: r.requester_name,
  targetId: r.target_id,
  targetName: r.target_name,
  date: r.date,
  targetDate: r.target_date || r.date,
  requesterShift: r.requester_shift,
  targetShift: r.target_shift,
  reason: r.reason,
  status: r.status,
  targetApprovedAt: r.target_approved_at,
  targetApprovedBy: r.target_approved_by,
  managerApprovedAt: r.manager_approved_at,
  managerApprovedBy: r.manager_approved_by,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
});

const CHANGE_SELECT = `
  SELECT r.*, rq.name AS requester_name, tg.name AS target_name
  FROM shift_change_requests r
  JOIN users rq ON rq.id = r.requester_id
  JOIN users tg ON tg.id = r.target_id`;

export function getShiftChangeRequest(id) {
  return toChangeRequest(db.prepare(`${CHANGE_SELECT} WHERE r.id = ?`).get(id));
}

export function listShiftChangeRequests(viewerId, manager = false) {
  const rows = manager
    ? db.prepare(`${CHANGE_SELECT} ORDER BY CASE WHEN r.status IN ('pending_target','pending_manager') THEN 0 ELSE 1 END, r.created_at DESC LIMIT 100`).all()
    : db.prepare(`${CHANGE_SELECT} WHERE r.requester_id = ? OR r.target_id = ? ORDER BY r.created_at DESC LIMIT 100`).all(viewerId, viewerId);
  return rows.map(toChangeRequest);
}

export function createShiftChangeRequest(requesterId, targetId, date, targetDate, reason = "") {
  if (requesterId === targetId) throw new Error("Choose another analyst.");
  if (!isIsoDate(date) || !isIsoDate(targetDate)) throw new Error("Invalid shift date.");
  if (date < today() || targetDate < today()) throw new Error("Past shifts cannot be changed.");

  const requester = getUser(requesterId);
  const target = getUser(targetId);
  if (!isSocAnalystUser(requester) || !isSocAnalystUser(target)) throw new Error("Both people must be eligible for SOC shifts.");

  const mine = getShiftSchedule(requesterId, date);
  const theirs = getShiftSchedule(targetId, targetDate);
  if (!mine) throw new Error("You do not have a scheduled shift on your selected date.");
  if (!theirs) throw new Error("The selected analyst does not have a scheduled shift on the requested date.");

  if (date !== targetDate) {
    if (getShiftSchedule(requesterId, targetDate)) throw new Error("You already have a shift on the requested analyst's date.");
    if (getShiftSchedule(targetId, date)) throw new Error("The requested analyst already has a shift on your date.");
  }

  const duplicate = db.prepare(
    `SELECT id FROM shift_change_requests
     WHERE status IN ('pending_target','pending_manager') AND (
       (requester_id = ? AND date = ?) OR
       (target_id = ? AND target_date = ?) OR
       (requester_id = ? AND date = ?) OR
       (target_id = ? AND target_date = ?)
     )`
  ).get(requesterId, date, requesterId, date, targetId, targetDate, targetId, targetDate);
  if (duplicate) throw new Error("One of these shifts already has an open change request.");

  const result = db.prepare(
    `INSERT INTO shift_change_requests (requester_id, target_id, date, target_date, requester_shift, target_shift, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(requesterId, targetId, date, targetDate, mine.shiftType, theirs.shiftType, String(reason).trim());
  return getShiftChangeRequest(Number(result.lastInsertRowid));
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

function applyShiftChange(request, managerId) {
  const mine = getShiftSchedule(request.requesterId, request.date);
  const theirs = getShiftSchedule(request.targetId, request.targetDate);
  if (!mine || !theirs || mine.shiftType !== request.requesterShift || theirs.shiftType !== request.targetShift) {
    throw new Error("The schedule changed after this request was created. Create a new request.");
  }

  const slots = [
    [request.requesterId, request.date],
    [request.targetId, request.targetDate],
    [request.requesterId, request.targetDate],
    [request.targetId, request.date],
  ];
  if (slots.some(([userId, date]) => shiftLogHasProgress(userId, date))) {
    throw new Error("A Shift Log has already started for one of these dates, so the swap can no longer be applied.");
  }

  if (request.date !== request.targetDate) {
    if (getShiftSchedule(request.requesterId, request.targetDate)) throw new Error("Requester already has a shift on the destination date.");
    if (getShiftSchedule(request.targetId, request.date)) throw new Error("Requested analyst already has a shift on the destination date.");
  }

  for (const [userId, date] of slots) deleteEmptyShiftLog(userId, date);

  if (request.date === request.targetDate) {
    db.prepare("UPDATE shift_schedules SET shift_type = ?, updated_by = ?, updated_at = datetime('now') WHERE user_id = ? AND date = ?")
      .run(request.targetShift, managerId, request.requesterId, request.date);
    db.prepare("UPDATE shift_schedules SET shift_type = ?, updated_by = ?, updated_at = datetime('now') WHERE user_id = ? AND date = ?")
      .run(request.requesterShift, managerId, request.targetId, request.date);
  } else {
    db.prepare("DELETE FROM shift_schedules WHERE user_id = ? AND date = ?").run(request.requesterId, request.date);
    db.prepare("DELETE FROM shift_schedules WHERE user_id = ? AND date = ?").run(request.targetId, request.targetDate);
    db.prepare("INSERT INTO shift_schedules (user_id, date, shift_type, created_by, updated_by) VALUES (?, ?, ?, ?, ?)")
      .run(request.requesterId, request.targetDate, request.targetShift, managerId, managerId);
    db.prepare("INSERT INTO shift_schedules (user_id, date, shift_type, created_by, updated_by) VALUES (?, ?, ?, ?, ?)")
      .run(request.targetId, request.date, request.requesterShift, managerId, managerId);
  }

  db.prepare(
    `UPDATE shift_change_requests
     SET status = 'approved',
         target_approved_at = COALESCE(target_approved_at, datetime('now')),
         target_approved_by = COALESCE(target_approved_by, ?),
         manager_approved_at = datetime('now'), manager_approved_by = ?, resolved_at = datetime('now')
     WHERE id = ?`
  ).run(managerId, managerId, request.id);

  db.prepare(
    `UPDATE shift_change_requests SET status = 'cancelled', resolved_at = datetime('now')
     WHERE id != ? AND status IN ('pending_target','pending_manager')
       AND (requester_id IN (?, ?) OR target_id IN (?, ?))
       AND (date IN (?, ?) OR target_date IN (?, ?))`
  ).run(
    request.id,
    request.requesterId, request.targetId, request.requesterId, request.targetId,
    request.date, request.targetDate, request.date, request.targetDate
  );
}

export function actOnShiftChange(id, actor, action) {
  return transaction(() => {
    const request = getShiftChangeRequest(id);
    if (!request) throw new Error("Shift change request not found.");
    const manager = isManager(actor);

    if (action === "accept") {
      if (actor.id !== request.targetId) throw new Error("Only the requested analyst can accept this request.");
      if (request.status !== "pending_target") throw new Error("This request is no longer waiting for analyst approval.");
      db.prepare("UPDATE shift_change_requests SET status = 'pending_manager', target_approved_at = datetime('now'), target_approved_by = ? WHERE id = ?")
        .run(actor.id, id);
    } else if (action === "approve") {
      if (!manager) throw new Error("Manager approval is required.");
      if (!["pending_target", "pending_manager"].includes(request.status)) throw new Error("This request is already resolved.");
      applyShiftChange(request, actor.id);
    } else if (action === "reject") {
      if (!manager && actor.id !== request.targetId) throw new Error("Only the requested analyst or a manager can reject this request.");
      if (!["pending_target", "pending_manager"].includes(request.status)) throw new Error("This request is already resolved.");
      db.prepare("UPDATE shift_change_requests SET status = 'rejected', resolved_at = datetime('now') WHERE id = ?").run(id);
    } else if (action === "cancel") {
      if (actor.id !== request.requesterId) throw new Error("Only the requester can cancel this request.");
      if (!["pending_target", "pending_manager"].includes(request.status)) throw new Error("This request is already resolved.");
      db.prepare("UPDATE shift_change_requests SET status = 'cancelled', resolved_at = datetime('now') WHERE id = ?").run(id);
    } else {
      throw new Error("Invalid action.");
    }
    return getShiftChangeRequest(id);
  });
}

// ---- Members ---------------------------------------------------------------
const COLORS = ["#5B6CF0", "#2F9E79", "#C0703A", "#8A5BD6", "#3A8FC4", "#B0506A", "#4F7A3A", "#9A7B2F"];

export function updateMember(id, { role, team, province, passwordHash }) {
  if (role) db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  if (team) db.prepare("UPDATE users SET team = ? WHERE id = ?").run(team, id);
  if (province !== undefined) db.prepare("UPDATE users SET province = ? WHERE id = ?").run(province, id);
  if (passwordHash) db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
  return listUsers().find((u) => u.id === id);
}

export const endSessions = (userId, exceptToken) =>
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").run(userId, exceptToken ?? "");

export function createMember({ name, email, role, team, province = null, passwordHash }) {
  const base = name.trim().split(/\s+/).map((w) => w[0].toLowerCase()).join("").slice(0, 3) || "u";
  let id = base, i = 1;
  while (getUser(id)) id = `${base}${++i}`;
  const color = COLORS[db.prepare("SELECT COUNT(*) AS n FROM users").get().n % COLORS.length];
  db.prepare("INSERT INTO users (id, name, email, password_hash, role, team, color, province) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, name.trim(), email.trim(), passwordHash, role, team, color, province);
  return listUsers().find((u) => u.id === id);
}

export function deactivateMember(id) {
  db.prepare("UPDATE users SET active = 0 WHERE id = ?").run(id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
}
