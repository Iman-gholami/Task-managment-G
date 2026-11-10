"use client";

import { useId } from "react";
import Icon from "@/components/ui/Icon";
import { when } from "@/lib/format";
import { taskLifecycle } from "@/lib/task-journey";

const RING = 2 * Math.PI * 42;
const firstName = (name) => String(name ?? "").split(" ")[0] || "the assignee";

/** A ring that fills with the share of report steps already saved. */
export function ProgressRing({ progress }) {
  const gradient = useId();
  return (
    <div className="task-ring">
      <svg viewBox="0 0 100 100" role="img" aria-label={`Report ${progress.percent}% complete, ${progress.done} of ${progress.total} steps`}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--primary)" /><stop offset="1" stopColor="var(--accent)" /></linearGradient></defs>
        <circle className="task-ring-track" cx="50" cy="50" r="42" />
        {progress.percent > 0 && <circle className="task-ring-fill" cx="50" cy="50" r="42" stroke={`url(#${gradient})`} strokeDasharray={`${(progress.percent / 100) * RING} ${RING}`} transform="rotate(-90 50 50)" />}
      </svg>
      <span className="task-ring-value" aria-hidden="true">{progress.percent}%</span>
    </div>
  );
}

/** Where the task stands for the person looking at it: their own progress, a review turn, or the assignee's progress. */
export function TaskProgressPanel({ task, progress, isAssignee, canReview, assigneeName }) {
  if (task.status === "done" || task.status === "cancelled") return null;
  if (task.status === "review" && (isAssignee || canReview)) {
    const mine = isAssignee;
    return (
      <section className={`task-progress ${mine ? "is-sent" : "is-turn"}`} aria-label="Task progress">
        <span className="task-progress-mark" aria-hidden="true"><Icon name={mine ? "check" : "eye"} /></span>
        <div>
          <span className="task-progress-label">{mine ? "Submitted" : "Your turn"}</span>
          <strong>{mine ? "Sent to your manager" : "Ready for your review"}</strong>
          <span className="task-progress-next">{mine ? "Your report is with the reviewer." : `${assigneeName} sent the work report.`}</span>
        </div>
      </section>
    );
  }
  const notStarted = progress.next?.key === "start";
  const next = task.status === "blocked" ? "Work is blocked"
    : task.status === "returned" ? "Next: update and resubmit"
    : notStarted ? (isAssignee ? "Next: start the task" : "Not started yet")
    : progress.next ? `Next: ${progress.next.label}` : "";
  return (
    <section className="task-progress" aria-label="Task progress">
      <ProgressRing progress={progress} />
      <div>
        <span className="task-progress-label">{isAssignee ? "Your progress" : `${assigneeName}'s progress`}</span>
        <strong>{isAssignee && notStarted ? "Ready to start" : `${progress.done} of ${progress.total} steps done`}</strong>
        {next && <span className="task-progress-next">{next}</span>}
      </div>
    </section>
  );
}

function stageNote(stage, { task, details, isAssignee, canReview, assigneeName, creatorName, reviewerName }) {
  const { key, state } = stage;
  if (key === "assigned") {
    if (state === "current") return isAssignee ? "Waiting for you to start" : `Waiting for ${firstName(assigneeName)} to start`;
    return creatorName ? `by ${creatorName}` : "Assigned";
  }
  if (key === "work") {
    if (state === "upcoming") return "Not started";
    if (state === "current") return task.status === "blocked" ? "Blocked" : task.status === "returned" ? "Changes requested" : details?.startedAt ? `Since ${when(details.startedAt)}` : "In progress";
    return details?.startedAt ? `Started ${when(details.startedAt)}` : "Done";
  }
  if (key === "review") {
    if (state === "current") return canReview ? "Waiting for you" : "With the reviewer";
    if (state === "done") return reviewerName ? `Approved by ${reviewerName}` : "Reviewed";
    return isAssignee ? "After you submit" : "After submission";
  }
  if (state === "done") return details?.completedAt ? when(details.completedAt) : "Closed";
  return task.reviewRequired === false ? "After completion" : "After approval";
}

/** Assigned → Work → Manager review → Complete, with the current stage marked. */
export function TaskLifecycle(props) {
  const stages = taskLifecycle(props.task);
  if (!stages.length) return null;
  return (
    <ol className="task-lifecycle" aria-label="Task lifecycle">
      {stages.map((stage) => (
        <li key={stage.key} className={`task-stage is-${stage.state}`} aria-current={stage.state === "current" ? "step" : undefined}>
          <span className="task-stage-track" aria-hidden="true">
            <span className="task-stage-node">{stage.state === "done" && <Icon name="check" size="sm" />}</span>
            <span className="task-stage-line" />
          </span>
          <span className="task-stage-text">
            <strong>{stage.label}</strong>
            <span>{stageNote(stage, props)}</span>
            {stage.state === "done" && <span className="sr-only">Completed</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One card in the task's "At a glance" sidebar. */
export function SideCard({ icon, title, meta, actions, children, className = "" }) {
  const heading = useId();
  return (
    <section className={`side-card ${className}`} aria-labelledby={heading}>
      <div className="side-card-head">
        {icon && <Icon name={icon} />}
        <h3 id={heading}>{title}</h3>
        {meta != null && <span className="side-card-meta">{meta}</span>}
        {actions}
      </div>
      {children}
    </section>
  );
}
