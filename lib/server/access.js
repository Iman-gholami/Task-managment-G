import "server-only";
import { canManageMember, isManager } from "@/lib/roles";
import { getTask, getUser, listTasks } from "@/lib/server/repo";

const err = (status, error) => Response.json({ error }, { status });
export { err };

/**
 * Task visibility policy:
 * - Security Manager: all tasks.
 * - SOC Manager: own tasks plus tasks belonging to SOC analysts they manage.
 * - Everyone else: only their own assigned tasks.
 */
export function canViewTask(user, task) {
  if (!user || !task) return false;
  if (user.role === "security_manager") return true;
  if (task.a === user.id) return true;
  if (user.role === "soc_manager") {
    const assignee = getUser(task.a);
    return !!assignee && canManageMember(user, assignee);
  }
  return false;
}

/** Returns only the tasks the viewer is allowed to know exist. */
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
 * modify their own tasks; managers may modify tasks that are visible in their scope.
 */
export function editableTask(user, id) {
  const [task, no] = viewableTask(user, id);
  if (no) return [null, no];
  if (task.a !== user.id && !isManager(user)) {
    return [null, err(403, "Only the assignee or a manager can change this task.")];
  }
  return [task, null];
}

/** Whether actor may create/reassign a task to target. */
export function canAssignTask(actor, target) {
  if (!actor || !target) return false;
  if (actor.id === target.id) return true;
  if (actor.role === "security_manager") return true;
  if (actor.role === "soc_manager") return canManageMember(actor, target);
  return false;
}
