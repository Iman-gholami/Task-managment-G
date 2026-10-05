import "server-only";
import { canManageMember, isManager } from "@/lib/roles";
import { getTask, getUser, listTasks } from "@/lib/server/repo";

const err = (status, error) => Response.json({ error }, { status });
export { err };

/**
 * Server-side task visibility policy, evaluated against the assignee's current
 * role/team so stale task metadata cannot widen access.
 */
export function canViewTask(user, task) {
  if (!user || !task) return false;
  if (user.role === "security_manager") return true;
  if (task.a === user.id) return true;
  if (user.role === "soc_manager") {
    const assignee = getUser(task.a);
    return !!assignee && !!assignee.active && canManageMember(user, assignee);
  }
  return false;
}

/** Returns only tasks the viewer is allowed to know exist. */
export function listVisibleTasks(user) {
  return listTasks().filter((task) => canViewTask(user, task));
}

/**
 * Loads a task and enforces read visibility. Unauthorized task IDs intentionally
 * return 404 so users cannot enumerate tasks outside their scope.
 */
export function viewableTask(user, id) {
  const task = getTask(id);
  if (!task || !canViewTask(user, task)) return [null, err(404, "Task not found.")];
  return [task, null];
}

/**
 * Loads a task and checks that user may modify it. Analysts/engineers may only
 * modify their own tasks; managers may modify tasks visible in their scope.
 */
export function editableTask(user, id) {
  const [task, no] = viewableTask(user, id);
  if (no) return [null, no];
  if (task.a !== user.id && !isManager(user)) {
    return [null, err(403, "Only the assignee or a manager can change this task.")];
  }
  return [task, null];
}
