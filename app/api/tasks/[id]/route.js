import { isManager, requireUser } from "@/lib/server/auth";
import { err, viewableTask } from "@/lib/server/access";
import { commitTaskUpdate, deleteOwnTask, getTaskDetails, getTaskReport, getUser } from "@/lib/server/repo";
import { actionLabel, allowedTransitions, canTransition } from "@/lib/workflow";
import { CX, PRIO, QUAL, STATUS } from "@/lib/format";
import { canAssignTask, canDeleteOwnTask } from "@/lib/roles";

export async function GET(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const [task, no] = viewableTask(user, id);
  if (no) return no;
  return Response.json({ task, details: getTaskDetails(id), transitions: allowedTransitions(user, task) });
}

export async function PATCH(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (user.role === "observer") return err(403, "Observers have read-only access.");
  const { id } = await params;
  const [task, no] = viewableTask(user, id);
  if (no) return no;

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) return err(400, "Invalid task update.");
  const patch = {};
  const events = [];
  const previousReport = getTaskReport(id);
  let report = null;
  let expectedRevision = null;
  let returnReason = null;

  if ("report" in body) {
    if (task.a !== user.id) return err(403, "Only the assignee can edit the work report.");
    if (!["progress", "blocked", "returned"].includes(task.status)) return err(409, "The work report can only be edited while working on the task.");
    const input = body.report;
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        typeof input.workPerformed !== "string" || typeof input.outcome !== "string" ||
        ("clearHours" in input && typeof input.clearHours !== "boolean") ||
        !Number.isSafeInteger(input.revision) || input.revision < 0) return err(400, "Invalid work report.");
    if (input.workPerformed.length > 10000 || input.outcome.length > 10000) return err(400, "Each report field must be at most 10000 characters.");
    if (input.revision !== previousReport.revision) return err(409, "The report changed. Check the current task before saving again.");
    expectedRevision = input.revision;
    if (input.clearHours && "hours" in body) return err(400, "Clear hours or enter a total, not both.");
    report = { workPerformed: input.workPerformed.trim(), outcome: input.outcome.trim(), hoursRecorded: input.clearHours ? false : previousReport.hoursRecorded };
  }

  if ("hours" in body) {
    if ((typeof body.hours !== "number" && typeof body.hours !== "string") || String(body.hours).trim() === "") return err(400, "Enter total hours from 0 to 1000.");
    const h = Number(body.hours);
    if (!Number.isFinite(h) || h < 0 || h > 1000) return err(400, "Invalid hours.");
    if (!isOpenStatus(task.status)) return err(409, "Hours can't be changed after approval.");
    if (task.a === user.id && task.status === "review") return err(409, "Hours cannot be changed while the report is in review.");
    patch.hours = h;
    if (task.a === user.id) {
      report = { ...(report ?? previousReport), hoursRecorded: true };
      expectedRevision = previousReport.revision;
    }
  }

  if ("reviewRequired" in body && body.reviewRequired !== task.reviewRequired &&
      (("status" in body && body.status !== task.status) || ("a" in body && body.a !== task.a))) {
    return err(409, "Change the review requirement separately from status or reassignment.");
  }
  if ("a" in body && body.a !== task.a && ("report" in body || (task.status === "progress" && body.status === "review")))
    return err(409, "Reassign the task separately from saving or submitting a report.");

  if ("status" in body && body.status !== task.status) {
    if (!(body.status in STATUS)) return err(400, "Invalid status.");
    if (!canTransition(user, task, body.status)) {
      return err(409, task.status === "done" ? "This task is already approved. A manager can reopen it." : `You can't move this task from ${STATUS[task.status]} to ${STATUS[body.status]}.`);
    }
    const approving = task.status === "review" && body.status === "done";
    const selfComplete = task.status === "progress" && body.status === "done" && !task.reviewRequired && task.a === user.id;
    const sending = task.status === "progress" && (body.status === "review" || selfComplete);
    if (selfComplete && (("a" in body && body.a !== user.id) || ("reviewRequired" in body && body.reviewRequired !== false)))
      return err(409, "Complete this task separately from reassignment or review-setting changes.");
    if (approving) {
      if (typeof body.quality !== "string" || !Object.hasOwn(QUAL, body.quality)) return err(400, "Choose a quality rating to approve.");
      patch.quality = body.quality;
      if ("cx" in body) {
        if (![1, 2, 3, 4].includes(body.cx)) return err(400, "Invalid complexity.");
        patch.cx = body.cx;
      }
    }
    if (sending) {
      const handover = report ?? previousReport;
      if (!handover.workPerformed.trim() || !handover.outcome.trim() || !handover.hoursRecorded)
        return err(400, "Complete the work performed, outcome and total hours before sending the task.");
      expectedRevision ??= previousReport.revision;
    }
    if (task.status === "review" && body.status === "returned") {
      if (typeof body.returnReason !== "string" || !body.returnReason.trim()) return err(400, "Enter a reason for returning the task.");
      if (body.returnReason.length > 5000) return err(400, "The return reason must be at most 5000 characters.");
      returnReason = body.returnReason.trim();
    }
    patch.status = body.status;
    if (selfComplete) patch.quality = null;
    const label = actionLabel(task.status, body.status);
    const PAST = { "Complete task": "completed the task (review not required)", Start: "started the task", "Submit for review": "submitted it for review", Approve: "approved it", "Return for changes": "returned it for changes", Reopen: "reopened the task", Unblock: "unblocked the task", "Resume work": "resumed work", "Mark blocked": "marked it blocked", "Cancel task": "cancelled the task", Restore: "restored the task" };
    let event = `${PAST[label] ?? `moved it to ${STATUS[body.status]}`}${patch.quality ? ` · quality: ${QUAL[patch.quality]}` : ""}`;
    if (approving && patch.cx !== undefined && patch.cx !== task.cx) event += ` · complexity: ${CX[task.cx]} → ${CX[patch.cx]}`;
    events.push(event);
  } else if ("quality" in body) {
    return err(400, "Quality is set when a reviewer approves the task.");
  }
  if ("returnReason" in body && !returnReason) return err(400, "A return reason can only be recorded when returning a task.");
  if ("prio" in body && body.prio !== task.prio) {
    if (!(body.prio in PRIO)) return err(400, "Invalid priority.");
    if (!isOpenStatus(task.status)) return err(409, "Closed tasks can't be changed.");
    patch.prio = body.prio;
    events.push(`priority ${PRIO[task.prio]} → ${PRIO[body.prio]}`);
  }
  // Managers may decide whether an open task requires review within their scope.
  if ("reviewRequired" in body) {
    if (typeof body.reviewRequired !== "boolean") return err(400, "Invalid review requirement.");
    if (!isManager(user)) return err(403, "Only managers can change the review requirement.");
    if (!isOpenStatus(task.status) || task.status === "review") return err(409, "Review settings cannot change while the task is in review or closed.");
    if (body.reviewRequired !== task.reviewRequired) {
      patch.reviewRequired = body.reviewRequired ? 1 : 0;
      events.push(body.reviewRequired ? "enabled manager review" : "disabled manager review");
    }
  }
  // Details (title, description, deadline, complexity, assignee) are edited by managers.
  const detailKeys = ["title", "description", "due", "cx", "a"].filter((k) => k in body);
  if (detailKeys.length) {
    if (!isManager(user)) return err(403, "Only a manager can change task details.");
    if (!isOpenStatus(task.status)) return err(409, "Closed tasks can't be changed.");
  }
  for (const k of ["title", "description"]) {
    if (k in body) {
      const v = String(body[k]).trim();
      if (k === "title" && !v) return err(400, "Title is required.");
      patch[k] = v;
    }
  }
  if ("due" in body) {
    if (body.due && !/^\d{4}-\d{2}-\d{2}$/.test(body.due)) return err(400, "Invalid deadline.");
    patch.due = body.due || "—";
    events.push(body.due ? `deadline → ${body.due}` : "removed the deadline");
  }
  if ("cx" in body) {
    if (![1, 2, 3, 4].includes(body.cx)) return err(400, "Invalid complexity.");
    patch.cx = body.cx;
  }
  if ("a" in body && body.a !== task.a) {
    const assignee = getUser(body.a);
    if (!assignee || !assignee.active) return err(400, "Assignee not found.");
    if (!canAssignTask(user, assignee)) return err(403, "You can't assign a task to this member.");
    patch.a = assignee.id;
    patch.team = assignee.team;
    // Reassignment restores review unless a manager explicitly chooses otherwise afterward.
    patch.reviewRequired = 1;
    events.push(`reassigned to ${assignee.name}`);
  }
  const updated = commitTaskUpdate(id, patch, user.id, { expectedStatus: task.status, expectedAssignee: task.a, expectedRevision, report, returnReason, events });
  if (!updated) return err(409, "The task changed. Check the current task before trying again.");
  return Response.json({ task: updated, details: getTaskDetails(id), transitions: allowedTransitions(user, updated) });
}

export async function DELETE(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const [task, no] = viewableTask(user, id);
  if (no) return no;
  if (!canDeleteOwnTask(user, task)) return err(403, "You can only delete tasks you created yourself.");
  if (!deleteOwnTask(id, user.id)) return err(404, "Task not found.");
  return Response.json({ deleted: true });
}

const isOpenStatus = (s) => s !== "done" && s !== "cancelled";
