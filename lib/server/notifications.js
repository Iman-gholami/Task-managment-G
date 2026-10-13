import "server-only";
import { db } from "@/lib/server/db";
import { canViewTask } from "@/lib/server/access";
import { getUser, listUsers } from "@/lib/server/repo";
import { SOC_TEAMS, isManager } from "@/lib/roles";

/**
 * Stored notifications. A row keeps a type and its params (never rendered text), so it reads in the viewer's
 * language: the client renders `notifications.types.<type>` with the params. Deadline reminders (due soon, overdue)
 * stay derived from the task list and are not stored.
 */
export const NOTIFICATION_TYPES = [
  "taskAssigned", "taskSubmitted", "taskApproved", "taskReturned", "taskReopened", "mention",
  "swapRequested", "swapNew", "swapAccepted", "swapReady", "swapApproved", "swapRejected", "swapCancelled",
];
/** Filter groups shown in the notification center. */
export const NOTIFICATION_GROUPS = {
  tasks: ["taskAssigned", "taskSubmitted", "taskApproved", "taskReturned", "taskReopened"],
  mentions: ["mention"],
  shifts: ["swapRequested", "swapNew", "swapAccepted", "swapReady", "swapApproved", "swapRejected", "swapCancelled"],
};

const placeholders = (n) => Array.from({ length: n }, () => "?").join(",");
const activeUser = (id) => {
  const u = id ? getUser(id) : null;
  return u && u.active ? u : null;
};

/** Writes one notification per recipient (the actor never notifies themselves; inactive members are skipped). */
export function notify({ to, type, params = {}, actorId = null, target = null }) {
  if (!NOTIFICATION_TYPES.includes(type)) throw new Error(`Unknown notification type ${type}`);
  const ids = [...new Set((Array.isArray(to) ? to : [to]).filter(Boolean))].filter((id) => id !== actorId && activeUser(id));
  const insert = db.prepare("INSERT INTO notifications (user_id, type, params, actor_id, target) VALUES (?, ?, ?, ?, ?)");
  for (const id of ids) insert.run(id, type, JSON.stringify(params), actorId, target);
  return ids.length;
}

const toItem = (r) => {
  let params = {};
  try { params = JSON.parse(r.params); } catch {}
  return { id: r.id, type: r.type, params, actorId: r.actor_id, target: r.target, createdAt: r.created_at, readAt: r.read_at };
};

/** Newest first. `group` narrows to a filter group; `before` pages backwards by id. */
export function listNotifications(userId, { group = "", before = 0, limit = 30, unread = false } = {}) {
  const types = NOTIFICATION_GROUPS[group] ?? null;
  const where = ["user_id = ?"];
  const args = [userId];
  if (types) { where.push(`type IN (${placeholders(types.length)})`); args.push(...types); }
  if (before > 0) { where.push("id < ?"); args.push(before); }
  if (unread) where.push("read_at IS NULL");
  const size = Math.min(100, Math.max(1, Number(limit) || 30));
  const rows = db.prepare(`SELECT * FROM notifications WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`).all(...args, size + 1);
  return { items: rows.slice(0, size).map(toItem), more: rows.length > size };
}

export const unreadCount = (userId) => db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL").get(userId).n;

