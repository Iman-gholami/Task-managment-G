"use client";

import { useI18n } from "@/components/I18nProvider";
import { useId } from "react";
import Icon from "@/components/ui/Icon";
import { taskWhen } from "@/lib/task-date";
import { eligibleReviewers, taskLifecycle } from "@/lib/task-journey";
import { useApp } from "@/components/AppProvider";
const RING = 2 * Math.PI * 42;
const firstName = name => String(name ?? "").split(" ")[0] || "the assignee";

/** A ring that fills with the share of report steps already saved. */
export function ProgressRing({
  progress
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  const gradient = useId();
  return <div className="task-ring">
      <svg viewBox="0 0 100 100" role="img" aria-label={locale === "fa" ? `گزارش ${number(progress.percent)} درصد تکمیل شده، ${number(progress.done)} از ${number(progress.total)} مرحله` : `Report ${progress.percent}% complete, ${progress.done} of ${progress.total} steps`}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--primary)" /><stop offset="1" stopColor="var(--accent)" /></linearGradient></defs>
        <circle className="task-ring-track" cx="50" cy="50" r="42" />
        {progress.percent > 0 && <circle className="task-ring-fill" cx="50" cy="50" r="42" stroke={`url(#${gradient})`} strokeDasharray={`${progress.percent / 100 * RING} ${RING}`} transform="rotate(-90 50 50)" />}
      </svg>
      <span className="task-ring-value" aria-hidden="true">{number(progress.percent)}{locale === "fa" ? "٪" : "%"}</span>
    </div>;
}

/** Where the task stands for the person looking at it: their own progress, a review turn, or the assignee's progress. */
export function TaskProgressPanel({
  task,
  progress,
  isAssignee,
  canReview,
  assigneeName
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  const { users, me } = useApp();
  const reviewers = task.status === "review" ? eligibleReviewers(task, users) : [];
  if (task.status === "done" || task.status === "cancelled") return null;
  if (task.status === "review" && (isAssignee || canReview)) {
    const mine = isAssignee;
    return <section className={`task-progress ${mine ? "is-sent" : "is-turn"}`} aria-label={__taskTr("Task progress")}>
        <span className="task-progress-mark" aria-hidden="true"><Icon name={mine ? "check" : "eye"} /></span>
        <div>
          <span className="task-progress-label">{mine ? __taskTr("Submitted") : __taskTr("Your turn")}</span>
          <strong>{mine ? __taskTr("Sent to your manager") : __taskTr("Ready for your review")}</strong>
          <span className="task-progress-next">{mine ? __taskTr("Your report is with the reviewer.") : locale === "fa" ? `${assigneeName} گزارش کار را ارسال کرد.` : `${assigneeName} sent the work report.`}</span>
          <span className="task-progress-next">{__taskTr("Manager review")} · {__taskTr("Who can review")}: {reviewers.length ? reviewers.map(user => user.id === me.id ? __taskTr("You") : user.name).join(locale === "fa" ? "، " : ", ") : __taskTr("No eligible active manager")}</span>
          <span className="task-progress-next">{__taskTr("Any eligible manager can review; no individual is assigned.")}</span>
        </div>
      </section>;
  }
  const notStarted = progress.next?.key === "start";
  const next = task.status === "blocked" ? __taskTr("Work is blocked") : task.status === "returned" ? __taskTr("Next: update and resubmit") : notStarted ? __taskTr(isAssignee ? "Next: start the task" : "Not started yet") : progress.next ? `${locale === "fa" ? "بعدی" : "Next"}: ${__taskTr(progress.next.label)}` : "";
  return <section className="task-progress" aria-label={__taskTr("Task progress")}>
      <ProgressRing progress={progress} />
      <div>
        <span className="task-progress-label">{isAssignee ? __taskTr("Your progress") : locale === "fa" ? `پیشرفت ${assigneeName}` : `${assigneeName}'s progress`}</span>
        <strong>{isAssignee && notStarted ? __taskTr("Ready to start") : locale === "fa" ? `${number(progress.done)} از ${number(progress.total)} مرحله انجام شد` : `${progress.done} of ${progress.total} steps done`}</strong>
        {next && <span className="task-progress-next">{next}</span>}
      </div>
    </section>;
}
function stageNote(stage, {
  task,
  details,
  isAssignee,
  canReview,
  assigneeName,
  creatorName,
  reviewerName
}, locale, tr) {
  const {
    key,
    state
  } = stage;
  if (key === "assigned") {
    if (state === "current") return isAssignee ? tr("Waiting for you to start") : locale === "fa" ? `منتظر شروع کار توسط ${firstName(assigneeName)}` : `Waiting for ${firstName(assigneeName)} to start`;
    return creatorName ? locale === "fa" ? `توسط ${creatorName}` : `by ${creatorName}` : tr("Assigned");
  }
  if (key === "work") {
    if (state === "upcoming") return tr("Not started");
    if (state === "current") return task.status === "blocked" ? tr("Blocked") : task.status === "returned" ? tr("Changes requested") : details?.startedAt ? `${locale === "fa" ? "از" : "Since"} ${taskWhen(details.startedAt, locale)}` : tr("In progress");
    return details?.startedAt ? `${locale === "fa" ? "شروع" : "Started"} ${taskWhen(details.startedAt, locale)}` : tr("Done");
  }
  if (key === "review") {
    if (state === "current") return tr(canReview ? "Waiting for you" : "With the reviewer");
    if (state === "done") return reviewerName ? `${tr("Approved by")} ${reviewerName}` : tr("Reviewed");
    return tr(isAssignee ? "After you submit" : "After submission");
  }
  if (state === "done") return details?.completedAt ? taskWhen(details.completedAt, locale) : tr("Closed");
  return tr(task.reviewRequired === false ? "After completion" : "After approval");
}

/** Assigned → Work → Manager review → Complete, with the current stage marked. */
export function TaskLifecycle(props) {
  const {
    t: __taskTr, locale
  } = useI18n();
  const stages = taskLifecycle(props.task);
  if (!stages.length) return null;
  return <ol className="task-lifecycle" aria-label={__taskTr("Task lifecycle")}>
      {stages.map(stage => <li key={stage.key} className={`task-stage is-${stage.state}`} aria-current={stage.state === "current" ? "step" : undefined}>
          <span className="task-stage-track" aria-hidden="true">
            <span className="task-stage-node">{stage.state === "done" && <Icon name="check" size="sm" />}</span>
            <span className="task-stage-line" />
          </span>
          <span className="task-stage-text">
            <strong>{__taskTr(stage.label)}</strong>
            <span>{stageNote(stage, props, locale, __taskTr)}</span>
            {stage.state === "done" && <span className="sr-only">{__taskTr("Completed")}</span>}
          </span>
        </li>)}
    </ol>;
}

/** One card in the task's "At a glance" sidebar. */
export function SideCard({
  icon,
  title,
  meta,
  actions,
  children,
  className = ""
}) {
  const {
    t: __taskTr
  } = useI18n();
  const heading = useId();
  return <section className={`side-card ${className}`} aria-labelledby={heading}>
      <div className="side-card-head">
        {icon && <Icon name={icon} />}
        <h3 id={heading}>{title}</h3>
        {meta != null && <span className="side-card-meta">{meta}</span>}
        {actions}
      </div>
      {children}
    </section>;
}
