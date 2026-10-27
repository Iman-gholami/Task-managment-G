// Task workflow. Shared by the API (enforcement) and the UI (which actions to show).
//
//   Backlog → To Do → In Progress → Review → Done (approved, final)
//                          ↑   ↓        ↓
//                        Blocked    Returned → In Progress
//
// Approve / Return are one-time reviewer decisions on a task in Review. Once a
// task is Done or Cancelled it is closed; only a manager can reopen it, and
// reopening is an explicit action (not a status flip).
import { isManager } from "@/lib/roles";

const ASSIGNEE = {
  backlog: ["todo", "progress"],
  todo: ["progress"],
  progress: ["review", "blocked"],
  blocked: ["progress"],
  returned: ["progress"],
  review: [],
  done: [],
  cancelled: [],
};

const MANAGER_EXTRA = {
  backlog: ["cancelled"],
  todo: ["backlog", "cancelled"],
  progress: ["cancelled"],
  blocked: ["cancelled"],
  returned: ["cancelled"],
  review: ["done", "returned"], // approve / return
  done: ["progress"], // reopen
  cancelled: ["todo"], // restore
};

/** Statuses `user` may move `task` to. */
export function allowedTransitions(user, task) {
  const next = new Set();
  if (user?.role === "observer") return [];
  if (task.a === user.id) ASSIGNEE[task.status]?.forEach((s) => next.add(s));
  if (user.role === "soc_manager" && task.a === user.id && task.reviewRequired === false && task.status === "progress") {
    next.add("done"); // explicit self-owned review-exempt task
    next.delete("review");
  }
  if (isManager(user)) MANAGER_EXTRA[task.status]?.forEach((s) => next.add(s));
  // A reviewer may not approve their own work.
  if (task.status === "review" && task.a === user.id) { next.delete("done"); next.delete("returned"); }
  return [...next];
}

export const canTransition = (user, task, to) => allowedTransitions(user, task).includes(to);

/** Human label for the action that moves a task to `to` from its current status. */
export function actionLabel(from, to) {
  if (from === "progress" && to === "done") return "Complete task";
  if (from === "review" && to === "done") return "Approve";
  if (from === "review" && to === "returned") return "Return for changes";
  if (from === "done" && to === "progress") return "Reopen";
  if (from === "cancelled" && to === "todo") return "Restore";
  if (to === "review") return "Submit for review";
  if (to === "progress") return from === "blocked" ? "Unblock" : from === "returned" ? "Resume work" : "Start";
  if (to === "blocked") return "Mark blocked";
  if (to === "cancelled") return "Cancel task";
  return null;
}
