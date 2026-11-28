import "server-only";
import { db } from "@/lib/server/db";
import { normalizeTaskLinks } from "@/lib/task-links";

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const memberSql = `SELECT c.task_id AS taskId, c.user_id AS userId, c.is_lead AS isLead,
  c.responsibility, c.due, c.work_performed AS workPerformed, c.outcome, c.links,
  c.hours, c.revision, c.state, c.submitted_at AS submittedAt, c.approved_at AS approvedAt,
  c.started_at AS startedAt, c.reviewer_id AS reviewerId, c.return_reason AS returnReason, c.removed_at AS removedAt,
  u.name FROM task_collaborators c JOIN users u ON u.id = c.user_id WHERE c.task_id = ?`;

export function collaborationFor(taskId) {
  const config = db.prepare("SELECT mode FROM task_collaborations WHERE task_id = ?").get(taskId);
  if (!config) return null;
  const members = db.prepare(`${memberSql} ORDER BY c.is_lead DESC, u.name`).all(taskId)
    .map((row) => ({ ...row, isLead: !!row.isLead, links: JSON.parse(row.links || "[]"), removed: !!row.removedAt }));
  return { mode: config.mode, members };
}

export function activeCollaborator(taskId, userId) {
  return !!db.prepare("SELECT 1 FROM task_collaborators WHERE task_id = ? AND user_id = ? AND removed_at IS NULL").get(taskId, userId);
}

/** Validated by the route; called inside the parent's transaction during creation. */
export function configureCollaboration(taskId, leadId, mode, members, actorId, leadResponsibility = "") {
  if (!["free", "split"].includes(mode)) fail(400, "Invalid collaboration mode.");
  if (!Array.isArray(members) || !members.length || members.length > 20) fail(400, "Choose between 1 and 20 collaborators.");
  const ids = [leadId, ...members.map((m) => m.userId)];
  if (new Set(ids).size !== ids.length) fail(400, "Each collaborator must be unique and different from the lead.");
  const before = collaborationFor(taskId);
  if (before && before.mode !== mode && before.members.some((m) => m.startedAt || m.revision || m.state !== "working"))
    fail(409, "Collaboration mode cannot change after participants have recorded work.");
  db.prepare("INSERT INTO task_collaborations (task_id, mode, created_by) VALUES (?, ?, ?) ON CONFLICT(task_id) DO UPDATE SET mode = excluded.mode")
    .run(taskId, mode, actorId);
  const task = db.prepare("SELECT due FROM tasks WHERE id = ?").get(taskId);
  const all = [{ userId: leadId, isLead: 1, responsibility: leadResponsibility, due: task?.due === "—" ? null : task?.due },
    ...members.map((m) => ({ ...m, isLead: 0 }))];
  const activeIds = new Set(all.map((m) => m.userId));
  db.prepare(`UPDATE task_collaborators SET removed_at = datetime('now') WHERE task_id = ? AND removed_at IS NULL AND user_id NOT IN (${all.map(() => "?").join(",")})`)
    .run(taskId, ...activeIds);
  const insert = db.prepare(`INSERT INTO task_collaborators (task_id, user_id, is_lead, responsibility, due)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(task_id,user_id) DO UPDATE SET
      is_lead = excluded.is_lead, responsibility = excluded.responsibility, due = excluded.due, removed_at = NULL`);
  for (const m of all) insert.run(taskId, m.userId, m.isLead, String(m.responsibility || "").trim().slice(0, 2000), m.due || null);
  return collaborationFor(taskId);
}

export function validateCollaborationInput(task, body, getUser, canAssignTask, actor) {
  if (!body || typeof body !== "object" || !["free", "split"].includes(body.mode) || !Array.isArray(body.members))
    fail(400, "Choose a valid collaboration mode and members.");
  if (body.members.length < 1 || body.members.length > 20) fail(400, "Choose between 1 and 20 collaborators.");
  if (body.leadResponsibility != null && (typeof body.leadResponsibility !== "string" || body.leadResponsibility.length > 2000))
    fail(400, "Invalid primary responsibility.");
  const leadResponsibility = String(body.leadResponsibility || "").trim();
  if (body.mode === "split" && !leadResponsibility) fail(400, "Define the lead's responsibility.");
  const members = body.members.map((m) => {
    if (!m || typeof m !== "object" || typeof m.userId !== "string" ||
        (m.responsibility != null && (typeof m.responsibility !== "string" || m.responsibility.length > 2000)) ||
        (m.due != null && m.due !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(m.due))) fail(400, "Invalid collaborator details.");
    const user = getUser(m.userId);
    if (!user || !user.active || !canAssignTask(actor, user)) fail(403, "A collaborator is outside your assignment scope.");
    if (body.mode === "split" && !String(m.responsibility || "").trim()) fail(400, "Define each collaborator's responsibility.");
    return { userId: user.id, responsibility: String(m.responsibility || "").trim(), due: m.due || null };
  });
  if (members.some((m) => m.userId === task.a) || new Set(members.map((m) => m.userId)).size !== members.length)
    fail(400, "Collaborators must be distinct from the primary assignee.");
  return { mode: body.mode, members, leadResponsibility };
}

