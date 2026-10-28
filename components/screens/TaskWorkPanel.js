"use client";

import { useEffect, useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import Dialog from "@/components/ui/Dialog";
import Icon from "@/components/ui/Icon";
import { Status } from "@/components/ui/indicators";
import { actionLabel } from "@/lib/workflow";
import { STATUS } from "@/lib/format";

// Hours are the total for this task, not an increment or a running timer.
function parseHours(value) {
  const normalized = String(value).trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[٫,]/g, ".");
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) && result >= 0 && result <= 1000 ? result : null;
}

const WORK_COPY = {
  backlog: ["Ready when you are", "Review the brief and supporting files, then start when work begins."],
  todo: ["Ready when you are", "Review the brief and supporting files, then start when work begins."],
  progress: ["Work in progress", "Record your time and add updates as you work."],
  blocked: ["Work is blocked", "Share what is blocking the task, then resume when you are ready."],
  returned: ["Returned for changes", "Read the reviewer’s comments, then resume work and send it back."],
  review: ["Waiting for review", "Your work has been sent. A manager will review it or request changes."],
  done: ["Work completed", "Your work on this task is complete."],
  cancelled: ["Task cancelled", "This task is closed."],
};

export default function TaskWorkPanel({ task, details, transitions, ready, onMove, setData, commentDraftRef, editingCommentRef, posting }) {
  const { dispatch } = useApp();
  const [hours, setHours] = useState(() => String(task.hours));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(null);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const savedHours = useRef(task.hours);
  const pending = useRef(null);
  const inputRef = useRef(null);
  const parsed = parseHours(hours);
  const dirty = parsed === null || parsed !== task.hours;
  const closed = task.status === "done" || task.status === "cancelled";
  const [heading, description] = WORK_COPY[task.status] || ["Your work", "Keep the task up to date as you work."];

  useEffect(() => {
    if (savedHours.current !== task.hours) {
      const previous = savedHours.current;
      setHours((current) => parseHours(current) === previous ? String(task.hours) : current);
      savedHours.current = task.hours;
    }
  }, [task.hours]);

  useEffect(() => {
    if (!dirty || closed) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, closed]);

  const sync = (result) => {
    dispatch({ type: "task/update", id: task.id, patch: result.task });
    setData((current) => current ? { ...current, details: result.details, transitions: result.transitions } : current);
  };
  const validate = () => {
    if (parsed === null) {
      setError("Enter total hours from 0 to 1000, using a number such as 1.5.");
      inputRef.current?.focus();
      return false;
    }
    setError("");
    return true;
  };
  const commit = async (patch) => {
    if (busy || uncertain) return;
    setBusy(true);
    setError("");
    setMessage("");
    pending.current = patch;
    try {
      const result = await api(`/api/tasks/${task.id}`, { method: "PATCH", body: patch });
      savedHours.current = result.task.hours;
      setHours(String(result.task.hours));
      sync(result);
      pending.current = null;
      if (patch.status) setHandoff(null);
      else setMessage("Hours saved");
    } catch (failure) {
      if (failure.kind === "network" || failure.status >= 500) {
        setUncertain(true);
        setError("We couldn't confirm the change. Check the current task before trying again.");
      } else {
        pending.current = null;
        setError(failure.message);
      }
    } finally { setBusy(false); }
  };
  const checkCurrent = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api(`/api/tasks/${task.id}`);
      const desired = pending.current;
      sync(result);
      setUncertain(false);
      pending.current = null;
      if (desired?.status && result.task.status === desired.status) {
        savedHours.current = result.task.hours;
        setHours(String(result.task.hours));
        setHandoff(null);
        setError("");
        setMessage("The task was updated successfully.");
      } else if (!desired?.status && result.task.hours === desired?.hours) {
        savedHours.current = result.task.hours;
        setHours(String(result.task.hours));
        setError("");
        setMessage("Hours saved");
      } else {
        if (desired?.status && result.task.status !== task.status) setHandoff(null);
        setError("The task was checked. Your change was not applied; review the current status before trying again.");
      }
    } catch {
      setError("The task could not be checked yet. Check your connection and try again.");
    } finally { setBusy(false); }
  };
  const openHandoff = (next) => {
    if (validate()) { setMessage(""); setHandoff(next); }
  };
  const draftComment = Boolean(commentDraftRef.current.trim());
  const draftEdit = Boolean(editingCommentRef.current);
  const focusComment = () => {
    setHandoff(null);
    window.setTimeout(() => document.querySelector(draftEdit ? '.comment-edit textarea' : '#task-comment-input')?.focus(), 0);
  };
  const main = transitions.filter((next) => next !== "blocked" && next !== "cancelled");
  const review = handoff === "review";

  return (
    <section className="work-panel" aria-label="Your work">
      <div className="work-panel-top">
        <div className="work-panel-heading">
          <div><span className="work-panel-kicker">YOUR WORK</span><h2>{heading}</h2><p>{description}</p></div>
        </div>
        <Status s={task.status} />
      </div>
      <div className="work-panel-body">
        <div className="work-hours">
          <div className="work-hours-title">{closed ? "Total hours" : <label htmlFor="task-work-hours">Total hours</label>}</div>
          {!closed ? <div className="work-hours-controls">
            <div className="work-hours-input"><input ref={inputRef} id="task-work-hours" className="input" type="text" inputMode="decimal" value={hours} disabled={busy || uncertain} aria-invalid={!!error && parsed === null || undefined} aria-describedby={error && parsed === null ? "work-hours-hint work-hours-error" : "work-hours-hint"} onChange={(event) => { setHours(event.target.value); setError(""); setMessage(""); }} /><span>hrs</span></div>
            <button type="button" className="btn btn-secondary" disabled={!ready || busy || uncertain || !dirty} aria-busy={busy} onClick={() => { if (validate()) commit({ hours: parsed }); }}>Save hours</button>
            <span className="work-save-status" role="status">{message || (dirty ? "Unsaved" : "Saved")}</span>
          </div> : <strong className="work-closed-hours">{task.hours} hrs recorded</strong>}
          {!closed && <small id="work-hours-hint">Total time spent on this task · 1.5 = 1 hour 30 minutes.</small>}
        </div>
        {main.length > 0 && <div className="work-next">
          <div className="work-next-actions">{main.map((next) => <button key={next} type="button" className={`btn ${next === main[0] ? "btn-primary" : "btn-secondary"}`} disabled={!ready || busy || uncertain || posting} onClick={(event) => task.status === "progress" && (next === "review" || next === "done") ? openHandoff(next) : onMove(event.currentTarget, next)}>{actionLabel(task.status, next) ?? STATUS[next]}<Icon name="arrowRight" size="sm" /></button>)}</div>
        </div>}
      </div>
      {error && !handoff && <div id="work-hours-error" className="work-error" role="alert">{error}{uncertain && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={checkCurrent}>Check task</button>}</div>}
      {handoff && <Dialog label={review ? "Review handover" : "Review completion"} title={review ? "Ready for review?" : "Ready to complete?"} description={review ? "After sending, a manager can approve it or return it for changes." : "Check the work before completing the task; no manager review is required."} onClose={() => { if (!busy) setHandoff(null); }} width={560} dismissible={!busy} className="handoff-dialog" scrimClassName="handoff-scrim">
        <div className="handoff-body">
          <div className="handoff-task"><span className="eyebrow">TASK · {task.id}</span><strong dir="auto">{task.title}</strong></div>
          <dl className="handoff-stats">
            <div><dt>Total hours</dt><dd>{parsed} hrs</dd></div>
            <div><dt>Posted comments</dt><dd>{details?.comments.length ?? 0}</dd></div>
            <div><dt>Files</dt><dd>{details?.attachments.length ?? 0}</dd></div>
            <div><dt>Checklist</dt><dd>{details?.checklist.filter((item) => item.done).length ?? 0} / {details?.checklist.length ?? 0}</dd></div>
          </dl>
          {(draftComment || draftEdit) && <div className="handoff-warning"><Icon name="alert" /><div><strong>Unposted comment</strong><p>{draftEdit ? "Your comment edit has not been saved." : "Your draft comment has not been posted."} It will not be included in this handover.</p><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={focusComment}>Back to comment</button></div></div>}
          {error && <div className="work-error" role="alert">{error}{uncertain && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={checkCurrent}>Check task</button>}</div>}
        </div>
        <div className="modal-foot"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setHandoff(null)}>Back</button><button type="button" className="btn btn-primary" disabled={busy || uncertain} aria-busy={busy} onClick={() => commit({ hours: parsed, status: handoff })}>{busy ? "Sending…" : review ? "Send for review" : "Confirm completion"}</button></div>
      </Dialog>}
    </section>
  );
}
