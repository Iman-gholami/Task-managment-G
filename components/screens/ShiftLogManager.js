"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { PageHeader, Panel } from "@/components/ui/layout";
import { EmptyState, Loading } from "@/components/ui/states";
import { longDate, weekday } from "@/lib/format";
import { SHIFT_TYPES } from "@/lib/shifts";
import L2AnalyzedTickets from "@/components/screens/L2AnalyzedTickets";
import { ManagerReturnedQueue } from "@/components/screens/dashboard/ReturnedShifts";
import styles from "@/components/screens/ShiftBackfill.module.css";

export default function ShiftLogManager({ initialSelection = {} }) {
  const { members, shiftDate, toast } = useApp();
  const params = useSearchParams();
  const selectedUser = params.get("user") || initialSelection.user || "";
  const selectedDate = params.get("date") || initialSelection.date || "";
  const analysts = useMemo(() => members.filter((member) => member.shift !== null), [members]);
  const [userId, setUserId] = useState(() =>
    analysts.some((person) => person.id === selectedUser) ? selectedUser : analysts[0]?.id ?? "");
  const [date, setDate] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : shiftDate);
  const [showCorrection, setShowCorrection] = useState(() => !!selectedUser && !!selectedDate);
  useEffect(() => {
    // Handle same-page client transitions as well as first SSR navigation.
    if (selectedUser && analysts.some((person) => person.id === selectedUser))
      setUserId(selectedUser);
    if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate))
      setDate(selectedDate);
  }, [selectedUser, selectedDate, analysts]);
  useEffect(() => {
    if (selectedUser && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) setShowCorrection(true);
  }, [selectedUser, selectedDate]);
  const [logData, setLog] = useState(null);
  const [resolvedFor, setResolvedFor] = useState("");
  const [missedDays, setMissedDays] = useState([]);
  const [selectedMissed, setSelectedMissed] = useState([]);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillAction, setBackfillAction] = useState(null);
  const [backfillLoading, setBackfillLoading] = useState(!!userId);
  const [returnedRevision, setReturnedRevision] = useState(0);
  const [backfillReason, setBackfillReason] = useState("");
  const [backfillError, setBackfillError] = useState("");
  const backfillRequests = useRef(0);
  const refreshBackfills = useCallback(async () => {
    const request = ++backfillRequests.current;
    if (!userId) { setMissedDays([]); setBackfillLoading(false); return; }
    setBackfillLoading(true);
    setBackfillError("");
    try {
      const result = await api(`/api/shift/backfill?user=${encodeURIComponent(userId)}`);
      if (request === backfillRequests.current) {
        const days = result.days.filter((day) => !day.completed);
        setMissedDays(days);
        setSelectedMissed((selected) => selected.filter((date) => days.some((day) => day.date === date)));
      }
    } catch (e) {
      if (request === backfillRequests.current) setBackfillError(e.message);
    } finally {
      if (request === backfillRequests.current) setBackfillLoading(false);
    }
  }, [userId]);

  useEffect(() => { setSelectedMissed([]); setMissedDays([]); refreshBackfills(); }, [refreshBackfills]);

  const chooseAnalyst = (nextId) => {
    if (nextId === userId) return;
    backfillRequests.current += 1;
    setBackfillLoading(!!nextId);
    setSelectedMissed([]);
    setMissedDays([]);
    setBackfillError("");
    setBackfillReason("");
    setUserId(nextId);
  };

  const grantBackfills = async (enabled, dates = selectedMissed) => {
    if (!dates.length || backfillBusy) return;
    setBackfillBusy(true); setBackfillAction(enabled ? "return" : "revoke"); setBackfillError("");
    try {
      await api("/api/shift/backfill", { method: "POST",
        body: { userId, dates, enabled, reason: backfillReason.trim() } });
      setSelectedMissed([]);
      await refreshBackfills();
      setReturnedRevision((revision) => revision + 1);
      toast(enabled ? "Shift Logs returned to analyst for completion" : "Returned Shift Log access revoked");
    } catch (e) { setBackfillError(e.message); }
    finally { setBackfillBusy(false); setBackfillAction(null); }
  };
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  // The selection a response belongs to. Answers for an earlier selection are dropped, so the screen never shows
  // one analyst's log while the selection (and therefore any correction) points at another.
  const selection = useRef("");
  selection.current = `${userId}|${date}`;
  const requests = useRef(0);

  const load = useCallback(async () => {
    if (!userId || !date) return;
    const target = `${userId}|${date}`;
    const request = ++requests.current;
    setLoading(true);
    setMissing(false);
    setLog(null);
    try {
      const data = await api(`/api/shift?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`);
      if (request === requests.current && selection.current === target) {
        setResolvedFor(target);
        setLog(data);
      }
    } catch (error) {
      if (request !== requests.current || selection.current !== target) return;
      if (error.status === 404) { setResolvedFor(target); setMissing(true); }
      else toast(error.message, "error");
    } finally {
      if (request === requests.current && selection.current === target) setLoading(false);
    }
  }, [userId, date, toast]);

  useEffect(() => { if (showCorrection) load(); }, [load, showCorrection]);

  const patchActivity = async (activity, patch) => {
    const target = selection.current;
    try {
      const result = await api("/api/shift", { method: "PATCH", body: { user: userId, date, n: activity.n, itemId: activity.itemId ?? null, patch } });
      if (selection.current === target) setLog(result.log);
      toast("Shift log corrected");
      return true;
    } catch (error) {
      if (error.data?.stale && error.data.log && selection.current === target) setLog(error.data.log);
      toast(error.message, error.data?.stale ? "info" : "error");
      return false;
    }
  };

  const complete = async () => {
    const target = selection.current;
    try {
      const result = await api("/api/shift", { method: "PATCH", body: { user: userId, date, completed: true } });
      if (selection.current === target) setLog(result);
      setReturnedRevision((revision) => revision + 1);
      refreshBackfills();
      toast("Shift log marked completed");
    } catch (error) {
      toast(error.message, "error");
    }
  };

  const person = analysts.find((member) => member.id === userId);
  const log = resolvedFor === selection.current ? logData : null;
  const currentMissing = resolvedFor === selection.current && missing;
  const done = log?.activities.filter((activity) => activity.done).length ?? 0;
  const allDone = !!log?.activities.length && done === log.activities.length;

  return (
    <div className={`page mid shift-page ${styles.managerPage}`}>
      <PageHeader
        title="Shift log corrections"
        meta={["Manager-only", "Return missed days or correct a recorded log"]}
      />

      <ManagerReturnedQueue showEmpty refreshKey={returnedRevision} disabled={backfillBusy} onPick={(item) => { chooseAnalyst(item.userId); setDate(item.date); setShowCorrection(true); }} />

      <Panel title="Staff member" meta="Choose whose shift logs you want to manage">
        <div className={`panel-body ${styles.analystPicker}`}>
          <label className="field">
            <span className="label">Analyst</span>
            <select className="input" value={userId} disabled={backfillBusy} onChange={(event) => chooseAnalyst(event.target.value)} aria-label="Analyst">
              {!analysts.length && <option value="">No analysts available</option>}
              {analysts.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.team}</option>)}
            </select>
          </label>
        </div>
      </Panel>

      <Panel title="Return missed Shift Logs" meta={backfillLoading ? "Loading shifts…" : backfillError ? "Couldn't load shifts" : `${missedDays.length} unsubmitted`}>
        <div className={`panel-body ${styles.missedBody}`} aria-busy={backfillLoading}>
          <p className={styles.missedIntro}>Select past scheduled days to return. The analyst can open and complete them from their dashboard.</p>
          {backfillError ? <p className={styles.backfillError} role="alert">{backfillError} <button type="button" className="btn btn-ghost btn-sm" onClick={refreshBackfills}>Retry</button></p> : (
          <div className={styles.missedList}>
            {backfillLoading ? <p className={styles.missedEmpty} role="status">Loading missed shifts…</p> : !userId ? <p className={styles.missedEmpty}>Select an analyst to see missed shifts.</p> :
              !missedDays.length ? <p className={styles.missedEmpty}>No unsubmitted scheduled shifts in the last 120 days.</p> :
              missedDays.map((day) => (
                <label key={day.date} className={styles.missedRow}>
                  <input type="checkbox" className="cb" aria-label={`Select missed shift ${day.date}`}
                    checked={selectedMissed.includes(day.date)}
                    disabled={backfillBusy || (selectedMissed.length >= 31 && !selectedMissed.includes(day.date))}
                    onChange={(e) => setSelectedMissed((prev) =>
                      e.target.checked ? [...prev, day.date] : prev.filter((item) => item !== day.date))} />
                  <span><strong><time dateTime={day.date}>{longDate(day.date)}</time></strong></span>
                  <span className="sec small">{SHIFT_TYPES[day.shiftType]?.label ?? day.shiftType}</span>
                  <span className={`${styles.missedStatus} badge dot ${day.granted ? "info" : ""}`}>
                    {day.granted ? <><span className={styles.statusLong}>Returned · awaiting completion</span><span className={styles.statusShort}>Returned</span></> : day.hasLog ? "Incomplete" : "Not recorded"}
                  </span>
                </label>
              ))}
          </div>
          )}
          {selectedMissed.length === 31 && <p className="muted small">You can select up to 31 shifts at a time.</p>}
          <div className={styles.missedActions}>
            <label className="field">
              <span className="label">Reason <span className="muted">(optional)</span></span>
              <input className="input" maxLength={500} aria-label="Backfill reason (optional)" placeholder="Add a reason" value={backfillReason}
                onChange={(e) => setBackfillReason(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary" disabled={backfillBusy || backfillLoading || !!backfillError || !selectedMissed.length}
              aria-busy={backfillAction === "return"}
              onClick={() => grantBackfills(true)}>
              Return selected days ({selectedMissed.length})
            </button>
            <button type="button" className="btn btn-secondary"
              aria-busy={backfillAction === "revoke"}
              disabled={backfillBusy || backfillLoading || !!backfillError || !selectedMissed.length} onClick={() => grantBackfills(false)}>
              Revoke selected
            </button>
          </div>
        </div>
      </Panel>

      <details id="shift-log-details" className={styles.correction} open={showCorrection} onToggle={(event) => setShowCorrection(event.currentTarget.open)}>
        <summary className={styles.correctionSummary}>
          <span className={styles.queueIcon}><Icon name="edit" /></span>
          <span className={styles.queueHeading}><strong>Review or correct a Shift Log</strong><span>Choose a date to view the recorded log</span></span>
          <span className={styles.queueAction}>Details <Icon name="down" /></span>
        </summary>
        <div className={styles.correctionBody}>
          <div className={styles.correctionControls}>
            <label className="field">
              <span className="label">Shift date</span>
              <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Shift date" />
            </label>
            <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}><Icon name="refresh" />Refresh</button>
          </div>

      {loading ? (
        <div className="panel" style={{ marginTop: "var(--s-4)" }}><Loading label="Loading shift log" rows={6} /></div>
      ) : currentMissing ? (
        <div className="panel" style={{ marginTop: "var(--s-4)" }}>
          <EmptyState compact icon="shift" title="No recorded shift log for this date">
            Viewing a schedule does not create a log. Managers can return past rostered dates so the analyst can enter and complete them.
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
                {log.mode !== "ticket_analysis" && <div><dt><small>Checklist</small></dt><dd dir="auto">{log.checklist ? `${log.checklist.name}${log.checklist.version ? ` · v${log.checklist.version}` : ""}` : "None assigned"}</dd></div>}
                <div><dt><small>Status</small></dt><dd>{log.completedAt ? <span className="badge dot success">Submitted & locked</span> : <span className="badge dot info">Incomplete</span>}</dd></div>
                {log.mode !== "ticket_analysis" && <div><dt><small>Activities</small></dt><dd>{done} of {log.activities.length}</dd></div>}
                <div><dt><small>Correction policy</small></dt><dd>Manager-only after submission</dd></div>
              </dl>
            </div>
          </div>

          {log.mode !== "ticket_analysis" && <Panel
            title={log.mode === "engineering" ? "Engineering daily work" : "SOC shift duties"}
            meta={log.completedAt ? "Manager corrections do not unlock this log for the analyst" : "You may correct the log and complete it when all activities are done"}
          >
            {log.activities.map((activity) => (
              <ManagerActivity key={`${activity.n}-${activity.itemId ?? "built-in"}`} activity={activity} onPatch={(patch) => patchActivity(activity, patch)} />
            ))}
          </Panel>}

          {(log.mode === "ticket_analysis" || (person?.team === "SOC · L2" && log.analyzedTickets?.length > 0)) && (
            <L2AnalyzedTickets key={`${userId}:${date}`} initialItems={log.analyzedTickets ?? []}
              managerTarget={{ user: userId, date }} onChange={(items, stats) =>
                setLog((current) => current && ({ ...current, analyzedTickets: items, analyzedTicketStats: stats }))}
            />
          )}

          {log.mode === "operational" && <Panel title="Created tickets" meta={`${log.tickets.length} ticket${log.tickets.length === 1 ? "" : "s"}`}>
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
          </Panel>}

          {!log.completedAt && (
            <div className="summary">
              <span className="remain">Completion is permanent. After submission, only managers can correct fields.</span>
              <button type="button" className="btn btn-primary" onClick={complete} disabled={log.mode !== "ticket_analysis" && !allDone}>Mark completed</button>
            </div>
          )}
        </div>
      ) : null}
        </div>
      </details>
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
        <div className="t" dir="auto">
          {activity.title}
          {activity.hint && <small>{activity.hint}</small>}
          {activity.issue && <small>Issue: {activity.issue.summary}</small>}
          {activity.correctedAt && <small>Corrected by a manager</small>}
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
