"use client";

import { useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { Field, FormAlert } from "@/components/ui/Field";
import { TaskFlowStep, TaskReportSummary } from "@/components/screens/TaskWorkPanel";
import { CX, QUAL } from "@/lib/format";

export default function TaskReviewPanel({ task, details, setData, onApprove, approving, attachments }) {
  const { dispatch } = useApp();
  const [quality, setQuality] = useState("");
  const [complexity, setComplexity] = useState(task.cx);
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const reasonRef = useRef(null);
  const qualityRef = useRef(null);
  const sync = (result) => {
    dispatch({ type: "task/update", id: task.id, patch: result.task });
    setData((current) => current ? { ...current, details: result.details, transitions: result.transitions } : current);
  };
  const sendBack = async () => {
    if (pending.current || uncertain) return;
    if (!reason.trim()) { setError("Enter a reason for returning the task."); reasonRef.current?.focus(); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await api(`/api/tasks/${task.id}`, { method: "PATCH", body: { status: "returned", returnReason: reason } });
      sync(result); setReturning(false);
    } catch (failure) {
      if (failure.kind === "network" || failure.status >= 500 || failure.status === 409) {
        setUncertain(true);
        setError(failure.status === 409 ? failure.message : "We couldn't confirm the return. Check the current task before trying again.");
      } else setError(failure.message);
    } finally { pending.current = false; setBusy(false); }
  };
  const checkCurrent = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try {
      const result = await api(`/api/tasks/${task.id}`);
      sync(result); setUncertain(false);
      if (result.task.status === "returned" && result.details.currentReturn?.reason === reason.trim()) { setReturning(false); setError(""); }
      else setError("The task was checked. Your return was not applied; review its current status before trying again.");
    } catch { setError("The task could not be checked yet. Check your connection and try again."); }
    finally { pending.current = false; setBusy(false); }
  };
  const approve = () => {
    if (!quality) { setError("Choose a quality rating to approve."); qualityRef.current?.focus(); return; }
    setError(""); onApprove(task, quality, complexity);
  };
  return (
    <section className="task-flow-section" aria-label="Manager review">
      <div className="task-flow-intro"><div><span className="eyebrow">MANAGER REVIEW</span><h2>Review the submitted work</h2><p>Read the report, then approve it or request changes.</p></div></div>
      <ol className="task-flow-list">
        <TaskFlowStep number={1} title="Task received" note="Brief above" done />
        <TaskFlowStep number={2} title="Work submitted" note="Analyst report" active done>
          <TaskReportSummary task={task} details={details} attachments={attachments} />
        </TaskFlowStep>
        <TaskFlowStep number={3} title="Review work" note="Your decision" active>
          <fieldset className="task-quality-field"><legend>Quality <span className="required-mark">*</span> <span className="muted small">Required for approval</span></legend><div className="task-quality-options">
            {Object.entries(QUAL).map(([value, label], index) => (
              <label key={value} className="task-quality-option"><input ref={index === 0 ? qualityRef : null} type="radio" name="task-review-quality" value={value} checked={quality === value} disabled={busy || uncertain || approving} onChange={() => { setQuality(value); setError(""); }} /><span>{label}</span></label>
            ))}
          </div></fieldset>
          <Field label="Confirm complexity" htmlFor="task-review-complexity">
            <select id="task-review-complexity" className="input task-complexity-input" value={complexity} disabled={busy || uncertain || approving} onChange={(event) => setComplexity(Number(event.target.value))}>{CX.slice(1).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>
          </Field>
          {!returning && <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={busy || uncertain || approving} onClick={() => { setReturning(true); setError(""); window.setTimeout(() => reasonRef.current?.focus(), 0); }}>Return for changes</button><button type="button" className="btn btn-primary" disabled={busy || uncertain || approving} aria-busy={approving} onClick={approve}>{approving ? "Approving…" : "Approve"}</button></div>}
          {returning && <div className="task-return-form">
            <Field label={<>What needs to change? <span className="required-mark">*</span></>} htmlFor="task-return-reason" hint="Explain what the assignee needs to change." error={error === "Enter a reason for returning the task." ? error : null}>
              <textarea ref={reasonRef} id="task-return-reason" className="textarea" dir="auto" value={reason} maxLength={5000} required disabled={busy || uncertain} onChange={(event) => { setReason(event.target.value); setError(""); }} />
            </Field>
            <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={busy || uncertain} onClick={() => { setReturning(false); setError(""); }}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy || uncertain} aria-busy={busy} onClick={sendBack}>{busy ? "Sending…" : "Send back"}</button></div>
          </div>}
          {error && error !== "Enter a reason for returning the task." && <div className="task-flow-error"><FormAlert>{error}</FormAlert>{uncertain && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={checkCurrent}>Check task</button>}</div>}
        </TaskFlowStep>
        <TaskFlowStep number={4} title="Complete" note="After approval" />
      </ol>
    </section>
  );
}
