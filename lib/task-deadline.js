/** The due date belongs to the assignee until the task is submitted for review. */
export function isTaskPendingSubmission(task) {
  return !!task && !["review", "done", "cancelled"].includes(task.status);
}

/** Pending manager review is not overdue analyst work, even past the original due date. */
export function isTaskOverdue(task, today) {
  return isTaskPendingSubmission(task) && !!task.due && task.due !== "—" && task.due < today;
}