/** Marks the user's own notifications read: every one (`all`) or the given ids. Returns the new unread count. */
export function markRead(userId, { ids = [], all = false } = {}) {
  if (all) {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(userId);
  } else {
    const list = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
    if (list.length) db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL AND id IN (${placeholders(list.length)})`).run(userId, ...list);
  }
  return unreadCount(userId);
}

// ---- Who hears about what ---------------------------------------------------------------------------------------

const taskParams = (task) => ({ taskId: task.id, title: task.title });
const taskTarget = (task) => `/tasks/${task.id}`;

/**
 * Who reviews a task: the manager who created it, the SOC Managers for SOC analysts' work, and otherwise the
 * Security Managers (whose team is the whole department). Never the assignee.
 */
export function reviewersOf(task) {
  const users = listUsers().filter((u) => u.active);
  const assignee = users.find((u) => u.id === task.a);
  const out = new Set();
  const creator = users.find((u) => u.id === task.createdBy);
  if (creator && isManager(creator)) out.add(creator.id);
  if (assignee && SOC_TEAMS.includes(assignee.team)) users.filter((u) => u.role === "soc_manager").forEach((u) => out.add(u.id));
  if (!out.size) users.filter((u) => u.role === "security_manager").forEach((u) => out.add(u.id));
  out.delete(task.a);
  return [...out];
}

/** A new task, or a task handed to someone else. */
export function onTaskAssigned(task, actorId) {
  if (task.a === actorId) return 0;
  return notify({ to: task.a, type: "taskAssigned", params: taskParams(task), actorId, target: taskTarget(task) });
}

/** Status changes that someone else needs to hear about. `before` is the status the task had. */
export function onTaskStatus(task, before, actorId) {
  const to = task.status;
  if (to === "review") return notify({ to: reviewersOf(task), type: "taskSubmitted", params: { ...taskParams(task), assignee: task.a }, actorId, target: taskTarget(task) });
  if (before === "review" && to === "done") return notify({ to: task.a, type: "taskApproved", params: { ...taskParams(task), quality: task.quality }, actorId, target: taskTarget(task) });
  if (before === "review" && to === "returned") return notify({ to: task.a, type: "taskReturned", params: taskParams(task), actorId, target: taskTarget(task) });
  if (before === "done" && to === "progress") return notify({ to: task.a, type: "taskReopened", params: taskParams(task), actorId, target: taskTarget(task) });
  return 0;
}

/**
 * People mentioned in a comment as "@Full Name" (Persian or Latin names), who can see the task.
 * Longer names are matched first so "@Sara Rahimi" never also matches a colleague called "Sara".
 */
export function mentionedIn(body, task) {
  const text = String(body ?? "");
  if (!text.includes("@")) return [];
  const people = listUsers().filter((u) => u.active).sort((a, b) => b.name.length - a.name.length);
  const found = new Set();
  let rest = text;
  for (const u of people) {
    const re = new RegExp(`@${u.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu");
    const next = rest.replace(re, " ");
    if (next === rest) continue;
    rest = next;
    if (canViewTask(u, task)) found.add(u.id);
  }
  return [...found];
}

export function onComment(task, comment, actorId) {
  const to = mentionedIn(comment.body, task);
  if (!to.length) return 0;
  const excerpt = String(comment.body).replace(/\s+/g, " ").trim().slice(0, 140);
  return notify({ to, type: "mention", params: { ...taskParams(task), commentId: comment.id, excerpt }, actorId, target: taskTarget(task) });
}

// ---- Shift changes ---------------------------------------------------------------------------------------------

const swapParams = (r) => ({
  requestId: r.id, date: r.date, targetDate: r.targetDate, requesterShift: r.requesterShift, targetShift: r.targetShift,
  requester: r.requesterId, targetUser: r.targetId,
});
const managers = () => listUsers().filter((u) => u.active && isManager(u)).map((u) => u.id);
const SWAP_TARGET = "/shift/changes";

/** Notifications for a shift change request after `action` (create, accept, approve, reject, cancel). */
export function onShiftChange(action, request, actorId) {
  const params = swapParams(request);
  const send = (to, type) => notify({ to, type, params, actorId, target: SWAP_TARGET });
  if (action === "create") return send([request.targetId], "swapRequested") + send(managers(), "swapNew");
  if (action === "accept") return send([request.requesterId], "swapAccepted") + send(managers(), "swapReady");
  if (action === "approve") return send([request.requesterId, request.targetId], "swapApproved");
  if (action === "reject") return send([request.requesterId, request.targetId], "swapRejected");
  if (action === "cancel") return send([request.targetId], "swapCancelled");
  return 0;
}

/** Notification ids of one user that point at a target (used to mark them read when the target is opened). */
export function idsForTarget(userId, target) {
  return db.prepare("SELECT id FROM notifications WHERE user_id = ? AND target = ? AND read_at IS NULL").all(userId, target).map((r) => r.id);
}
