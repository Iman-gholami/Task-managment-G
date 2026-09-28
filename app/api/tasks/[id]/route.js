import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { addEvent, getTask, getTaskDetails, updateTask } from "@/lib/server/repo";
import { actionLabel, allowedTransitions, canTransition } from "@/lib/workflow";
import { PRIO, QUAL, STATUS } from "@/lib/format";

export async function GET(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const task = getTask(id);
  if (!task) return err(404, "Task not found.");
  return Response.json({ task, details: getTaskDetails(id), transitions: allowedTransitions(user, task) });
}

export async function PATCH(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const task = getTask(id);
  if (!task) return err(404, "Task not found.");
  const mine = task.a === user.id;
  if (!mine && !isManager(user)) return err(403, "You can only edit your own tasks.");

  const body = await request.json().catch(() => ({}));
  const patch = {};
  const events = [];

  if ("status" in body && body.status !== task.status) {
    if (!(body.status in STATUS)) return err(400, "Invalid status.");
    if (!canTransition(user, task, body.status)) {
      return err(409, task.status === "done" ? "This task is already approved. A manager can reopen it." : `You can't move this task from ${STATUS[task.status]} to ${STATUS[body.status]}.`);
    }
    if (task.status === "review" && body.status === "done") {
      if (!(body.quality in QUAL)) return err(400, "Choose a quality rating to approve.");
      patch.quality = body.quality;
    }
    patch.status = body.status;
    const label = actionLabel(task.status, body.status);
    events.push(label ? `${label.toLowerCase()}${patch.quality ? ` · quality: ${QUAL[patch.quality]}` : ""}` : `status → ${STATUS[body.status]}`);
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
  for (const k of ["title", "description"]) {
    if (k in body) {
      const v = String(body[k]).trim();
      if (k === "title" && !v) return err(400, "Title is required.");
      patch[k] = v;
    }
  }
  const updated = updateTask(id, patch);
  events.forEach((e) => addEvent(id, user.id, e));
  return Response.json({ task: updated, details: getTaskDetails(id), transitions: allowedTransitions(user, updated) });
}

const isOpenStatus = (s) => s !== "done" && s !== "cancelled";
