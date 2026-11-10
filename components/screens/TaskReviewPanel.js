"use client";

import { useI18n } from "@/components/I18nProvider";
import { useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { Field, FormAlert } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import { CX, QUAL } from "@/lib/format";

/** One part of the submitted report, ticked when it was provided. */
function ReportRow({
  label,
  provided,
  children
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  return <div className={`task-review-row ${provided ? "is-provided" : "is-missing"}`}>
      <span className="task-review-mark" aria-hidden="true">{provided ? <Icon name="check" size="sm" /> : "–"}</span>
      <dt>{label}</dt>
      <dd>{children}{!provided && <span className="sr-only">{" " + __taskTr("(not provided)")}</span>}</dd>
    </div>;
}
export default function TaskReviewPanel({
  task,
  details,
  setData,
  onApprove,
  approving,
  attachments
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  const {
    dispatch,
    peopleMap
  } = useApp();
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
  const sync = result => {
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
  };
  const sendBack = async () => {
    if (pending.current || uncertain) return;
    if (!reason.trim()) {
      setError("Enter a reason for returning the task.");
      reasonRef.current?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          status: "returned",
          returnReason: reason
        }
      });
      sync(result);
      setReturning(false);
    } catch (failure) {
      if (failure.kind === "network" || failure.status >= 500 || failure.status === 409) {
        setUncertain(true);
        setError(failure.status === 409 ? failure.message : "We couldn't confirm the return. Check the current task before trying again.");
      } else setError(failure.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const checkCurrent = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await api(`/api/tasks/${task.id}`);
      sync(result);
      setUncertain(false);
      if (result.task.status === "returned" && result.details.currentReturn?.reason === reason.trim()) {
        setReturning(false);
        setError("");
      } else setError("The task was checked. Your return was not applied; review its current status before trying again.");
    } catch {
      setError("The task could not be checked yet. Check your connection and try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const approve = () => {
    if (!quality) {
      setError("Choose a quality rating to approve.");
      qualityRef.current?.focus();
      return;
    }
    setError("");
    onApprove(task, quality, complexity);
  };
  const report = details.report;
  const complete = Boolean(report.workPerformed && report.outcome && report.hoursRecorded);
  const locked = busy || uncertain || approving;
  const time = report.hoursRecorded ? `${number(task.hours)} ${__taskTr("hrs")}` : task.hours ? locale === "fa" ? `${number(task.hours)} ساعت (مجموع قبلی)` : `${task.hours} hrs (existing total)` : __taskTr("Not recorded");
  return <div className="task-review">
      <section className="task-card" aria-label={__taskTr("Submitted report")}>
        <div className="task-card-head">
          <div><span className="eyebrow">{__taskTr("Submitted by") + " "}{peopleMap[task.a]?.name ?? __taskTr("the assignee")}</span><h2>{__taskTr("Review the submitted work")}</h2><p>{__taskTr("Read the report, then approve it or request changes.")}</p></div>
          {complete && <span className="task-chip is-ok"><Icon name="check" size="sm" />{__taskTr("All required parts provided")}</span>}
        </div>
        <dl className="task-review-rows">
          <ReportRow label={__taskTr("Work performed")} provided={!!report.workPerformed}><span dir="auto">{report.workPerformed || __taskTr("Not recorded")}</span></ReportRow>
          <ReportRow label={__taskTr("Outcome")} provided={!!report.outcome}><span dir="auto">{report.outcome || __taskTr("Not recorded")}</span></ReportRow>
          <ReportRow label={__taskTr("Total time")} provided={report.hoursRecorded}><span className="num">{time}</span></ReportRow>
        </dl>
        {!complete && <p className="task-card-note">{__taskTr("Parts marked \u2013 were not recorded. Older tasks may not have a structured report; check the conversation and files.")}</p>}
        {attachments && <div className="task-card-section">{attachments}</div>}
      </section>
      <section className="task-card is-focus" aria-label={__taskTr("Your decision")}>
        <div className="task-card-head"><div><span className="eyebrow">{__taskTr("Your decision")}</span><h2>{__taskTr("Approve or request changes")}</h2></div></div>
        <div className="task-card-body">
          <fieldset className="task-quality-field"><legend>{__taskTr("Quality") + " "}<span className="required-mark">*</span> <span className="muted small">{__taskTr("Required for approval")}</span></legend><div className="task-quality-options">
            {Object.entries(QUAL).map(([value, label], index) => <label key={value} className="task-quality-option"><input ref={index === 0 ? qualityRef : null} type="radio" name="task-review-quality" value={value} checked={quality === value} disabled={locked} onChange={() => {
                setQuality(value);
                setError("");
              }} /><span>{__taskTr(label)}</span>{value === "excellent" && <span className="task-quality-star" aria-hidden="true">★</span>}</label>)}
          </div></fieldset>
          <Field label={__taskTr("Confirm complexity")} htmlFor="task-review-complexity">
            <select id="task-review-complexity" className="input task-complexity-input" value={complexity} disabled={locked} onChange={event => setComplexity(Number(event.target.value))}>{CX.slice(1).map((label, index) => <option key={label} value={index + 1}>{__taskTr(label)}</option>)}</select>
          </Field>
          {!returning && <div className="task-flow-actions task-decision-actions"><span className="task-decision-hint">{__taskTr("Approving closes the task. Returning sends it back with your reason.")}</span><button type="button" className="btn btn-secondary" disabled={locked} onClick={() => {
            setReturning(true);
            setError("");
            window.setTimeout(() => reasonRef.current?.focus(), 0);
          }}>{__taskTr("Return for changes")}</button><button type="button" className="btn btn-primary" disabled={locked} aria-busy={approving} onClick={approve}>{approving ? __taskTr("Approving\u2026") : __taskTr("Approve")}</button></div>}
          {returning && <div className="task-return-form">
            <Field label={<>{__taskTr("What needs to change?") + " "}<span className="required-mark">*</span></>} htmlFor="task-return-reason" hint={__taskTr("Explain what the assignee needs to change.")} error={error === "Enter a reason for returning the task." ? __taskTr(error) : null}>
              <textarea ref={reasonRef} id="task-return-reason" className="textarea" dir="auto" value={reason} maxLength={5000} required disabled={busy || uncertain} onChange={event => {
              setReason(event.target.value);
              setError("");
            }} />
            </Field>
            <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={busy || uncertain} onClick={() => {
              setReturning(false);
              setError("");
            }}>{__taskTr("Cancel")}</button><button type="button" className="btn btn-primary" disabled={busy || uncertain} aria-busy={busy} onClick={sendBack}>{busy ? __taskTr("Sending\u2026") : __taskTr("Send back")}</button></div>
          </div>}
          {error && error !== "Enter a reason for returning the task." && <div className="task-flow-error"><FormAlert>{__taskTr(error)}</FormAlert>{uncertain && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={checkCurrent}>{__taskTr("Check task")}</button>}</div>}
        </div>
      </section>
    </div>;
}
