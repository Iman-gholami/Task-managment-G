"use client";

import { useApp } from "@/components/AppProvider";
import { eligibleReviewers, taskJourney } from "@/lib/task-journey";

const LABELS = { assigned: "Assigned", working: "Work", review: "Manager review", done: "Complete" };

export default function TaskJourney({ task, canReview }) {
  const { users, peopleMap, me } = useApp();
  const name = peopleMap[task.a]?.name ?? "the assignee";
  const reviewers = eligibleReviewers(task, users);
  const journey = taskJourney(task);
  const descriptions = {
    backlog: `Waiting for ${name} to start.`,
    todo: `Waiting for ${name} to start.`,
    progress: `${name} is working on this task.`,
    blocked: `${name} needs to resolve the blocker before continuing.`,
    returned: `Changes requested. Waiting for ${name} to update and resubmit the work.`,
    review: canReview ? "Your review is needed. Approve the report or return it for changes." : "Waiting for a manager to review the submitted work.",
    done: "The task is complete and closed.",
    cancelled: "The task was cancelled and is closed.",
  };
  return (
    <section className="task-journey" aria-label="Task progress">
      <div className="task-journey-summary">
        <div><span className="eyebrow">Current stage</span><h2>{task.status === "returned" ? "Changes requested" : task.status === "blocked" ? "Blocked" : task.status === "cancelled" ? "Cancelled" : LABELS[journey.steps[journey.current]]}</h2><p>{descriptions[task.status]}</p></div>
        {task.status === "review" && <div className="task-journey-owner"><span>Who can review</span><strong>{reviewers.length ? reviewers.map((user) => user.id === me.id ? "You" : user.name).join("، ") : "No eligible active manager"}</strong><small>Any eligible manager can review; no individual is assigned.</small></div>}
      </div>
      {journey.current !== null && <ol className="task-journey-steps">{journey.steps.map((step, index) => <li key={step} className={index < journey.current ? "is-past" : index === journey.current ? "is-current" : ""} aria-current={index === journey.current ? "step" : undefined}><span aria-hidden="true" /><b>{LABELS[step]}</b></li>)}</ol>}
    </section>
  );
}
