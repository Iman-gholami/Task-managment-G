"use client";

import { useI18n } from "@/components/I18nProvider";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useApp } from "@/components/AppProvider";
import Dialog from "@/components/ui/Dialog";
import { Field, FormAlert } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import { taskWhen } from "@/lib/task-date";
import { reportProgress } from "@/lib/task-journey";
import { actionLabel } from "@/lib/workflow";

// Hours are the total for this task, not an increment or a running timer.
export function parseTaskHours(value) {
  const normalized = String(value).trim().replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660)).replace(/[٫,]/g, ".");
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) && result >= 0 && result <= 1000 ? result : null;
}

/** One step of the report rail: done (ticked, with what was saved), active (open) or upcoming. */
export function TaskFlowStep({
  number,
  title,
  note,
  state,
  onOpen,
  preview,
  children
}) {
  const {
    t: __taskTr
  } = useI18n();
  const active = state === "active";
  const done = state === "done";
  const label = <>
    <span className="task-flow-title">{title}</span>
    {done ? <span className="task-flow-done">{__taskTr("Done")}</span> : <span className="task-flow-note">{__taskTr(note)}</span>}
    {done && onOpen && <span className="task-flow-edit"><Icon name="edit" size="sm" />{__taskTr("Edit")}</span>}
  </>;
  return <li className={`task-flow-step is-${state}`} aria-current={active ? "step" : undefined}>
      <span className="task-flow-node" aria-hidden="true">{done ? <Icon name="check" size="sm" /> : number}</span>
      <div className="task-flow-card">
        {onOpen ? <button type="button" className="task-flow-heading" aria-expanded={active} onClick={onOpen}>{label}</button> : <div className="task-flow-heading">{label}</div>}
        {done && <span className="sr-only">{__taskTr("Completed")}</span>}
        {done && preview && <div className="task-flow-preview">{preview}</div>}
        {active && children && <div className="task-flow-body">{children}</div>}
      </div>
    </li>;
}
export function TaskReportSummary({
  task,
  details,
  attachments,
  emptyText
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  const report = details.report;
  const hasReport = report.workPerformed || report.outcome || report.hoursRecorded;
  return <div className="task-report-summary">
      {!hasReport && <p className="muted small">{__taskTr(emptyText ?? "No structured report was recorded for this task. See the conversation and attachments for earlier work.")}</p>}
      <dl className="task-report-facts">
        <div><dt>{__taskTr("Work performed")}</dt><dd dir="auto">{report.workPerformed || __taskTr("Not recorded")}</dd></div>
        <div><dt>{__taskTr("Outcome")}</dt><dd dir="auto">{report.outcome || __taskTr("Not recorded")}</dd></div>
        <div><dt>{__taskTr("Total time")}</dt><dd>{report.hoursRecorded ? `${number(task.hours)} ${__taskTr("hrs")}` : task.hours ? locale === "fa" ? `${number(task.hours)} ساعت (مجموع قبلی)` : `${task.hours} hrs (existing total)` : __taskTr("Not recorded")}</dd></div>
      </dl>
      {attachments}
    </div>;
}
export default function TaskWorkPanel({
  task,
  details,
  transitions,
  onMove,
  setData,
  commentDraftRef,
  editingCommentRef,
  posting,
  uploading,
  attachments,
  onShowComments
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  const {
    dispatch
  } = useApp();
  const router = useRouter();
  const initial = details.report;
  const initialHours = initial.hoursRecorded || task.hours ? String(task.hours) : "";
  const [work, setWork] = useState(initial.workPerformed);
  const [outcome, setOutcome] = useState(initial.outcome);
  const [hours, setHours] = useState(initialHours);
  const [stage, setStage] = useState("work");
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(null);
  const [leaveTarget, setLeaveTarget] = useState(null);
  const saved = useRef({
    work: initial.workPerformed,
    outcome: initial.outcome,
    hours: initialHours,
    revision: initial.revision
  });
  const pending = useRef(null);
  const allowLeave = useRef(false);
  const workRef = useRef(null);
  const outcomeRef = useRef(null);
  const hoursRef = useRef(null);
  const parsedHours = parseTaskHours(hours);
  const editable = ["progress", "blocked", "returned"].includes(task.status);
  const working = task.status === "progress";
  const dirty = work !== saved.current.work || outcome !== saved.current.outcome || hours !== saved.current.hours;
  const latestReturn = details.currentReturn;
  const showReturn = latestReturn && ["returned", "progress", "blocked"].includes(task.status);
  useEffect(() => {
    if (!dirty || !editable) return;
    const warn = event => {
      if (!allowLeave.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const interceptLink = event => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.hasAttribute("download") || anchor.target === "_blank" || anchor.getAttribute("href").startsWith("#")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTarget(target.href);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", interceptLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", interceptLink, true);
    };
  }, [dirty, editable]);
  const sync = (result, preserveDraft = false) => {
    dispatch({
      type: "task/update",
      id: task.id,
      patch: result.task
    });
    setData(current => current ? {
      ...current,
      details: result.details,
      transitions: result.transitions
    } : current);
    const report = result.details.report;
    const nextHours = report.hoursRecorded ? String(result.task.hours) : "";
    saved.current = {
      work: report.workPerformed,
      outcome: report.outcome,
      hours: nextHours,
      revision: report.revision
    };
    if (!preserveDraft) {
      setWork(report.workPerformed);
      setOutcome(report.outcome);
      setHours(nextHours);
    }
  };
  const payload = status => {
    const body = {
      report: {
        workPerformed: work,
        outcome,
        revision: saved.current.revision,
        clearHours: !hours.trim()
      }
    };
    if (hours.trim()) body.hours = parsedHours;
    if (status) body.status = status;
    return body;
  };
  const validateHours = () => {
    if (hours.trim() && parsedHours === null) {
      setStage("hours");
      setInvalidField("hours");
      setError("Enter total hours from 0 to 1000, using a number such as 1.5.");
      window.setTimeout(() => hoursRef.current?.focus(), 0);
      return false;
    }
    return true;
  };
  const validateHandover = () => {
    if (!work.trim()) {
      setStage("work");
      setInvalidField("work");
      setError("Describe the work performed before sending.");
      window.setTimeout(() => workRef.current?.focus(), 0);
      return false;
    }
    if (!outcome.trim()) {
      setStage("outcome");
      setInvalidField("outcome");
      setError("Add the outcome before sending.");
      window.setTimeout(() => outcomeRef.current?.focus(), 0);
      return false;
    }
    if (!hours.trim() || parsedHours === null) {
      setStage("hours");
      setInvalidField("hours");
      setError("Enter total hours from 0 to 1000, using a number such as 1.5.");
      window.setTimeout(() => hoursRef.current?.focus(), 0);
      return false;
    }
    setInvalidField("");
    setError("");
    return true;
  };
  const commit = async (body, nextStage) => {
    if (busy || uncertain || pending.current) return;
    setBusy(true);
    setInvalidField("");
    setError("");
    setMessage("");
    pending.current = {
      body,
      nextStage
    };
    try {
      const result = await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body
      });
      sync(result);
      pending.current = null;
      setConflict(null);
      if (nextStage) setStage(nextStage);
      setMessage(body.status ? "Task sent successfully." : "Draft saved");
    } catch (failure) {
      if (failure.kind === "network" || failure.status >= 500 || failure.status === 409) {
        setUncertain(true);
        setError(failure.status === 409 ? failure.message : "We couldn't confirm the change. Check the current task before trying again.");
      } else {
        pending.current = null;
        setError(failure.message);
      }
    } finally {
      setBusy(false);
    }
  };
  const saveDraft = nextStage => {
    if (!validateHours()) return;
    commit(payload(), nextStage);
  };
  const checkCurrent = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api(`/api/tasks/${task.id}`);
      const desired = pending.current;
      const report = result.details.report;
      const matches = desired && report.workPerformed === desired.body.report.workPerformed.trim() && report.outcome === desired.body.report.outcome.trim() && (desired.body.report.clearHours ? !report.hoursRecorded : report.hoursRecorded && result.task.hours === desired.body.hours) && (!desired.body.status || result.task.status === desired.body.status);
      sync(result, !matches);
      setUncertain(false);
      pending.current = null;
      if (matches) {
        setConflict(null);
        if (desired.nextStage) setStage(desired.nextStage);
        setError("");
        setMessage(desired.body.status ? "Task sent successfully." : "Draft saved");
      } else {
        setConflict({
          report,
          hours: result.task.hours
        });
        setError("The task was checked. Your draft was not saved; compare it with the saved report before trying again.");
      }
    } catch {
      setError("The task could not be checked yet. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  const draftComment = Boolean(commentDraftRef.current.trim() || editingCommentRef.current);
  const disabled = busy || uncertain || posting || uploading;
  const canStart = transitions.includes("progress");
  const finalStatus = task.reviewRequired ? "review" : "done";
  const progress = reportProgress(task, details);
  const isDone = key => progress.steps.find(step => step.key === key).done;
  // The panel calls the final check "handover"; the journey model calls it "submit".
  const stepState = key => working && stage === key ? "active" : isDone(key === "handover" ? "submit" : key) ? "done" : "upcoming";
  // On the final check everything is shown in full, so the rail does not repeat it.
  const showPreview = !(working && stage === "handover");
  const savedReport = details.report;
  const fileCount = details.attachments.length;
  const open = key => working ? () => setStage(key) : undefined;
  const startButton = canStart && <button type="button" className="btn btn-primary" disabled={disabled} onClick={event => onMove(event.currentTarget, "progress")}>{__taskTr(actionLabel(task.status, "progress"))}<Icon name="arrowRight" size="sm" /></button>;
  if (task.status === "review") return <section className="task-flow-section" aria-label={__taskTr("Your work")}>
      <div className="task-flow-intro"><div><span className="eyebrow">{__taskTr("YOUR WORK")}</span><h2>{__taskTr("Waiting for review")}</h2><p>{__taskTr("Your report has been sent to a manager.")}</p></div></div>
      <ul className="task-flow-chips" aria-label={__taskTr("Report steps")}>
        {progress.steps.map(step => <li key={step.key} className={step.done ? "is-done" : ""}>{step.done ? <Icon name="check" size="sm" /> : <span className="task-flow-chip-dot" aria-hidden="true" />}{__taskTr(step.label)}{!step.done && <span className="sr-only">{" " + __taskTr("\xB7 not recorded")}</span>}</li>)}
      </ul>
      <div className="task-card task-card-pad"><TaskReportSummary task={task} details={details} attachments={attachments} /></div>
    </section>;
  if (task.status === "cancelled") return null;
  const notStarted = !isDone("start");
  const heading = working ? "Your task journey" : task.status === "returned" ? "Changes requested" : task.status === "blocked" ? "Work is blocked" : "Ready to start";
  const intro = working ? "Complete each step. Save a draft whenever you need to pause." : task.status === "returned" ? "Read the feedback, then resume work to update your report." : task.status === "blocked" ? "Unblock the task to continue your report." : "Review the brief, then start the task.";
  return <section className="task-flow-section" aria-label={__taskTr("Your work")}>
      <div className="task-flow-intro">
        <div><span className="eyebrow">{__taskTr("YOUR WORK")}</span><h2>{__taskTr(heading)}</h2><p>{__taskTr(intro)}</p></div>
        {working && <p className="task-flow-status" role="status">{__taskTr(message) || (dirty ? __taskTr("Unsaved changes") : saved.current.revision ? __taskTr("All changes saved") : __taskTr("No draft saved yet"))}</p>}
      </div>
      {showReturn && <div className="task-review-feedback" role="status"><strong>{__taskTr("Manager feedback")}</strong><p dir="auto">{latestReturn.reason}</p>{task.status === "returned" && startButton && <div className="task-flow-resume">{startButton}</div>}</div>}
      {task.status === "blocked" && startButton && <div className="task-flow-paused"><span>{__taskTr("Your report is kept while the task is blocked.")}</span>{startButton}</div>}
      {task.status === "returned" && !showReturn && startButton && <div className="task-flow-paused"><span>{__taskTr("Resume work to update your report.")}</span>{startButton}</div>}
      <ol className="task-flow-list" aria-label={__taskTr("Report steps")}>
        {notStarted ? <TaskFlowStep number={1} title={__taskTr("Start the task")} note="First step" state="active">
            <p className="task-flow-lead">{__taskTr("Read the brief and the details on this page. Once you start, the report steps below open one at a time.")}</p>
            {startButton && <div className="task-flow-actions is-start">{startButton}</div>}
          </TaskFlowStep> : <TaskFlowStep number={1} title={__taskTr("Task started")} state="done" preview={details.startedAt ? `${locale === "fa" ? "شروع" : "Started"} ${taskWhen(details.startedAt, locale)}` : null} />}
        <TaskFlowStep number={2} title={__taskTr("Work performed")} note="Required" state={stepState("work")} onOpen={open("work")} preview={showPreview && savedReport.workPerformed && <p dir="auto">{savedReport.workPerformed}</p>}>
          <Field label={<>{__taskTr("What did you do?") + " "}<span className="required-mark">*</span></>} htmlFor="task-report-work" hint={__taskTr("Describe the actions you took.")} error={invalidField === "work" ? __taskTr(error) : null}>
            <textarea ref={workRef} id="task-report-work" className="textarea" dir="auto" maxLength={10000} required value={work} disabled={disabled} onChange={event => {
            setWork(event.target.value);
            setInvalidField("");
            setError("");
            setMessage("");
          }} />
          </Field>
          <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => saveDraft()}>{__taskTr("Save draft")}</button><button type="button" className="btn btn-primary" disabled={disabled} onClick={() => saveDraft("outcome")}>{__taskTr("Continue")}<Icon name="arrowRight" size="sm" /></button></div>
        </TaskFlowStep>
        <TaskFlowStep number={3} title={__taskTr("Outcome & evidence")} note="Result required · File optional" state={stepState("outcome")} onOpen={open("outcome")} preview={showPreview && savedReport.outcome && <><p dir="auto">{savedReport.outcome}</p>{fileCount > 0 && <span className="task-flow-preview-meta"><Icon name="clip" size="sm" />{locale === "fa" ? `${number(fileCount)} فایل پیوست شد` : fileCount === 1 ? "1 file attached" : `${fileCount} files attached`}</span>}</>}>
          <Field label={<>{__taskTr("What was the outcome?") + " "}<span className="required-mark">*</span></>} htmlFor="task-report-outcome" hint={__taskTr("Summarize the result of your work.")} error={invalidField === "outcome" ? __taskTr(error) : null}>
            <textarea ref={outcomeRef} id="task-report-outcome" className="textarea" dir="auto" maxLength={10000} required value={outcome} disabled={disabled} onChange={event => {
            setOutcome(event.target.value);
            setInvalidField("");
            setError("");
            setMessage("");
          }} />
          </Field>
          {attachments}
          <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => setStage("work")}>{__taskTr("Back")}</button><button type="button" className="btn btn-primary" disabled={disabled} onClick={() => saveDraft("hours")}>{__taskTr("Continue")}<Icon name="arrowRight" size="sm" /></button></div>
        </TaskFlowStep>
        <TaskFlowStep number={4} title={__taskTr("Time spent")} note="Enter total hours manually" state={stepState("hours")} onOpen={open("hours")} preview={showPreview && savedReport.hoursRecorded && (locale === "fa" ? `ثبت‌شده: ${number(task.hours)} ساعت` : `Recorded: ${task.hours} hrs`)}>
          <Field label={<>{__taskTr("Total hours") + " "}<span className="required-mark">*</span></>} htmlFor="task-report-hours" hint={__taskTr("Total time spent on this task \xB7 1.5 = 1 hour 30 minutes.")} error={invalidField === "hours" ? __taskTr(error) : null}>
            <input ref={hoursRef} id="task-report-hours" className="input task-hours-input" type="text" inputMode="decimal" required value={hours} disabled={disabled} onChange={event => {
            setHours(event.target.value);
            setInvalidField("");
            setError("");
            setMessage("");
          }} />
          </Field>
          <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => saveDraft()}>{__taskTr("Save draft")}</button><button type="button" className="btn btn-primary" disabled={disabled} onClick={() => {
            if (validateHandover()) saveDraft("handover");
          }}>{__taskTr("Review submission")}<Icon name="arrowRight" size="sm" /></button></div>
        </TaskFlowStep>
        <TaskFlowStep number={5} title={task.reviewRequired ? __taskTr("Review & submit") : __taskTr("Review & complete")} note={task.reviewRequired ? "Check, then send to your manager" : "Check, then complete"} state={stepState("handover")} onOpen={working ? () => {
        if (validateHandover()) setStage("handover");
      } : undefined}>
          <dl className="task-report-facts"><div><dt>{__taskTr("Work performed")}</dt><dd dir="auto">{work}</dd></div><div><dt>{__taskTr("Outcome")}</dt><dd dir="auto">{outcome}</dd></div><div><dt>{__taskTr("Total time")}</dt><dd>{parsedHours}{" " + __taskTr("hrs")}</dd></div><div><dt>{__taskTr("Attachments")}</dt><dd>{details.attachments.length}</dd></div><div><dt>{__taskTr("Checklist")}</dt><dd>{details.checklist.filter(item => item.done).length} / {details.checklist.length}</dd></div></dl>
          {draftComment && <div className="handoff-warning"><Icon name="alert" /><div><strong>{__taskTr("Unposted comment")}</strong><p>{__taskTr("Your comment has not been posted and will not be included.")}</p><button type="button" className="btn btn-ghost btn-sm" onClick={onShowComments}>{__taskTr("Back to comment")}</button></div></div>}
          <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => setStage("hours")}>{__taskTr("Back")}</button><button type="button" className="btn btn-primary" disabled={disabled} aria-busy={busy} onClick={() => {
            if (validateHandover()) commit(payload(finalStatus));
          }}>{task.reviewRequired ? __taskTr("Submit for review") : __taskTr("Complete task")}</button></div>
        </TaskFlowStep>
      </ol>
      {working && error && !invalidField && <div className="task-flow-error"><FormAlert>{__taskTr(error)}</FormAlert>{uncertain && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={checkCurrent}>{__taskTr("Check task")}</button>}</div>}
      {working && conflict && <details className="task-extra task-conflict" open><summary><span>{__taskTr("Current saved report")}</span><span>{__taskTr("Your draft is still editable")}</span></summary><div className="task-extra-body"><dl className="task-report-facts"><div><dt>{__taskTr("Work performed")}</dt><dd dir="auto">{conflict.report.workPerformed || __taskTr("Not recorded")}</dd></div><div><dt>{__taskTr("Outcome")}</dt><dd dir="auto">{conflict.report.outcome || __taskTr("Not recorded")}</dd></div><div><dt>{__taskTr("Total time")}</dt><dd>{conflict.report.hoursRecorded || conflict.hours ? `${number(conflict.hours)} ${__taskTr("hrs")}` : __taskTr("Not recorded")}</dd></div></dl></div></details>}
      {leaveTarget && <Dialog label={__taskTr("Unsaved work report")} title={__taskTr("Leave without saving?")} description={__taskTr("Your latest report changes have not been saved.")} onClose={() => setLeaveTarget(null)} width={440}>
        <div className="modal-foot"><button type="button" className="btn btn-secondary" onClick={() => setLeaveTarget(null)}>{__taskTr("Keep editing")}</button><button type="button" className="btn btn-danger" onClick={() => {
          allowLeave.current = true;
          const target = new URL(leaveTarget);
          if (target.origin === window.location.origin) router.push(`${target.pathname}${target.search}${target.hash}`);else window.location.assign(target.href);
        }}>{__taskTr("Leave without saving")}</button></div>
      </Dialog>}
    </section>;
}