function aggregateReport(taskId) {
  const members = collaborationFor(taskId)?.members.filter((m) => !m.removed) ?? [];
  const work = members.filter((m) => m.workPerformed).map((m) => `${m.name}: ${m.workPerformed}`).join("\n\n");
  const outcome = members.filter((m) => m.outcome).map((m) => `${m.name}: ${m.outcome}`).join("\n\n");
  const links = [...new Set(members.flatMap((m) => m.links))].slice(0, 10);
  db.prepare(`INSERT INTO task_work_reports (task_id, work_performed, outcome, hours_recorded, links, revision)
    VALUES (?, ?, ?, 1, ?, 1) ON CONFLICT(task_id) DO UPDATE SET
    work_performed = excluded.work_performed, outcome = excluded.outcome,
    hours_recorded = 1, links = excluded.links, revision = task_work_reports.revision + 1,
    updated_at = datetime('now')`).run(taskId, work.slice(0, 10000), outcome.slice(0, 10000), JSON.stringify(links));
}

/** All writes and state changes are atomic; stale per-person revisions cannot replace someone else's report. */
export function changeContribution(task, actor, input) {
  const config = collaborationFor(task.id);
  if (!config) fail(404, "This is not a collaborative task.");
  const action = input?.action;
  if (!["start", "save", "submit", "handover", "approve", "return"].includes(action)) fail(400, "Invalid collaboration action.");
  db.exec("BEGIN IMMEDIATE");
  try {
    const fresh = db.prepare("SELECT status, review_required FROM tasks WHERE id = ? AND deleted_at IS NULL").get(task.id);
    if (!fresh || (action === "start"
      ? !["backlog", "todo", "progress", "returned"].includes(fresh.status)
      : !["progress", "returned"].includes(fresh.status) && !(fresh.status === "review" && ["approve", "return"].includes(action))))
      fail(409, "The task is not accepting collaboration updates.");
    const member = db.prepare("SELECT * FROM task_collaborators WHERE task_id = ? AND user_id = ? AND removed_at IS NULL").get(task.id, input.userId || actor.id);
    if (!member) fail(404, "Active collaborator not found.");
    const manager = actor.role === "security_manager" || actor.role === "soc_manager" && task.team.startsWith("SOC") || actor.role === "automation_manager" && task.team === "Design & Automation";
    if (action === "start") {
      if (member.user_id !== actor.id || actor.role === "observer") fail(403, "You can only start your own contribution.");
      if (config.mode === "free") {
        if (!member.is_lead || task.a !== actor.id) fail(403, "Only the lead can start shared work.");
        if (!["todo", "backlog"].includes(fresh.status)) fail(409, "The shared task has already started.");
      } else if (member.started_at || member.revision || member.state !== "working") {
        fail(409, "Your contribution has already started or been submitted.");
      }
      if (config.mode === "split") db.prepare("UPDATE task_collaborators SET started_at = datetime('now') WHERE task_id = ? AND user_id = ?")
        .run(task.id, actor.id);
      if (["todo", "backlog", "returned"].includes(fresh.status)) {
        db.prepare("UPDATE tasks SET status = 'progress', started_at = COALESCE(started_at, datetime('now')), updated_at = datetime('now') WHERE id = ?").run(task.id);
        db.prepare("INSERT INTO task_transitions (task_id, from_status, to_status, user_id) VALUES (?, ?, 'progress', ?)")
          .run(task.id, fresh.status, actor.id);
      }
    } else if (["approve", "return"].includes(action)) {
      if (!manager || actor.id === member.user_id) fail(403, "Only the independent responsible manager can review a contribution.");
      if (config.mode !== "split" || member.state !== "submitted") fail(409, "This contribution is not awaiting review.");
      if (action === "return") {
        const reason = String(input.reason || "").trim();
        if (!reason || reason.length > 5000) fail(400, "Enter a return reason of up to 5000 characters.");
        db.prepare("UPDATE task_collaborators SET state = 'returned', return_reason = ?, approved_at = NULL, reviewer_id = ? WHERE task_id = ? AND user_id = ?")
          .run(reason, actor.id, task.id, member.user_id);
        if (fresh.status === "review") db.prepare("UPDATE tasks SET status = 'returned', updated_at = datetime('now') WHERE id = ?").run(task.id);
      } else db.prepare("UPDATE task_collaborators SET state = 'approved', return_reason = '', approved_at = datetime('now'), reviewer_id = ? WHERE task_id = ? AND user_id = ?")
        .run(actor.id, task.id, member.user_id);
    } else {
      if (member.user_id !== actor.id) fail(403, "You can only report your own contribution.");
      if (member.state === "approved" || member.state === "submitted") fail(409, "This contribution has already been submitted.");
      // Reports saved before this migration already have a revision; keep those editable.
      if (config.mode === "split" && !member.started_at && !member.revision) fail(409, "Start your contribution before recording work.");
      if (!Number.isSafeInteger(input.revision) || input.revision !== member.revision) fail(409, "This report changed. Refresh before saving.");
      if (typeof input.workPerformed !== "string" || typeof input.outcome !== "string" || input.workPerformed.length > 10000 || input.outcome.length > 10000 ||
        typeof input.hours !== "number" || !Number.isFinite(input.hours) || input.hours < 0 || input.hours > 1000)
        fail(400, "Enter valid work, outcome and hours.");
      const links = normalizeTaskLinks(input.links ?? []);
      if (!links) fail(400, "Enter up to 10 valid http(s) links.");
      if (action === "submit" && config.mode !== "split" || action === "handover" && (config.mode !== "free" || !member.is_lead))
        fail(403, "This submission action is not allowed for this collaboration mode.");
      if (["submit", "handover"].includes(action) && (!input.workPerformed.trim() || !input.outcome.trim()))
        fail(400, "Complete work and outcome before submitting.");
      if (action === "handover" && !config.members.filter((m) => !m.removed).some((m) => m.userId === actor.id)) fail(403, "Only the lead may hand over the task.");
      db.prepare(`UPDATE task_collaborators SET work_performed = ?, outcome = ?, hours = ?, links = ?,
        revision = revision + 1, state = ?, submitted_at = CASE WHEN ? THEN datetime('now') ELSE submitted_at END,
        return_reason = CASE WHEN ? THEN '' ELSE return_reason END
        WHERE task_id = ? AND user_id = ?`)
        .run(input.workPerformed.trim(), input.outcome.trim(), input.hours, JSON.stringify(links), action === "save" ? "working" : "submitted", action !== "save" ? 1 : 0, action !== "save" ? 1 : 0, task.id, actor.id);
    }
    const current = collaborationFor(task.id);
    const active = current.members.filter((m) => !m.removed);
    const total = Math.round(current.members.reduce((sum, m) => sum + m.hours, 0) * 100) / 100;
    db.prepare("UPDATE tasks SET hours = ?, updated_at = datetime('now') WHERE id = ?").run(total, task.id);
    if (action === "handover" || (config.mode === "split" && active.every((m) => ["submitted", "approved"].includes(m.state)))) {
      aggregateReport(task.id);
      if (fresh.status !== "review") {
        const target = fresh.review_required ? "review" : "done";
        db.prepare("UPDATE tasks SET status = ?, completed_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE completed_at END WHERE id = ?")
          .run(target, target, task.id);
        db.prepare("INSERT INTO task_transitions (task_id, from_status, to_status, user_id) VALUES (?, ?, ?, ?)")
          .run(task.id, fresh.status, target, actor.id);
      }
    } else if (fresh.status === "returned" && action === "save") {
      db.prepare("UPDATE tasks SET status = 'progress' WHERE id = ?").run(task.id);
      db.prepare("INSERT INTO task_transitions (task_id, from_status, to_status, user_id) VALUES (?, 'returned', 'progress', ?)").run(task.id, actor.id);
    }
    const verb = { start: "started their contribution", save: "updated their contribution", submit: "submitted their contribution", handover: "handed over the shared task", approve: "approved a contribution", return: "returned a contribution for changes" }[action];
    db.prepare("INSERT INTO task_events (task_id, user_id, text) VALUES (?, ?, ?)").run(task.id, actor.id, verb);
    db.exec("COMMIT");
    return collaborationFor(task.id);
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
