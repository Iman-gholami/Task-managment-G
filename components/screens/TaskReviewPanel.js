"use client";

import { useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { Field, FormAlert } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import { CX, QUAL } from "@/lib/format";

/** One part of the submitted report, ticked when it was provided. */
function ReportRow({ label, provided, children }) {
  return (
    <div className={`task-review-row ${provided ? "is-provided" : "is-missing"}`}>
      <span className="task-review-mark" aria-hidden="true">{provided ? <Icon name="check" size="sm" /> : "–"}</span>
      <dt>{label}</dt>
      <dd>{children}{!provided && <span className="sr-only"> (not provided)</span>}</dd>
    </div>
  );
}

export default function TaskReviewPanel({ task, details, setData, onApprove, approving, attachments }) {
  const { dispatch, peopleMap } = useApp();
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
  const report = details.report;
  const complete = Boolean(report.workPerformed && report.outcome && report.hoursRecorded);
  const locked = busy || uncertain || approving;
  const time = report.hoursRecorded ? `${task.hours} hrs` : task.hours ? `${task.hours} hrs (existing total)` : "Not recorded";
  return (
    <div className="task-review">
      <section className="task-card" aria-label="Submitted report">
        <div className="task-card-head">
          <div><span className="eyebrow">Submitted by {peopleMap[task.a]?.name ?? "the assignee"}</span><h2>Review the submitted work</h2><p>Read the report, then approve it or request changes.</p></div>
          {complete && <span className="task-chip is-ok"><Icon name="check" size="sm" />All required parts provided</span>}
        </div>
        <dl className="task-review-rows">
          <ReportRow label="Work performed" provided={!!report.workPerformed}><span dir="auto">{report.workPerformed || "Not recorded"}</span></ReportRow>
          <ReportRow label="Outcome" provided={!!report.outcome}><span dir="auto">{report.outcome || "Not recorded"}</span></ReportRow>
          <ReportRow label="Total time" provided={report.hoursRecorded}><span className="num">{time}</span></ReportRow>
        </dl>
        {!complete && <p className="task-card-note">Parts marked – were not recorded. Older tasks may not have a structured report; check the conversation and files.</p>}
        {attachments && <div className="task-card-section">{attachments}</div>}
      </section>
      <section className="task-card is-focus" aria-label="Your decision">
        <div className="task-card-head"><div><span className="eyebrow">Your decision</span><h2>Approve or request changes</h2></div></div>
        <div className="task-card-body">
          <fieldset className="task-quality-field"><legend>Quality <span className="required-mark">*</span> <span className="muted small">Required for approval</span></legend><div className="task-quality-options">
            {Object.entries(QUAL).map(([value, label], index) => (
              <label key={value} className="task-quality-option"><input ref={index === 0 ? qualityRef : null} type="radio" name="task-review-quality" value={value} checked={quality === value} disabled={locked} onChange={() => { setQuality(value); setError(""); }} /><span>{label}</span>{value === "excellent" && <span className="task-quality-star" aria-hidden="true">★</span>}</label>
            ))}
          </div></fieldset>
          <Field label="Confirm complexity" htmlFor="task-review-complexity">
            <select id="task-review-complexity" className="input task-complexity-input" value={complexity} disabled={locked} onChange={(event) => setComplexity(Number(event.target.value))}>{CX.slice(1).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>
          </Field>
          {!returning && <div className="task-flow-actions task-decision-actions"><span className="task-decision-hint">Approving closes the task. Returning sends it back with your reason.</span><button type="button" className="btn btn-secondary" disabled={locked} onClick={() => { setReturning(true); setError(""); window.setTimeout(() => reasonRef.current?.focus(), 0); }}>Return for changes</button><button type="button" className="btn btn-primary" disabled={locked} aria-busy={approving} onClick={approve}>{approving ? "Approving…" : "Approve"}</button></div>}
          {returning && <div className="task-return-form">
            <Field label={<>What needs to change? <span className="required-mark">*</span></>} htmlFor="task-return-reason" hint="Explain what the assignee needs to change." error={error === "Enter a reason for returning the task." ? error : null}>
              <textarea ref={reasonRef} id="task-return-reason" className="textarea" dir="auto" value={reason} maxLength={5000} required disabled={busy || uncertain} onChange={(event) => { setReason(event.target.value); setError(""); }} />
            </Field>
            <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={busy || uncertain} onClick={() => { setReturning(false); setError(""); }}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy || uncertain} aria-busy={busy} onClick={sendBack}>{busy ? "Sending…" : "Send back"}</button></div>
          </div>}
          {error && error !== "Enter a reason for returning the task." && <div className="task-flow-error"><FormAlert>{error}</FormAlert>{uncertain && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={checkCurrent}>Check task</button>}</div>}
        </div>
      </section>
    </div>
  );
}
