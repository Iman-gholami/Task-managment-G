import { canManageMember } from "@/lib/roles";

/** Review eligibility mirrors the server's task visibility and self-review rules. */
export function eligibleReviewers(task, users) {
  const assignee = users.find((user) => user.id === task.a);
  return users.filter((user) => user.active && user.id !== task.a && (
    user.role === "security_manager" || (user.role === "soc_manager" && assignee?.active && canManageMember(user, assignee))
  ));
}

export function taskJourney(task) {
  const steps = task.reviewRequired || task.status === "review" ? ["assigned", "working", "review", "done"] : ["assigned", "working", "done"];
  if (task.status === "cancelled") return { steps, current: null };
  const stage = ["backlog", "todo"].includes(task.status) ? "assigned"
    : ["progress", "blocked", "returned"].includes(task.status) ? "working"
    : task.status === "review" ? "review" : "done";
  return { steps, current: steps.indexOf(stage) };
}
