import { isManager, requireUser } from "@/lib/server/auth";
import { err, viewableTask } from "@/lib/server/access";
import { addEvent, getTaskDetails, getUser, updateTask } from "@/lib/server/repo";
import { actionLabel, allowedTransitions, canTransition } from "@/lib/workflow";
import { CX, PRIO, QUAL, STATUS } from "@/lib/format";
import { canAssignTask } from "@/lib/roles";

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
  const patch = {};
  const events = [];

  if ("status" in body && body.status !== task.status) {
    if (!(body.status in STATUS)) return err(400, "Invalid status.");
    if (!canTransition(user, task, body.status)) {
      return err(409, task.status === "done" ? "This task is already approved. A manager can reopen it." : `You can't move this task from ${STATUS[task.status]} to ${STATUS[body.status]}.`);
    }
    const approving = task.status === "review" && body.status === "done";
    const selfComplete = task.status === "progress" && body.status === "done" && !task.reviewRequired &&
      user.role === "soc_manager" && task.a === user.id;
    if (selfComplete && (("a" in body && body.a !== user.id) || ("reviewRequired" in body && body.reviewRequired !== false)))
      return err(409, "Complete this self-managed task separately from reassignment or review-setting changes.");
    if (approving) {
      if (!(body.quality in QUAL)) return err(400, "Choose a quality rating to approve.");
      patch.quality = body.quality;
      if ("cx" in body) {
        if (![1, 2, 3, 4].includes(body.cx)) return err(400, "Invalid complexity.");
        patch.cx = body.cx;
      }
    }
    patch.status = body.status;
    if (selfComplete) patch.quality = null;
    const label = actionLabel(task.status, body.status);
    const PAST = { "Complete task": "completed their own task (review not required)", Start: "started the task", "Submit for review": "submitted it for review", Approve: "approved it", "Return for changes": "returned it for changes", Reopen: "reopened the task", Unblock: "unblocked the task", "Resume work": "resumed work", "Mark blocked": "marked it blocked", "Cancel task": "cancelled the task", Restore: "restored the task" };
    let event = `${PAST[label] ?? `moved it to ${STATUS[body.status]}`}${patch.quality ? ` · quality: ${QUAL[patch.quality]}` : ""}`;
    if (approving && patch.cx !== undefined && patch.cx !== task.cx) event += ` · complexity: ${CX[task.cx]} → ${CX[patch.cx]}`;
    events.push(event);
  } else if ("quality" in body) {
    return err(400, "Quality is set when a reviewer approves the task.");
  }
  if ("prio" in body && body.prio !== task.prio) {
    if (!(body.prio in PRIO)) return err(400, "Invalid priority.");
    if (!isOpenStatus(task.status)) return err(409, "Closed tasks can't be changed.");
    patch.prio = body.prio;
    events.push(`priority ${PRIO[task.prio]} → ${PRIO[body.prio]}`);
  }
  if ("hours" in body) {
    const h = Number(body.hours);
    if (!Number.isFinite(h) || h < 0 || h > 1000) return err(400, "Invalid hours.");
    if (!isOpenStatus(task.status)) return err(409, "Hours can't be changed after approval.");
    patch.hours = h;
  }
  // The review bypass is available ONLY on an open SOC Manager self-task.
  // Requiring the actor to be the assignee prevents bypass on any analyst task.
  if ("reviewRequired" in body) {
    if (typeof body.reviewRequired !== "boolean") return err(400, "Invalid review requirement.");
    if (user.role !== "soc_manager" || task.a !== user.id) return err(403, "Review settings can only be changed on your own SOC Manager tasks.");
    if (!isOpenStatus(task.status) || task.status === "review") return err(409, "Review settings cannot change while the task is in review or closed.");
    if (body.reviewRequired !== task.reviewRequired) {
      patch.reviewRequired = body.reviewRequired ? 1 : 0;
      events.push(body.reviewRequired ? "enabled manager review" : "disabled manager review for their own task");
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
    // Never carry a self-review exemption onto a different assignee.
    if (assignee.id !== user.id || user.role !== "soc_manager") patch.reviewRequired = 1;
    events.push(`reassigned to ${assignee.name}`);
  }
  const updated = updateTask(id, patch, user.id);
  events.forEach((e) => addEvent(id, user.id, e));
  return Response.json({ task: updated, details: getTaskDetails(id), transitions: allowedTransitions(user, updated) });
}

const isOpenStatus = (s) => s !== "done" && s !== "cancelled";
