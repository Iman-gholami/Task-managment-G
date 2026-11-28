import { requireUser } from "@/lib/server/auth";
import { err, viewableTask } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { addEvent, getTask, getTaskDetails, getTaskReport, getUser } from "@/lib/server/repo";
import { canAssignTask, canReviewTask } from "@/lib/roles";
import { changeContribution, collaborationFor, configureCollaboration, validateCollaborationInput } from "@/lib/server/task-collaboration";
import { allowedTransitions } from "@/lib/workflow";

export async function PATCH(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const [task, no] = viewableTask(user, id);
  if (no) return no;
  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) return err(400, "Invalid collaboration update.");
  if (body.action === "configure") {
    if (!canReviewTask(user, task)) return err(403, "Only the responsible manager can change collaborators.");
    if (!["todo", "backlog", "progress", "returned"].includes(task.status)) return err(409, "Collaborators cannot change while the task is in review or closed.");
    let collaboration;
    try { collaboration = validateCollaborationInput(task, body.collaboration, getUser, canAssignTask, user); }
    catch (error) { return err(error.status || 400, error.message); }
    db.exec("BEGIN IMMEDIATE");
    try {
      const previous = collaborationFor(id);
      const priorIds = new Set(previous?.members.filter((m) => !m.removed).map((m) => m.userId) ?? [task.a]);
      configureCollaboration(id, task.a, collaboration.mode, collaboration.members, user.id, collaboration.leadResponsibility);
      if (!previous) {
        // Keep a previous individual draft when a manager first makes a task collaborative.
        const report = getTaskReport(id);
        if (report.revision || task.hours) db.prepare(`UPDATE task_collaborators SET work_performed = ?, outcome = ?, links = ?, hours = ?, revision = ?
          WHERE task_id = ? AND user_id = ?`).run(report.workPerformed, report.outcome, JSON.stringify(report.links), task.hours, report.revision, id, task.a);
      }
      for (const member of collaboration.members.filter((m) => !priorIds.has(m.userId))) {
        db.prepare("INSERT INTO task_assignment_notifications (task_id, recipient_id, actor_id) VALUES (?, ?, ?)").run(id, member.userId, user.id);
      }
      addEvent(id, user.id, `updated ${collaboration.mode === "split" ? "divided" : "shared"} collaboration members`);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); return err(error.status || 409, error.message); }
  } else {
    try { changeContribution(task, user, body); }
    catch (error) { return err(error.status || 409, error.message); }
  }
  const updated = getTask(id);
  return Response.json({ task: updated, details: getTaskDetails(id), transitions: allowedTransitions(user, updated) });
}
