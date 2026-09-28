import { isManager, requireUser } from "@/lib/server/auth";
import { getTask, updateTask } from "@/lib/server/repo";

const VALID = {
  status: ["backlog", "todo", "progress", "review", "done", "blocked", "returned", "cancelled"],
  prio: ["low", "normal", "high", "critical"],
  quality: ["excellent", "good", "acceptable", "needs", null],
};

export async function PATCH(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const task = getTask(id);
  if (!task) return Response.json({ error: "Task not found." }, { status: 404 });
  if (!isManager(user) && task.a !== user.id) return Response.json({ error: "You can only edit your own tasks." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const patch = {};
  for (const [k, allowed] of Object.entries(VALID)) {
    if (k in body) {
      if (!allowed.includes(body[k])) return Response.json({ error: `Invalid ${k}.` }, { status: 400 });
      patch[k] = body[k];
    }
  }
  if ("quality" in patch && !isManager(user)) return Response.json({ error: "Only reviewers can set quality." }, { status: 403 });
  if ("hours" in body) {
    const h = Number(body.hours);
    if (!Number.isFinite(h) || h < 0 || h > 1000) return Response.json({ error: "Invalid hours." }, { status: 400 });
    patch.hours = h;
  }
  return Response.json({ task: updateTask(id, patch) });
}
