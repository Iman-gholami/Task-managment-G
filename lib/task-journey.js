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

// Where a task stands, derived only from what is stored: the status and the saved work report.
// Shared by the task page's progress ring, its step rail and its lifecycle strip.

const NOT_STARTED = ["backlog", "todo"];
const SUBMITTED = ["review", "done"];
const blank = (value) => !String(value ?? "").trim();

/** The five report steps, each done only when its part is saved (unsaved typing never counts). */
export function reportProgress(task, details) {
  const report = details?.report ?? {};
  const started = !NOT_STARTED.includes(task.status);
  const submitted = SUBMITTED.includes(task.status);
  // Older tasks submitted before structured reports existed keep their gaps visible.
  const steps = [
    { key: "start", label: "Task started", done: started },
    { key: "work", label: "Work performed", done: !blank(report.workPerformed) },
    { key: "outcome", label: "Outcome & evidence", done: !blank(report.outcome) },
    { key: "hours", label: "Time spent", done: !!report.hoursRecorded },
    { key: "submit", label: task.reviewRequired === false ? "Review & complete" : "Review & submit", done: submitted },
  ];
  const done = steps.filter((step) => step.done).length;
  return { steps, done, total: steps.length, percent: Math.round((done / steps.length) * 100), next: steps.find((step) => !step.done) ?? null };
}

/** Assigned → Work → Manager review (when required) → Complete, each done, current or upcoming. */
export function taskLifecycle(task) {
  if (task.status === "cancelled") return [];
  const stages = [
    { key: "assigned", label: "Assigned" },
    { key: "work", label: "Work" },
    ...(task.reviewRequired !== false || task.status === "review" ? [{ key: "review", label: "Manager review" }] : []),
    { key: "complete", label: "Complete" },
  ];
  const current = NOT_STARTED.includes(task.status) ? "assigned"
    : task.status === "review" ? "review"
    : task.status === "done" ? null
    : "work";
  const at = current ? stages.findIndex((stage) => stage.key === current) : stages.length;
  return stages.map((stage, index) => ({ ...stage, state: index < at ? "done" : index === at ? "current" : "upcoming" }));
}
