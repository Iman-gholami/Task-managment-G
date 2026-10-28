"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useApp } from "@/components/AppProvider";
import Dialog from "@/components/ui/Dialog";
import { Field, FormAlert } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import { actionLabel } from "@/lib/workflow";

// Hours are the total for this task, not an increment or a running timer.
export function parseTaskHours(value) {
  const normalized = String(value).trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[٫,]/g, ".");
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) && result >= 0 && result <= 1000 ? result : null;
}

export function TaskFlowStep({ number, title, note, active, done, onOpen, children }) {
  return (
    <li className={`task-flow-step ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}>
      <span className="task-flow-node" aria-hidden="true">{done ? <Icon name="check" size="sm" /> : number}</span>
      <div className="task-flow-card">
        {onOpen ? (
          <button type="button" className="task-flow-heading" aria-expanded={active} onClick={onOpen}>
            <span>{title}</span><span className="task-flow-note">{note}</span>
          </button>
        ) : <div className="task-flow-heading"><span>{title}</span><span className="task-flow-note">{note}</span></div>}
        {active && children && <div className="task-flow-body">{children}</div>}
      </div>
    </li>
  );
}

export function TaskReportSummary({ task, details, attachments }) {
  const report = details.report;
  const hasReport = report.workPerformed || report.outcome || report.hoursRecorded;
  return (
    <div className="task-report-summary">
      {!hasReport && <p className="muted small">No structured report was recorded for this task. See the conversation and attachments for earlier work.</p>}
      <dl className="task-report-facts">
        <div><dt>Work performed</dt><dd dir="auto">{report.workPerformed || "Not recorded"}</dd></div>
        <div><dt>Outcome</dt><dd dir="auto">{report.outcome || "Not recorded"}</dd></div>
        <div><dt>Total time</dt><dd>{report.hoursRecorded ? `${task.hours} hrs` : task.hours ? `${task.hours} hrs (existing total)` : "Not recorded"}</dd></div>
      </dl>
      {attachments}
    </div>
  );
}

export default function TaskWorkPanel({ task, details, transitions, onMove, setData, commentDraftRef, editingCommentRef, posting, uploading, attachments, onShowComments }) {
  const { dispatch } = useApp();
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
  const saved = useRef({ work: initial.workPerformed, outcome: initial.outcome, hours: initialHours, revision: initial.revision });
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
    const warn = (event) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = ""; } };
    const interceptLink = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          anchor.hasAttribute("download") || anchor.target === "_blank" || anchor.getAttribute("href").startsWith("#")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.href === window.location.href) return;
      event.preventDefault(); event.stopPropagation(); setLeaveTarget(target.href);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", interceptLink, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", interceptLink, true); };
  }, [dirty, editable]);

  const sync = (result, preserveDraft = false) => {
    dispatch({ type: "task/update", id: task.id, patch: result.task });
    setData((current) => current ? { ...current, details: result.details, transitions: result.transitions } : current);
    const report = result.details.report;
    const nextHours = report.hoursRecorded ? String(result.task.hours) : "";
    saved.current = { work: report.workPerformed, outcome: report.outcome, hours: nextHours, revision: report.revision };
    if (!preserveDraft) { setWork(report.workPerformed); setOutcome(report.outcome); setHours(nextHours); }
  };

  const payload = (status) => {
    const body = { report: { workPerformed: work, outcome, revision: saved.current.revision, clearHours: !hours.trim() } };
    if (hours.trim()) body.hours = parsedHours;
    if (status) body.status = status;
    return body;
  };

  const validateHours = () => {
    if (hours.trim() && parsedHours === null) {
      setStage("hours"); setInvalidField("hours"); setError("Enter total hours from 0 to 1000, using a number such as 1.5.");
      window.setTimeout(() => hoursRef.current?.focus(), 0); return false;
    }
    return true;
  };
  const validateHandover = () => {
    if (!work.trim()) { setStage("work"); setInvalidField("work"); setError("Describe the work performed before sending."); window.setTimeout(() => workRef.current?.focus(), 0); return false; }
    if (!outcome.trim()) { setStage("outcome"); setInvalidField("outcome"); setError("Add the outcome before sending."); window.setTimeout(() => outcomeRef.current?.focus(), 0); return false; }
    if (!hours.trim() || parsedHours === null) { setStage("hours"); setInvalidField("hours"); setError("Enter total hours from 0 to 1000, using a number such as 1.5."); window.setTimeout(() => hoursRef.current?.focus(), 0); return false; }
    setInvalidField(""); setError(""); return true;
  };

  const commit = async (body, nextStage) => {
    if (busy || uncertain || pending.current) return;
    setBusy(true); setInvalidField(""); setError(""); setMessage("");
    pending.current = { body, nextStage };
    try {
      const result = await api(`/api/tasks/${task.id}`, { method: "PATCH", body });
      sync(result); pending.current = null; setConflict(null);
      if (nextStage) setStage(nextStage);
      setMessage(body.status ? "Task sent successfully." : "Draft saved");
    } catch (failure) {
      if (failure.kind === "network" || failure.status >= 500 || failure.status === 409) {
        setUncertain(true);
        setError(failure.status === 409 ? failure.message : "We couldn't confirm the change. Check the current task before trying again.");
      } else { pending.current = null; setError(failure.message); }
    } finally { setBusy(false); }
  };
  const saveDraft = (nextStage) => {
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
      const matches = desired && report.workPerformed === desired.body.report.workPerformed.trim() &&
        report.outcome === desired.body.report.outcome.trim() &&
        (desired.body.report.clearHours ? !report.hoursRecorded : report.hoursRecorded && result.task.hours === desired.body.hours) &&
        (!desired.body.status || result.task.status === desired.body.status);
      sync(result, !matches);
      setUncertain(false); pending.current = null;
      if (matches) {
        setConflict(null);
        if (desired.nextStage) setStage(desired.nextStage);
        setError(""); setMessage(desired.body.status ? "Task sent successfully." : "Draft saved");
      } else {
        setConflict({ report, hours: result.task.hours });
        setError("The task was checked. Your draft was not saved; compare it with the saved report before trying again.");
      }
    } catch { setError("The task could not be checked yet. Check your connection and try again."); }
    finally { setBusy(false); }
  };
  const draftComment = Boolean(commentDraftRef.current.trim() || editingCommentRef.current);
  const disabled = busy || uncertain || posting || uploading;
  const canStart = transitions.includes("progress");
  const finalStatus = task.reviewRequired ? "review" : "done";

  if (task.status === "review") return (
    <section className="task-flow-section" aria-label="Your work">
      <div className="task-flow-intro"><div><span className="eyebrow">YOUR WORK</span><h2>Waiting for review</h2><p>Your report has been sent to a manager.</p></div></div>
      <TaskReportSummary task={task} details={details} attachments={attachments} />
    </section>
  );
  if (task.status === "cancelled") return null;

  return (
    <section className="task-flow-section" aria-label="Your work">
      <div className="task-flow-intro"><div><span className="eyebrow">YOUR WORK</span><h2>{working ? "Your task journey" : task.status === "returned" ? "Changes requested" : task.status === "blocked" ? "Work is blocked" : "Ready to start"}</h2><p>{working ? "Complete your report one step at a time. Save a draft whenever you need to pause." : "Review the task brief and supporting information."}</p></div></div>
      {showReturn && <div className="task-review-feedback" role="status"><strong>Manager feedback</strong><p dir="auto">{latestReturn.reason}</p></div>}
      {!working && canStart && <div className="task-flow-start"><button type="button" className="btn btn-primary" disabled={disabled} onClick={(event) => onMove(event.currentTarget, "progress")}>{actionLabel(task.status, "progress")}<Icon name="arrowRight" size="sm" /></button></div>}
      {working && <>
        <ol className="task-flow-list">
          <TaskFlowStep number={1} title="Task started" note="Brief above" done />
          <TaskFlowStep number={2} title="Work performed" note="Required" active={stage === "work"} onOpen={() => setStage("work")}>
            <Field label={<>What did you do? <span className="required-mark">*</span></>} htmlFor="task-report-work" hint="Describe the actions you took." error={invalidField === "work" ? error : null}>
              <textarea ref={workRef} id="task-report-work" className="textarea" dir="auto" maxLength={10000} required value={work} disabled={disabled} onChange={(event) => { setWork(event.target.value); setInvalidField(""); setError(""); setMessage(""); }} />
            </Field>
            <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => saveDraft()}>Save draft</button><button type="button" className="btn btn-primary" disabled={disabled} onClick={() => saveDraft("outcome")}>Continue<Icon name="arrowRight" size="sm" /></button></div>
          </TaskFlowStep>
          <TaskFlowStep number={3} title="Outcome & evidence" note="Result required · File optional" active={stage === "outcome"} onOpen={() => setStage("outcome")}>
            <Field label={<>What was the outcome? <span className="required-mark">*</span></>} htmlFor="task-report-outcome" hint="Summarize the result of your work." error={invalidField === "outcome" ? error : null}>
              <textarea ref={outcomeRef} id="task-report-outcome" className="textarea" dir="auto" maxLength={10000} required value={outcome} disabled={disabled} onChange={(event) => { setOutcome(event.target.value); setInvalidField(""); setError(""); setMessage(""); }} />
            </Field>
            {attachments}
            <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => setStage("work")}>Back</button><button type="button" className="btn btn-primary" disabled={disabled} onClick={() => saveDraft("hours")}>Continue<Icon name="arrowRight" size="sm" /></button></div>
          </TaskFlowStep>
          <TaskFlowStep number={4} title="Time spent" note="Enter total hours manually" active={stage === "hours"} onOpen={() => setStage("hours")}>
            <Field label={<>Total hours <span className="required-mark">*</span></>} htmlFor="task-report-hours" hint="Total time spent on this task · 1.5 = 1 hour 30 minutes." error={invalidField === "hours" ? error : null}>
              <input ref={hoursRef} id="task-report-hours" className="input task-hours-input" type="text" inputMode="decimal" required value={hours} disabled={disabled} onChange={(event) => { setHours(event.target.value); setInvalidField(""); setError(""); setMessage(""); }} />
            </Field>
            <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => saveDraft()}>Save draft</button><button type="button" className="btn btn-primary" disabled={disabled} onClick={() => { if (validateHandover()) saveDraft("handover"); }}>Review submission<Icon name="arrowRight" size="sm" /></button></div>
          </TaskFlowStep>
          <TaskFlowStep number={5} title={task.reviewRequired ? "Review & submit" : "Review & complete"} note="Check your handover" active={stage === "handover"} onOpen={() => { if (validateHandover()) setStage("handover"); }}>
            <dl className="task-report-facts"><div><dt>Work performed</dt><dd dir="auto">{work}</dd></div><div><dt>Outcome</dt><dd dir="auto">{outcome}</dd></div><div><dt>Total time</dt><dd>{parsedHours} hrs</dd></div><div><dt>Attachments</dt><dd>{details.attachments.length}</dd></div><div><dt>Checklist</dt><dd>{details.checklist.filter((item) => item.done).length} / {details.checklist.length}</dd></div></dl>
            {draftComment && <div className="handoff-warning"><Icon name="alert" /><div><strong>Unposted comment</strong><p>Your comment has not been posted and will not be included.</p><button type="button" className="btn btn-ghost btn-sm" onClick={onShowComments}>Back to comment</button></div></div>}
            <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => setStage("hours")}>Back</button><button type="button" className="btn btn-primary" disabled={disabled} aria-busy={busy} onClick={() => { if (validateHandover()) commit(payload(finalStatus)); }}>{task.reviewRequired ? "Submit for review" : "Complete task"}</button></div>
          </TaskFlowStep>
          {task.reviewRequired && <TaskFlowStep number={6} title="Manager review" note="After submission" />}
          <TaskFlowStep number={task.reviewRequired ? 7 : 6} title="Complete" note={task.reviewRequired ? "After approval" : "After completion"} />
        </ol>
        {error && !invalidField && <div className="task-flow-error"><FormAlert>{error}</FormAlert>{uncertain && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={checkCurrent}>Check task</button>}</div>}
        {conflict && <details className="task-extra task-conflict" open><summary><span>Current saved report</span><span>Your draft is still editable</span></summary><div className="task-extra-body"><dl className="task-report-facts"><div><dt>Work performed</dt><dd dir="auto">{conflict.report.workPerformed || "Not recorded"}</dd></div><div><dt>Outcome</dt><dd dir="auto">{conflict.report.outcome || "Not recorded"}</dd></div><div><dt>Total time</dt><dd>{conflict.report.hoursRecorded || conflict.hours ? `${conflict.hours} hrs` : "Not recorded"}</dd></div></dl></div></details>}
        <p className="task-flow-status" role="status">{message || (dirty ? "Unsaved changes" : saved.current.revision ? "All changes saved" : "No draft saved yet")}</p>
      </>}
      {leaveTarget && <Dialog label="Unsaved work report" title="Leave without saving?" description="Your latest report changes have not been saved." onClose={() => setLeaveTarget(null)} width={440}>
        <div className="modal-foot"><button type="button" className="btn btn-secondary" onClick={() => setLeaveTarget(null)}>Keep editing</button><button type="button" className="btn btn-danger" onClick={() => {
          allowLeave.current = true;
          const target = new URL(leaveTarget);
          if (target.origin === window.location.origin) router.push(`${target.pathname}${target.search}${target.hash}`);
          else window.location.assign(target.href);
        }}>Leave without saving</button></div>
      </Dialog>}
    </section>
  );
}
