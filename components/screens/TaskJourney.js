"use client";

import { useI18n as useTaskI18n } from "@/components/I18nProvider";

import { useApp } from "@/components/AppProvider";
import { eligibleReviewers, taskJourney } from "@/lib/task-journey";

const LABELS = { assigned: "Assigned", working: "Work", review: "Manager review", done: "Complete" };

export default function TaskJourney({ task, canReview }) {
  const { t: __taskTr, locale } = useTaskI18n();
  const { users, peopleMap, me } = useApp();
  const name = peopleMap[task.a]?.name ?? __taskTr("the assignee");
  const reviewers = eligibleReviewers(task, users);
  const journey = taskJourney(task);
  const descriptions = {
    backlog: locale === "fa" ? `منتظر شروع کار توسط ${name}.` : `Waiting for ${name} to start.`,
    todo: locale === "fa" ? `منتظر شروع کار توسط ${name}.` : `Waiting for ${name} to start.`,
    progress: locale === "fa" ? `${name} در حال انجام این تسک است.` : `${name} is working on this task.`,
    blocked: locale === "fa" ? `${name} باید پیش از ادامه، مانع را رفع کند.` : `${name} needs to resolve the blocker before continuing.`,
    returned: locale === "fa" ? `درخواست اصلاح ثبت شده است. منتظر اصلاح و ارسال دوباره توسط ${name}.` : `Changes requested. Waiting for ${name} to update and resubmit the work.`,
    review: __taskTr(canReview ? "Your review is needed. Approve the report or return it for changes." : "Waiting for a manager to review the submitted work."),
    done: __taskTr("The task is complete and closed."),
    cancelled: __taskTr("The task was cancelled and is closed."),
  };
  return (
    <section className="task-journey" aria-label={__taskTr("Task progress")}>
      <div className="task-journey-summary">
        <div><span className="eyebrow">{"" + __taskTr("Current stage") + ""}</span><h2>{task.status === "returned" ? __taskTr("Changes requested") : task.status === "blocked" ? __taskTr("Blocked") : task.status === "cancelled" ? __taskTr("Cancelled") : __taskTr(LABELS[journey.steps[journey.current]])}</h2><p>{descriptions[task.status]}</p></div>
        {task.status === "review" && <div className="task-journey-owner"><span>{"" + __taskTr("Who can review") + ""}</span><strong>{reviewers.length ? reviewers.map((user) => user.id === me.id ? __taskTr("You") : user.name).join(locale === "fa" ? "، " : ", ") : __taskTr("No eligible active manager")}</strong><small>{"" + __taskTr("Any eligible manager can review; no individual is assigned.") + ""}</small></div>}
      </div>
      {journey.current !== null && <ol className="task-journey-steps">{journey.steps.map((step, index) => <li key={step} className={index < journey.current ? "is-past" : index === journey.current ? "is-current" : ""} aria-current={index === journey.current ? "step" : undefined}><span aria-hidden="true" /><b>{__taskTr(LABELS[step])}</b></li>)}</ol>}
    </section>
  );
}
