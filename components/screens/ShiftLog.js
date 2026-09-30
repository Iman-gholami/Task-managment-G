"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useFetch from "@/components/useFetch";
import PeriodSelector from "@/components/PeriodSelector";
import { api, useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { FieldError } from "@/components/ui/Field";
import { PageHeader, Panel } from "@/components/ui/layout";
import { EmptyState, ErrorState, Loading } from "@/components/ui/states";
import { Meter } from "@/components/ui/charts";
import { Status, Who } from "@/components/ui/indicators";
import { TODAY, fmtDate, fmtRange, longDate, plural, weekday } from "@/lib/format";

const HINTS = { misp: "The IOC count feeds monthly reports", report: "Prepare and share the daily traffic report" };
const SAVE_LABEL = { saved: "Autosaved", saving: "Saving…", failed: "Not saved — try again" };

/** Today's Shift Log for a SOC analyst: routine activities, IOC count, issues and tickets. Autosaves. */
export default function ShiftLog() {
  const { dispatch, toast, me, activities, tickets, shiftDone, shiftDate } = useApp();
  const [saved, setSaved] = useState("saved");
  const [issueOpen, setIssueOpen] = useState(null);
  const [flash, setFlash] = useState(null);
  const done = activities.filter((a) => a.done).length;
  const pct = activities.length ? Math.round((done / activities.length) * 100) : 0;
  const misp = activities.find((a) => a.kind === "misp");
  const issues = activities.filter((a) => a.issue).length;
  const remaining = activities.filter((a) => !a.done);
  const readOnly = shiftDone;

  const update = async (n, patch) => {
    dispatch({ type: "activity/update", n, patch });
    setSaved("saving");
    try {
      await api("/api/shift", { method: "PATCH", body: { n, patch } });
      setSaved("saved");
    } catch (e) {
      setSaved("failed");
      toast(e.message, "error");
    }
  };
  const setCompleted = async (completed) => {
    try {
      await api("/api/shift", { method: "PATCH", body: { completed } });
      dispatch({ type: "shift/complete", value: completed });
      toast(completed ? "Shift completed" : "Shift reopened — you can edit it again");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const completeShift = () => {
    if (remaining.length) {
      const first = remaining[0];
      document.getElementById(`act-${first.n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(first.n);
      setTimeout(() => setFlash(null), 1400);
      toast(`Finish ${plural(remaining.length, "remaining activity", "remaining activities")} before completing the shift.`, "info");
      return;
    }
    setCompleted(true);
  };

  return (
    <div className="page mid shift-page">
      <PageHeader
        title={`Shift Log — ${longDate(shiftDate)}`}
        meta={[weekday(shiftDate), readOnly ? "Completed — reopen to make changes" : "Changes save automatically"]}
        actions={<Link className="btn btn-secondary" href="/shift/history"><Icon name="clock" />History</Link>}
      />

      <div className="panel" style={{ marginBottom: "var(--s-4)" }}>
        <div className="shift-head">
          <div className="ring" style={{ "--v": pct }} role="img" aria-label={`${pct}% complete`} />
          <dl className="facts">
            <div><dt><small>Analyst</small></dt><dd><Who id={me.id} /></dd></div>
            <div><dt><small>Status</small></dt><dd>{shiftDone ? <span className="badge dot success">Completed</span> : done ? <span className="badge dot info">In progress</span> : <span className="badge dot">Not started</span>}</dd></div>
            <div><dt><small>Completion</small></dt><dd className="num">{done} of {activities.length} · {pct}%</dd></div>
            <div><dt><small>Last change</small></dt><dd className="num" style={saved === "failed" ? { color: "var(--danger)" } : undefined} aria-live="polite">{SAVE_LABEL[saved]}</dd></div>
          </dl>
        </div>
      </div>

      <Panel title="Routine activities" meta={`${done} of ${activities.length} done`}>
        {activities.map((a) => {
          const hint = a.kind === "monitor" ? (a.issue ? "Completed with an issue" : "Mark it completed when nothing unusual was found") : HINTS[a.kind];
          return (
            <div key={a.n} id={`act-${a.n}`} className={`act ${a.done ? "done" : ""} ${flash === a.n ? "flash" : ""}`}>
              <div className="act-row">
                <span className="n">{a.n}</span>
                <input type="checkbox" className="cb" checked={a.done} disabled={readOnly} onChange={() => update(a.n, { done: !a.done })} aria-label={`${a.title} done`} />
                <div className="t">{a.title}{hint && <small>{hint}</small>}</div>
                <div className="act-tools">
                  {a.kind === "monitor" && !a.issue && !readOnly && (
                    <button type="button" className="btn btn-ghost btn-sm" aria-expanded={issueOpen === a.n} onClick={() => setIssueOpen(issueOpen === a.n ? null : a.n)}><Icon name="alert" />Report an issue</button>
                  )}
                  <button type="button" className={`toggle-done ${a.done ? "on" : ""}`} disabled={readOnly} aria-pressed={a.done} onClick={() => update(a.n, { done: !a.done })}>
                    <Icon name="check" />{a.kind === "monitor" && !a.issue ? "Completed — no issue" : a.done ? "Done" : "Mark done"}
                  </button>
                </div>
              </div>

              {a.kind === "misp" && (
                <div className="act-extra">
                  <div className="line">
                    <label htmlFor="ioc" className="sec small">IOC count</label>
                    <span className="stepper">
                      <button type="button" aria-label="Decrease IOC count" disabled={readOnly} onClick={() => update(a.n, { iocs: Math.max(0, a.iocs - 1) })}>−</button>
                      <input id="ioc" aria-label="IOC count" inputMode="numeric" value={a.iocs} readOnly={readOnly}
                        onChange={(e) => update(a.n, { iocs: Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)) })}
                        onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); update(a.n, { iocs: a.iocs + 1 }); } if (e.key === "ArrowDown") { e.preventDefault(); update(a.n, { iocs: Math.max(0, a.iocs - 1) }); } }} />
                      <button type="button" aria-label="Increase IOC count" disabled={readOnly} onClick={() => update(a.n, { iocs: a.iocs + 1 })}>+</button>
                    </span>
                    <label className="toggle-label">
                      <input type="checkbox" role="switch" className="switch" checked={a.bale} disabled={readOnly} onChange={(e) => update(a.n, { bale: e.target.checked })} />Shared via Bale
                    </label>
                    <input className="input input-sm mono" placeholder="MISP event ID" value={a.mispRef} readOnly={readOnly} onChange={(e) => update(a.n, { mispRef: e.target.value })} aria-label="MISP event reference" />
                  </div>
                </div>
              )}

              {a.issue && (
                <div className="act-extra">
                  <div className="issue">
                    <div className="head"><Icon name="alert" />Issue reported: {a.issue.summary}</div>
                    {a.issue.description && <div className="sec small">{a.issue.description}</div>}
                    {a.issue.ref && <div className="muted small">Reference <span className="mono" style={{ color: "var(--text-2)" }}>{a.issue.ref}</span></div>}
                  </div>
                </div>
              )}

              {issueOpen === a.n && <IssueForm onCancel={() => setIssueOpen(null)} onSave={(issue) => { update(a.n, { issue, done: true }); setIssueOpen(null); toast("Issue recorded"); }} />}
            </div>
          );
        })}
      </Panel>

      <Tickets readOnly={readOnly} list={tickets} />

      <div className="summary" role="region" aria-label="Shift summary">
        <span className="s"><b>{done}/{activities.length}</b>activities</span>
        <span className="s"><b>{misp?.iocs ?? 0}</b>IOCs added</span>
        <span className="s"><b>{tickets.length}</b>{tickets.length === 1 ? "ticket" : "tickets"}</span>
        <span className="s"><b>{issues}</b>{issues === 1 ? "issue" : "issues"}</span>
        <span className="remain" title={remaining.map((r) => r.title).join("\n")}>
          {!shiftDone && remaining.length > 0 && `${remaining.length} remaining · next: ${remaining[0].title}`}
        </span>
        {shiftDone
          ? <button type="button" className="btn btn-secondary" onClick={() => setCompleted(false)}>Reopen</button>
          : <button type="button" className="btn btn-primary" onClick={completeShift}>Complete shift</button>}
      </div>
    </div>
  );
}

function IssueForm({ onSave, onCancel }) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [ref, setRef] = useState("");
  const [error, setError] = useState(false);
  const save = () => (summary.trim() ? onSave({ summary: summary.trim(), description, ref }) : setError(true));
  return (
    <div className="act-extra">
      <div className="issue-form">
        <input className="input" placeholder="What went wrong? e.g. login page returned 502" autoFocus value={summary} onChange={(e) => { setSummary(e.target.value); setError(false); }} aria-label="Issue summary" aria-invalid={error || undefined} aria-describedby={error ? "issue-error" : undefined} />
        {error && <FieldError id="issue-error">Add a short summary of the issue.</FieldError>}
        <textarea className="textarea" placeholder="Details (optional)" aria-label="Issue details" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="line">
          <input className="input input-sm mono" style={{ width: 220 }} placeholder="External reference (optional)" aria-label="External reference" value={ref} onChange={(e) => setRef(e.target.value)} />
          <span className="spacer" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>Save issue</button>
        </div>
      </div>
    </div>
  );
}

function Tickets({ readOnly, list: tickets }) {
  const { dispatch, toast } = useApp();
  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState({ no: "", ref: "", desc: "" });
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const numberRef = useRef(null);

  const save = async () => {
    if (!row.no.trim()) { setError(true); numberRef.current?.focus(); return; }
    setBusy(true);
    try {
      const res = await api("/api/shift/tickets", { method: "POST", body: row });
      dispatch({ type: "tickets/set", tickets: res.tickets });
    } catch (e) {
      toast(e.message, "error");
      return;
    } finally {
      setBusy(false);
    }
    toast(`Ticket ${row.no.trim()} added`);
    setRow({ no: "", ref: "", desc: "" });
    setAdding(false);
  };
  const cancel = () => { setAdding(false); setError(false); setRow({ no: "", ref: "", desc: "" }); };
  const onKey = (e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { e.stopPropagation(); cancel(); } };

  return (
    <Panel
      title="Created tickets"
      meta={<span data-testid="ticket-count">{plural(tickets.length, "ticket")}</span>}
      actions={!readOnly && !adding && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setAdding(true); setError(false); }}><Icon name="plus" />Add ticket</button>}
      style={{ marginTop: "var(--s-4)" }}
    >
      {tickets.length === 0 && !adding ? (
        <p className="panel-body muted small">No tickets registered today.{readOnly ? "" : " Add each ticket you create so it counts in reports."}</p>
      ) : (
        <div role="table" aria-label="Tickets">
          <div className="ticket head" role="row"><span role="columnheader">Ticket number</span><span role="columnheader">Related reference</span><span role="columnheader">Description</span></div>
          {tickets.map((tk) => (
            <div key={tk.no} className="ticket" role="row">
              <span className="mono" role="cell" style={{ color: "var(--text)" }}>{tk.no}</span>
              <span className="mono sec" role="cell">{tk.ref || "—"}</span>
              <span className="sec" role="cell">{tk.desc || "—"}</span>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <div className="ticket edit" onKeyDown={onKey}>
          <input ref={numberRef} autoFocus className="input mono" placeholder="INC-2026-…" value={row.no} onChange={(e) => { setRow({ ...row, no: e.target.value }); setError(false); }} aria-label="Ticket number" aria-invalid={error || undefined} aria-describedby={error ? "ticket-error" : undefined} />
          <input className="input mono" placeholder="Reference (optional)" value={row.ref} onChange={(e) => setRow({ ...row, ref: e.target.value })} aria-label="Related reference" />
          <input className="input" placeholder="Short description" value={row.desc} onChange={(e) => setRow({ ...row, desc: e.target.value })} aria-label="Description" />
          <span className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy} aria-busy={busy}>Save</button>
          </span>
          {error && <span style={{ gridColumn: "1 / -1" }}><FieldError id="ticket-error">Ticket number is required.</FieldError></span>}
        </div>
      )}
    </Panel>
  );
}

/** The analyst's own shift logs for a period. Today's log opens the editable Shift Log. */
export function ShiftHistory() {
  const { me } = useApp();
  const router = useRouter();
  const [period, setPeriod] = useState("this");
  const { data, loading, error, reload } = useFetch(`/api/shift/history?user=${me.id}&period=${period}`);

  return (
    <div className="page">
      <PageHeader
        title="Shift Log history"
        meta={[me.name, data ? fmtRange(data.period.from, data.period.to) : null]}
        actions={<Link className="btn btn-primary" href="/shift">Open today&apos;s log</Link>}
      />
      <div className="page-toolbar"><PeriodSelector value={period} onChange={setPeriod} /></div>
      <div className="panel">
        {loading && !data ? <Loading label="Loading shift logs" rows={8} /> : error ? (
          <ErrorState error={error} title="Couldn't load shift logs" onRetry={reload} />
        ) : !data?.logs.length ? (
          <EmptyState icon="shift" title="No shift logs in this period" action={<Link className="btn btn-secondary btn-sm" href="/shift">Open today&apos;s log</Link>}>Logs appear here once you record activity. Try another period.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="dt">
              <thead><tr><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Activities</th><th scope="col" className="r">IOCs</th><th scope="col" className="r">Tickets</th><th scope="col" className="r">Issues</th><th scope="col">Traffic report</th></tr></thead>
              <tbody>
                {data.logs.map((r) => {
                  const today = r.date === TODAY;
                  return (
                    <tr key={r.date} className={today ? "is-link" : ""} onClick={() => today && router.push("/shift")}>
                      <td className="title">{today ? <Link href="/shift">Today</Link> : fmtDate(r.date)} <span className="muted" style={{ fontWeight: 400 }}>· {weekday(r.date)}</span></td>
                      <td>{r.completed ? <Status s="done" label="Completed" /> : today ? <Status s="progress" label="In progress" /> : <Status s="returned" label="Incomplete" />}</td>
                      <td><Meter value={r.done} max={r.total} label={`Activities done on ${fmtDate(r.date)}`} tone="ok" readout={`${r.done}/${r.total}`} /></td>
                      <td className="r">{r.iocs}</td>
                      <td className="r">{r.tickets || <span className="zero">0</span>}</td>
                      <td className="r">{r.issues || <span className="zero">0</span>}</td>
                      <td>{r.report ? <span className="sec">Done</span> : <span className="muted">Not done</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
