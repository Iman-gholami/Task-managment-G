"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { PageHeader, Panel } from "@/components/ui/layout";
import { EmptyState, Loading } from "@/components/ui/states";
import { longDate, weekday } from "@/lib/format";

export default function ShiftLogManager() {
  const { members, shiftDate, toast } = useApp();
  const analysts = useMemo(() => members.filter((member) => member.shift !== null), [members]);
  const [userId, setUserId] = useState(analysts[0]?.id ?? "");
  const [date, setDate] = useState(shiftDate);
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !date) return;
    setLoading(true);
    setMissing(false);
    try {
      const data = await api(`/api/shift?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`);
      setLog(data);
    } catch (error) {
      setLog(null);
      if (error.status === 404) setMissing(true);
      else toast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [userId, date, toast]);

  useEffect(() => { load(); }, [load]);

  const patchActivity = async (n, patch) => {
    try {
      const result = await api("/api/shift", { method: "PATCH", body: { user: userId, date, n, patch } });
      setLog(result.log);
      toast("Shift log corrected");
      return true;
    } catch (error) {
      toast(error.message, "error");
      return false;
    }
  };

  const complete = async () => {
    try {
      const result = await api("/api/shift", { method: "PATCH", body: { user: userId, date, completed: true } });
      setLog(result);
      toast("Shift log marked completed");
    } catch (error) {
      toast(error.message, "error");
    }
  };

  const person = analysts.find((member) => member.id === userId);
  const done = log?.activities.filter((activity) => activity.done).length ?? 0;
  const allDone = !!log?.activities.length && done === log.activities.length;

  return (
    <div className="page mid shift-page">
      <PageHeader
        title="Shift log corrections"
        meta={["Manager-only", "Submitted analyst logs stay locked after corrections"]}
      />

      <Panel title="Select a log" meta="Managers can correct recorded logs from any date">
        <div className="panel-body row" style={{ gap: "var(--s-3)", flexWrap: "wrap" }}>
          <label className="field" style={{ minWidth: 240 }}>
            <span className="label">Analyst</span>
            <select className="input" value={userId} onChange={(event) => setUserId(event.target.value)} aria-label="Analyst">
              {analysts.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.team}</option>)}
            </select>
          </label>
          <label className="field" style={{ minWidth: 190 }}>
            <span className="label">Shift date</span>
            <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Shift date" />
          </label>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}><Icon name="clock" />Refresh</button>
        </div>
      </Panel>

      {loading ? (
        <div className="panel" style={{ marginTop: "var(--s-4)" }}><Loading label="Loading shift log" rows={6} /></div>
      ) : missing ? (
        <div className="panel" style={{ marginTop: "var(--s-4)" }}>
          <EmptyState compact icon="shift" title="No recorded shift log for this date">
            Viewing a schedule does not create a log. Analysts can record only their own current-day log.
          </EmptyState>
        </div>
      ) : log ? (
        <div className="stack-lg" style={{ marginTop: "var(--s-4)" }}>
          <div className="panel">
            <div className="shift-head">
              <dl className="facts">
                <div><dt><small>Analyst</small></dt><dd>{person?.name ?? userId}</dd></div>
                <div><dt><small>Date</small></dt><dd>{longDate(log.date)} · {weekday(log.date)}</dd></div>
                <div><dt><small>Shift</small></dt><dd>{log.shift?.label ?? log.shiftType}</dd></div>
                <div><dt><small>Status</small></dt><dd>{log.completedAt ? <span className="badge dot success">Submitted & locked</span> : <span className="badge dot info">Incomplete</span>}</dd></div>
                <div><dt><small>Activities</small></dt><dd>{done} of {log.activities.length}</dd></div>
                <div><dt><small>Correction policy</small></dt><dd>Manager-only after submission</dd></div>
              </dl>
            </div>
          </div>

          <Panel
            title="Routine activities"
            meta={log.completedAt ? "Manager corrections do not unlock this log for the analyst" : "You may correct the log and complete it when all activities are done"}
          >
            {log.activities.map((activity) => (
              <ManagerActivity key={activity.n} activity={activity} onPatch={(patch) => patchActivity(activity.n, patch)} />
            ))}
          </Panel>

          <Panel title="Created tickets" meta={`${log.tickets.length} ticket${log.tickets.length === 1 ? "" : "s"}`}>
            {!log.tickets.length ? <p className="panel-body muted small">No tickets were recorded in this shift log.</p> : (
              <div role="table" aria-label="Tickets">
                <div className="ticket head" role="row"><span role="columnheader">Ticket number</span><span role="columnheader">Related reference</span><span role="columnheader">Description</span></div>
                {log.tickets.map((ticket) => (
                  <div className="ticket" role="row" key={`${ticket.no}-${ticket.ref}`}>
                    <span className="mono" role="cell">{ticket.no}</span>
                    <span className="mono sec" role="cell">{ticket.ref || "—"}</span>
                    <span className="sec" role="cell">{ticket.desc || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {!log.completedAt && (
            <div className="summary">
              <span className="remain">Completion is permanent. After submission, only managers can correct fields.</span>
              <button type="button" className="btn btn-primary" onClick={complete} disabled={!allDone}>Mark completed</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ManagerActivity({ activity, onPatch }) {
  const [iocs, setIocs] = useState(activity.iocs ?? 0);
  const [mispRef, setMispRef] = useState(activity.mispRef ?? "");
  const [note, setNote] = useState(activity.note ?? "");

  useEffect(() => {
    setIocs(activity.iocs ?? 0);
    setMispRef(activity.mispRef ?? "");
    setNote(activity.note ?? "");
  }, [activity]);

  return (
    <div className={`act ${activity.done ? "done" : ""}`}>
      <div className="act-row">
        <span className="n">{activity.n}</span>
        <input
          type="checkbox"
          className="cb"
          checked={activity.done}
          onChange={() => onPatch({ done: !activity.done })}
          aria-label={`${activity.title} done`}
        />
        <div className="t">
          {activity.title}
          {activity.issue && <small>Issue: {activity.issue.summary}</small>}
        </div>
        <div className="act-tools">
          <button type="button" className={`toggle-done ${activity.done ? "on" : ""}`} onClick={() => onPatch({ done: !activity.done })}>
            <Icon name="check" />{activity.done ? "Done" : "Mark done"}
          </button>
        </div>
      </div>

      <div className="act-extra">
        <div className="line" style={{ flexWrap: "wrap" }}>
          {activity.kind === "misp" && (
            <>
              <label className="sec small">IOC count</label>
              <input
                className="input input-sm"
                style={{ width: 100 }}
                inputMode="numeric"
                value={iocs}
                onChange={(event) => setIocs(Math.max(0, parseInt(event.target.value.replace(/\D/g, "") || "0", 10)))}
                onBlur={() => Number(iocs) !== Number(activity.iocs ?? 0) && onPatch({ iocs: Number(iocs) })}
                aria-label={`IOC count for activity ${activity.n}`}
              />
              <label className="toggle-label">
                <input type="checkbox" role="switch" className="switch" checked={!!activity.bale} onChange={(event) => onPatch({ bale: event.target.checked })} />Shared via Bale
              </label>
              <input
                className="input input-sm mono"
                style={{ width: 190 }}
                placeholder="MISP event ID"
                value={mispRef}
                onChange={(event) => setMispRef(event.target.value)}
                onBlur={() => mispRef !== (activity.mispRef ?? "") && onPatch({ mispRef })}
                aria-label={`MISP reference for activity ${activity.n}`}
              />
            </>
          )}
          <input
            className="input input-sm"
            style={{ minWidth: 240, flex: 1 }}
            placeholder="Manager correction note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => note !== (activity.note ?? "") && onPatch({ note })}
            aria-label={`Correction note for activity ${activity.n}`}
          />
        </div>
      </div>
    </div>
  );
}
