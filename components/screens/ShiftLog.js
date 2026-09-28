"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useFetch from "@/components/useFetch";
import { PeriodSelector } from "@/components/screens/Dashboard";
import { TableSkeleton } from "@/components/screens/Misc";
import { EmptyState } from "@/components/ui/indicators";
import { isManager } from "@/lib/roles";
import { api, useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { Status, Who } from "@/components/ui/indicators";
import { TODAY, fmtDate, longDate, weekday } from "@/lib/format";

const HINTS = { misp: "IOC count feeds monthly reports", files: "Upload the day's files or link to them", report: "Attach the Word report" };

/** Own shift log (editable), or `view` = another analyst's log shown read-only to a manager. */
export default function ShiftLog({ view }) {
  const app = useApp();
  const { dispatch, toast, me } = app;
  const activities = view ? view.activities : app.activities;
  const tickets = view ? view.tickets : app.tickets;
  const shiftDone = view ? !!view.completedAt : app.shiftDone;
  const shiftDate = view ? view.date : app.shiftDate;
  const owner = view ? view.userId : me.id;
  const [saved, setSaved] = useState("autosaved");
  const [issueOpen, setIssueOpen] = useState(null);
  const [flash, setFlash] = useState(null);
  const done = activities.filter((a) => a.done).length;
  const misp = activities.find((a) => a.kind === "misp");
  const issues = activities.filter((a) => a.issue).length;
  const remaining = activities.filter((a) => !a.done);
  const update = async (n, patch) => {
    dispatch({ type: "activity/update", n, patch });
    setSaved("saving…");
    try {
      await api("/api/shift", { method: "PATCH", body: { n, patch } });
      setSaved("autosaved");
    } catch (e) {
      setSaved("not saved");
      toast(e.message);
    }
  };
  const setCompleted = async (completed) => {
    try {
      await api("/api/shift", { method: "PATCH", body: { completed } });
      dispatch({ type: "shift/complete", value: completed });
      if (completed) toast("Shift completed · summary sent to your manager");
    } catch (e) {
      toast(e.message);
    }
  };
  const readOnly = shiftDone || !!view;

  const completeShift = () => {
    if (remaining.length) {
      const first = remaining[0];
      document.getElementById(`act-${first.n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(first.n);
      setTimeout(() => setFlash(null), 1200);
      return;
    }
    setCompleted(true);
  };

  return (
    <div className="page narrow" style={{ maxWidth: 1080, paddingBottom: 0 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div><h1>Shift Log — {longDate(shiftDate)}</h1></div>
        <div className="actions"><Link className="btn btn-ghost" href="/shift/history">History</Link></div>
      </div>
      <div className="shift-head">
        <div className="ring" style={{ "--v": (done / activities.length) * 100 }} aria-label={`${Math.round((done / activities.length) * 100)}% complete`} />
        <div className="facts">
          <div><small>Analyst</small><Who id={owner} /></div>
          <div><small>Shift</small>Day · 07:00–15:00</div>
          <div><small>Status</small>{shiftDone ? <span className="badge success">Completed</span> : <span className="badge primary">In progress</span>}</div>
          <div><small>Completion</small><span className="num">{Math.round((done / activities.length) * 100)}%</span></div>
          <div><small>Last updated</small><span className="num" style={saved === "not saved" ? { color: "var(--danger)" } : undefined}>{view ? "read-only" : saved}</span></div>
        </div>
      </div>

      <div className="section-head"><h2>Routine activities</h2><span className="meta num">{done} of {activities.length}</span></div>
      {activities.map((a) => {
        const hint = a.kind === "monitor" ? (a.issue ? "Completed with 1 issue" : "Default: completed with no issue") : HINTS[a.kind];
        return (
          <div key={a.n} id={`act-${a.n}`} className={`act ${a.done ? "done" : ""}`} style={flash === a.n ? { background: "var(--warning-soft)", transition: "background .2s" } : undefined}>
            <div className="act-row">
              <span className="n num">{a.n}</span>
              <input type="checkbox" className="cb" checked={a.done} disabled={readOnly} onChange={() => update(a.n, { done: !a.done })} aria-label={`${a.title} done`} />
              <div className="t">{a.title}{hint && <small>{hint}</small>}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {a.kind === "monitor" && !a.issue && !readOnly && <button className="btn btn-ghost btn-sm" onClick={() => setIssueOpen(issueOpen === a.n ? null : a.n)}>Report an issue</button>}
                <button className={`toggle-done ${a.done ? "on" : ""}`} disabled={readOnly} onClick={() => update(a.n, { done: !a.done })}>
                  <Icon name="check" />{a.done ? (a.kind === "monitor" && !a.issue ? "Completed — No Issue" : "Done") : a.kind === "monitor" ? "Completed — No Issue" : "Mark done"}
                </button>
                <button className="btn btn-ghost icon-btn btn-sm" aria-label="Add note"><Icon name="more" /></button>
              </div>
            </div>

            {a.kind === "misp" && (
              <div className="act-extra">
                <div className="line">
                  <span className="sec" style={{ fontSize: 12 }}>IOC count</span>
                  <span className="stepper">
                    <button aria-label="Decrease IOC count" disabled={readOnly} onClick={() => update(a.n, { iocs: Math.max(0, a.iocs - 1) })}>−</button>
                    <input id="ioc" aria-label="IOC count" inputMode="numeric" value={a.iocs} readOnly={readOnly}
                      onChange={(e) => update(a.n, { iocs: Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)) })}
                      onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); update(a.n, { iocs: a.iocs + 1 }); } if (e.key === "ArrowDown") { e.preventDefault(); update(a.n, { iocs: Math.max(0, a.iocs - 1) }); } }} />
                    <button aria-label="Increase IOC count" disabled={readOnly} onClick={() => update(a.n, { iocs: a.iocs + 1 })}>+</button>
                  </span>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }} className="sec">
                    <input type="checkbox" className="switch" checked={a.bale} disabled={readOnly} onChange={(e) => update(a.n, { bale: e.target.checked })} />Shared via Bale
                  </label>
                  <span className="muted" style={{ fontSize: 12 }}>MISP event</span>
                  <input className="input mono" style={{ width: 150, height: 28 }} value={a.mispRef} readOnly={readOnly} onChange={(e) => update(a.n, { mispRef: e.target.value })} aria-label="MISP event reference" />
                </div>
              </div>
            )}

            {a.files && (
              <div className="act-extra">
                <div className="line">
                  {a.files.map(([name, size, ext]) => (
                    <span key={name} className="file"><span className="ext" style={ext === "TXT" ? { background: "var(--neutral)" } : undefined}>{ext}</span><span>{name}<small>{size}</small></span></span>
                  ))}
                  {!readOnly && <button className="btn btn-ghost btn-sm"><Icon name="clip" />{a.kind === "report" ? "Replace report" : "Add file or link"}</button>}
                </div>
              </div>
            )}

            {a.issue && (
              <div className="act-extra">
                <div className="issue">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, color: "var(--text)" }}><span style={{ color: "var(--warning)" }}><Icon name="alert" /></span>Issue reported: {a.issue.summary}</div>
                  {a.issue.description && <div className="sec" style={{ fontSize: 13 }}>{a.issue.description}</div>}
                  {a.issue.ref && <div style={{ fontSize: 12 }} className="muted">Reference <span className="mono" style={{ color: "var(--text-2)" }}>{a.issue.ref}</span></div>}
                </div>
              </div>
            )}

            {issueOpen === a.n && <IssueForm onCancel={() => setIssueOpen(null)} onSave={(issue) => { update(a.n, { issue, done: true }); setIssueOpen(null); toast("Issue recorded"); }} />}
          </div>
        );
      })}

      <Tickets readOnly={readOnly} list={tickets} />

      <div className="summary">
        <span className="s"><b>{done}/{activities.length}</b>Activities</span>
        <span className="s"><b>{misp.iocs}</b>IOCs added</span>
        <span className="s"><b>{tickets.length}</b>Tickets created</span>
        <span className="s"><b>{issues}</b>{issues === 1 ? "Issue reported" : "Issues reported"}</span>
        <span className="remain" title={remaining.map((r) => r.title).join("\n")}>
          {!shiftDone && remaining.length > 0 && `${remaining.length} remaining · next: ${remaining[0].title}`}
        </span>
        {view ? null : shiftDone
          ? <button className="btn btn-secondary" onClick={() => setCompleted(false)}>Reopen</button>
          : <button className="btn btn-primary" onClick={completeShift}>Complete Shift</button>}
      </div>
    </div>
  );
}

function IssueForm({ onSave, onCancel }) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [ref, setRef] = useState("");
  const [error, setError] = useState(false);
  return (
    <div className="act-extra">
      <div className="issue">
        <input className="input" placeholder="Issue summary" autoFocus value={summary} onChange={(e) => { setSummary(e.target.value); setError(false); }} style={error ? { borderColor: "var(--danger)" } : undefined} aria-label="Issue summary" />
        <textarea className="textarea" placeholder="What happened? (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm"><Icon name="clip" />Attachment</button>
          <input className="input mono" style={{ width: 200, height: 28 }} placeholder="External reference" value={ref} onChange={(e) => setRef(e.target.value)} />
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-secondary btn-sm" onClick={() => (summary.trim() ? onSave({ summary: summary.trim(), description, ref }) : setError(true))}>Save issue</button>
        </div>
      </div>
    </div>
  );
}

function Tickets({ readOnly, list }) {
  const { dispatch, toast } = useApp();
  const tickets = list;
  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState({ no: "", ref: "", desc: "" });
  const [error, setError] = useState(false);
  const numberRef = useRef(null);

  const save = async () => {
    if (!row.no.trim()) { setError(true); numberRef.current?.focus(); return; }
    try {
      const res = await api("/api/shift/tickets", { method: "POST", body: row });
      dispatch({ type: "tickets/set", tickets: res.tickets });
    } catch (e) {
      toast(e.message);
      return;
    }
    toast(`Ticket ${row.no.trim()} added`);
    setRow({ no: "", ref: "", desc: "" });
    setAdding(false);
  };
  const onKey = (e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setAdding(false); };

  return (
    <div className="section" style={{ marginTop: 32 }}>
      <div className="section-head">
        <h2>Created Tickets</h2><span className="badge num">Tickets Created: {tickets.length}</span>
        {!readOnly && <div className="right"><button className="btn btn-secondary btn-sm" onClick={() => { setAdding(true); setError(false); }}><Icon name="plus" />Add Ticket</button></div>}
      </div>
      <div className="ticket muted" style={{ height: 28, fontSize: 12 }}><span>Ticket number *</span><span>Related reference</span><span>Description</span><span /></div>
      {tickets.map((tk) => (
        <div key={tk.no} className="ticket">
          <span className="mono" style={{ color: "var(--text)" }}>{tk.no}</span><span className="mono sec">{tk.ref || "—"}</span><span className="sec">{tk.desc || "—"}</span>
          <button className="btn btn-ghost icon-btn btn-sm" aria-label="Open external link"><Icon name="link" /></button>
        </div>
      ))}
      {adding && (
        <div className="ticket" onKeyDown={onKey}>
          <input ref={numberRef} autoFocus className="input mono" placeholder="INC-2026-…" value={row.no} onChange={(e) => { setRow({ ...row, no: e.target.value }); setError(false); }} style={error ? { borderColor: "var(--danger)" } : undefined} aria-label="Ticket number" aria-invalid={error} />
          <input className="input mono" placeholder="Reference" value={row.ref} onChange={(e) => setRow({ ...row, ref: e.target.value })} aria-label="Related reference" />
          <input className="input" placeholder="Short description" value={row.desc} onChange={(e) => setRow({ ...row, desc: e.target.value })} aria-label="Description" />
          <button className="btn btn-secondary btn-sm" onClick={save}>Save</button>
        </div>
      )}
      {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>Ticket number is required.</div>}
    </div>
  );
}

export function ShiftHistory() {
  const { me, members } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const manager = isManager(me);
  const analysts = members.filter((m) => m.shift !== null);
  const user = params.get("user") || (me.keepsShiftLog ? me.id : analysts[0]?.id);
  const [period, setPeriod] = useState("this");
  const { data, loading, error, reload } = useFetch(user ? `/api/shift/history?user=${user}&period=${period}` : null);
  const open = (date) => router.push(user === me.id && date === data.logs[0]?.date && !manager ? "/shift" : `/shift/view?user=${user}&date=${date}`);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Shift Log History</h1><p>{analysts.find((a) => a.id === user)?.name ?? ""}{data ? ` · ${data.period.from} – ${data.period.to}` : ""}</p></div>
        <div className="actions">
          {manager && (
            <select className="input" style={{ width: 200 }} value={user} onChange={(e) => router.replace(`/shift/history?user=${e.target.value}`)} aria-label="Analyst">
              {analysts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>
      {loading && !data ? <TableSkeleton rows={8} /> : error ? (
        <EmptyState danger icon={<Icon name="alert" />} title="Couldn't load shift logs" action={<button className="btn btn-secondary btn-sm" onClick={reload}>Retry</button>}>{error}</EmptyState>
      ) : !data?.logs.length ? (
        <EmptyState icon={<Icon name="shift" />} title="No shift logs">No shift activity was recorded in this period.</EmptyState>
      ) : (
        <table className="dt">
          <thead><tr><th>Date</th><th>Status</th><th>Activities</th><th className="r">IOCs</th><th className="r">Tickets</th><th className="r">Issues</th><th>Traffic report</th></tr></thead>
          <tbody>
            {data.logs.map((r) => (
              <tr key={r.date} onClick={() => open(r.date)}>
                <td className="title num">{fmtDate(r.date)} <span className="muted" style={{ fontWeight: 400 }}>· {weekday(r.date)}</span></td>
                <td>{r.completed ? <Status s="done" label="Completed" /> : r.date === data.logs[0].date && r.date >= TODAY ? <Status s="progress" label="In progress" /> : <Status s="returned" label="Incomplete" />}</td>
                <td><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><span className="progress ok" style={{ width: 80 }}><span style={{ width: `${(r.done / r.total) * 100}%` }} /></span><span className="num">{r.done}/{r.total}</span></span></td>
                <td className="r num">{r.iocs}</td>
                <td className="r num">{r.tickets}</td>
                <td className="r num">{r.issues || <span className="muted">0</span>}</td>
                <td>{r.report ? <span className="sec">Done</span> : <span className="muted">Not done</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Managers: today's shift logs for every SOC analyst. */
export function ShiftTeam() {
  const { members } = useApp();
  const router = useRouter();
  const analysts = members.filter((m) => m.shift !== null);
  const { data } = useFetch(`/api/shift/team`);
  const byId = Object.fromEntries((data?.rows ?? []).map((r) => [r.id, r]));
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Team Shift Logs</h1><p>{longDate(TODAY)} · {analysts.length} SOC analysts</p></div>
        <div className="actions"><Link className="btn btn-secondary" href="/reports/shift">Shift Activity Report</Link></div>
      </div>
      {analysts.length === 0 ? <EmptyState icon={<Icon name="shift" />} title="No SOC analysts">Add analysts to SOC · L1/L2/L3 from the Team page.</EmptyState> : (
        <table className="dt">
          <thead><tr><th>Analyst</th><th>Team</th><th>Today</th><th>Activities</th><th className="r">IOCs</th><th className="r">Tickets</th><th className="r">Issues</th><th /></tr></thead>
          <tbody>
            {analysts.map((a) => {
              const r = byId[a.id];
              return (
                <tr key={a.id} onClick={() => router.push(r ? `/shift/view?user=${a.id}&date=${TODAY}` : `/shift/history?user=${a.id}`)}>
                  <td className="title"><Who id={a.id} /></td>
                  <td>{a.team}</td>
                  <td>{!r ? <span className="badge danger">Not started</span> : r.completed ? <Status s="done" label="Completed" /> : <Status s="progress" label="In progress" />}</td>
                  <td>{r ? <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><span className="progress ok" style={{ width: 80 }}><span style={{ width: `${(r.done / r.total) * 100}%` }} /></span><span className="num">{r.done}/{r.total}</span></span> : <span className="muted">—</span>}</td>
                  <td className="r num">{r?.iocs ?? "—"}</td>
                  <td className="r num">{r?.tickets ?? "—"}</td>
                  <td className="r num">{r?.issues ?? "—"}</td>
                  <td className="r"><Link className="btn btn-ghost btn-sm" href={`/shift/history?user=${a.id}`} onClick={(e) => e.stopPropagation()}>History</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Read-only view of one analyst's log for a given day. */
export function ShiftView() {
  const params = useSearchParams();
  const user = params.get("user");
  const date = params.get("date");
  const { data, error, loading } = useFetch(user ? `/api/shift?user=${user}${date ? `&date=${date}` : ""}` : null);
  if (loading) return <div className="page"><TableSkeleton rows={8} /></div>;
  if (error || !data) return <EmptyState icon={<Icon name="shift" />} title="No shift log" action={<Link className="btn btn-secondary btn-sm" href="/shift/team">Back to team shift logs</Link>}>{error ?? "Nothing recorded."}</EmptyState>;
  return <ShiftLog view={{ ...data, userId: user }} />;
}
