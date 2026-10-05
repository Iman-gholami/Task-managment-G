import "server-only";
import { canAccessTask } from "@/lib/roles";
import { getTask } from "@/lib/server/repo";

const err = (status, error) => Response.json({ error }, { status });
export { err };

/**
 * Loads a task and verifies that the current user may see it.
 * Return 404 for unauthorized task IDs so callers cannot enumerate other users' tasks.
 */
export function viewableTask(user, id) {
  const task = getTask(id);
  if (!task || !canAccessTask(user, task)) return [null, err(404, "Task not found.")];
  return [task, null];
}

/**
 * Task mutations use the same ownership/scope boundary as task visibility.
 * Fine-grained workflow/manager checks are applied by the individual route afterwards.
 */
export function editableTask(user, id) {
  return viewableTask(user, id);
}
