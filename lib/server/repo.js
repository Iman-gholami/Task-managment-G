import "server-only";
import { db } from "@/lib/server/db";

export const today = () => new Date().toISOString().slice(0, 10);

const rel = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const toTask = (r) => ({ id: r.id, title: r.title, description: r.description, a: r.assignee, team: r.team, status: r.status, prio: r.prio, cx: r.cx, due: r.due, hours: r.hours, quality: r.quality, upd: rel(r.updated_at) });

export const listUsers = () =>
  db.prepare("SELECT id, name, email, role, team, color, assist, active FROM users ORDER BY name").all().map((u) => ({ ...u, active: !!u.active }));

export const getUser = (id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id);

export const listTasks = () => db.prepare("SELECT * FROM tasks ORDER BY id DESC").all().map(toTask);
export const getTask = (id) => {
  const r = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return r ? toTask(r) : null;
};

export function createTask({ title, description = "", a, prio, cx, due }, by) {
  const assignee = getUser(a);
  const max = db.prepare("SELECT MAX(CAST(SUBSTR(id, 3) AS INTEGER)) AS m FROM tasks").get().m || 1000;
  const id = `T-${max + 1}`;
  db.prepare("INSERT INTO tasks (id, title, description, assignee, team, status, prio, cx, due, created_by) VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?)")
    .run(id, title, description, a, assignee.team, prio, cx, due || "—", by);
  return getTask(id);
}

const TASK_FIELDS = ["status", "prio", "cx", "hours", "quality", "due", "title", "description"];
export function updateTask(id, patch) {
  const keys = Object.keys(patch).filter((k) => TASK_FIELDS.includes(k));
  if (keys.length) {
    db.prepare(`UPDATE tasks SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...keys.map((k) => patch[k]), id);
  }
  return getTask(id);
}

// ---- Shift logs ------------------------------------------------------------
const TEMPLATE = [
  [1, "Review Logged Incidents in Splunk Incident Review", "basic"],
  [2, "Upload Malicious IP and Domain Files to the Website", "files"],
  [3, "Review Scanner and Sensor Dashboards", "monitor"],
  [4, "Prepare Daily Traffic Report", "report"],
  [5, "Monitor Website Status in Grafana", "monitor"],
  [6, "Monitor Security Center Website", "monitor"],
  [7, "Monitor Security News", "basic"],
  [8, "Add IOCs to MISP and Share Them via Bale", "misp"],
].map(([n, title, kind]) => ({ n, title, kind, done: false, ...(kind === "misp" ? { iocs: 0, bale: false, mispRef: "" } : {}) }));

export function getShiftLog(userId, date = today()) {
  let row = db.prepare("SELECT * FROM shift_logs WHERE user_id = ? AND date = ?").get(userId, date);
  if (!row) {
    db.prepare("INSERT INTO shift_logs (user_id, date, data) VALUES (?, ?, ?)").run(userId, date, JSON.stringify(TEMPLATE));
    row = db.prepare("SELECT * FROM shift_logs WHERE user_id = ? AND date = ?").get(userId, date);
  }
  const tickets = db.prepare("SELECT number AS no, ref, description AS desc FROM tickets WHERE user_id = ? AND date = ? ORDER BY id").all(userId, date).map((t) => ({ ...t }));
  return { date, activities: JSON.parse(row.data), completedAt: row.completed_at, updatedAt: row.updated_at, tickets };
}

const ACTIVITY_FIELDS = ["done", "iocs", "bale", "mispRef", "issue", "note"];
export function updateActivity(userId, n, patch) {
  const log = getShiftLog(userId);
  if (log.completedAt) throw new Error("Shift is already completed");
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => ACTIVITY_FIELDS.includes(k)));
  const activities = log.activities.map((a) => (a.n === n ? { ...a, ...clean } : a));
  db.prepare("UPDATE shift_logs SET data = ?, updated_at = datetime('now') WHERE user_id = ? AND date = ?").run(JSON.stringify(activities), userId, log.date);
  return activities;
}

export function setShiftCompleted(userId, completed) {
  db.prepare("UPDATE shift_logs SET completed_at = ?, updated_at = datetime('now') WHERE user_id = ? AND date = ?")
    .run(completed ? new Date().toISOString() : null, userId, today());
  return getShiftLog(userId);
}

export function addTicket(userId, { no, ref = "", desc = "" }) {
  db.prepare("INSERT INTO tickets (user_id, date, number, ref, description) VALUES (?, ?, ?, ?, ?)").run(userId, today(), no, ref, desc);
  return getShiftLog(userId).tickets;
}

/** Today's shift log status per user: "completed" | "active". Missing users have none. */
export function shiftStatusToday() {
  const rows = db.prepare("SELECT user_id, data, completed_at FROM shift_logs WHERE date = ?").all(today());
  return Object.fromEntries(rows.map((r) => [r.user_id, r.completed_at ? "completed" : JSON.parse(r.data).some((a) => a.done) ? "active" : "missing"]));
}

export const listAllTickets = () =>
  db.prepare("SELECT user_id AS a, date, number AS no, ref, description AS desc FROM tickets ORDER BY date DESC, id DESC").all().map((t) => ({ ...t }));

// ---- Members ---------------------------------------------------------------
const COLORS = ["#5B6CF0", "#2F9E79", "#C0703A", "#8A5BD6", "#3A8FC4", "#B0506A", "#4F7A3A", "#9A7B2F"];

export function createMember({ name, email, role, team, passwordHash }) {
  const base = name.trim().split(/\s+/).map((w) => w[0].toLowerCase()).join("").slice(0, 3) || "u";
  let id = base, i = 1;
  while (getUser(id)) id = `${base}${++i}`;
  const color = COLORS[db.prepare("SELECT COUNT(*) AS n FROM users").get().n % COLORS.length];
  db.prepare("INSERT INTO users (id, name, email, password_hash, role, team, color) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, name.trim(), email.trim(), passwordHash, role, team, color);
  return listUsers().find((u) => u.id === id);
}

/** Soft delete: keeps history (tasks, shift logs, tickets) and ends all sessions. */
export function deactivateMember(id) {
  db.prepare("UPDATE users SET active = 0 WHERE id = ?").run(id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
}
