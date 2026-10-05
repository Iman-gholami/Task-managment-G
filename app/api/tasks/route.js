import { requireUser } from "@/lib/server/auth";
import { listVisibleTasks } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { canAssignTask } from "@/lib/roles";
import { addEvent, createTask, getUser } from "@/lib/server/repo";

const PRIOS = ["low", "normal", "high", "critical"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  return Response.json({ tasks: listVisibleTasks(user) });
}

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return Response.json({ error: "Title is required." }, { status: 400 });
  const assignee = getUser(body.a);
  if (!assignee || !assignee.active) return Response.json({ error: "Assignee not found." }, { status: 400 });
  if (!canAssignTask(user, assignee)) return Response.json({ error: "You can't assign a task to this member." }, { status: 403 });

  const start = DATE.test(body.start ?? "") ? body.start : null;
  const task = createTask({
    title,
    description: String(body.description ?? ""),
    a: assignee.id,
    prio: PRIOS.includes(body.prio) ? body.prio : "normal",
    cx: [1, 2, 3, 4].includes(body.cx) ? body.cx : 2,
    due: DATE.test(body.due ?? "") ? body.due : "—",
  }, user.id);

  if (start) {
    db.prepare("UPDATE tasks SET started_at = ? WHERE id = ?").run(`${start} 00:00:00`, task.id);
  }

  addEvent(task.id, user.id, "created the task");
  return Response.json({ task }, { status: 201 });
}
