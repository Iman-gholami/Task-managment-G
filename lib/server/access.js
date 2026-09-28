import "server-only";
import { isManager } from "@/lib/roles";
import { getTask } from "@/lib/server/repo";

const err = (status, error) => Response.json({ error }, { status });
export { err };

/** Loads a task and checks that `user` may edit its details (assignee or manager). */
export function editableTask(user, id) {
  const task = getTask(id);
  if (!task) return [null, err(404, "Task not found.")];
  if (task.a !== user.id && !isManager(user)) return [null, err(403, "Only the assignee or a manager can change this task.")];
  return [task, null];
}
