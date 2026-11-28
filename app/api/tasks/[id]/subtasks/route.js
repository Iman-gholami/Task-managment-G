import { requireUser } from "@/lib/server/auth";
import { err, canViewTask, viewableTask } from "@/lib/server/access";
import { canAssignTask, canReviewTask } from "@/lib/roles";
import { createSubtask, getUser, listRelatedSubtasks } from "@/lib/server/repo";

const PRIOS = ["low", "normal", "high", "critical"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const related = (user, id) => listRelatedSubtasks(id)
  .filter((task) => canViewTask(user, task))
  .map((task) => ({ ...task, relation: task.parentTaskId === id ? "active" : "promoted" }));

export async function GET(_request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const [, no] = viewableTask(user, id);
  if (no) return no;
  return Response.json({ subtasks: related(user, id) });
}

export async function POST(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const [parent, no] = viewableTask(user, id);
  if (no) return no;
  if (!canReviewTask(user, parent)) return err(403, "Only the responsible manager can create subtasks.");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return err(400, "Invalid subtask details.");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200) return err(400, "Enter a subtask title of up to 200 characters.");
  if (body.description != null && (typeof body.description !== "string" || body.description.length > 10000))
    return err(400, "Description must be at most 10000 characters.");
  if (body.due && (typeof body.due !== "string" || !DATE.test(body.due))) return err(400, "Invalid deadline.");
  if (body.cx != null && ![1, 2, 3, 4].includes(body.cx)) return err(400, "Invalid complexity.");
  if (body.prio != null && !PRIOS.includes(body.prio)) return err(400, "Invalid priority.");
  const assignee = typeof body.a === "string" ? getUser(body.a) : null;
  if (!assignee || !assignee.active) return err(400, "Choose an active assignee.");
  if (!canAssignTask(user, assignee)) return err(403, "You cannot assign this member.");
  try {
    const task = createSubtask(id, {
      title, description: body.description?.trim() ?? "", a: assignee.id,
      prio: body.prio ?? parent.prio, cx: body.cx ?? parent.cx,
      due: body.due ?? (parent.due === "—" ? "—" : parent.due), reviewRequired: true,
    }, user.id);
    return Response.json({ task, subtasks: related(user, id) }, { status: 201 });
  } catch (error) { return err(error.status || 500, error.status ? error.message : "The subtask could not be created."); }
}
