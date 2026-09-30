"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { Who } from "@/components/ui/indicators";
import { PageHeader, Panel } from "@/components/ui/layout";
import { isManager, SOC_TEAMS } from "@/lib/roles";
import { SHIFT_TYPES, tehranDate } from "@/lib/shifts";
import styles from "./ShiftSchedule.module.css";

const OPEN = new Set(["pending_target", "pending_manager"]);
const STATUS_LABEL = {
  pending_target: "Waiting for analyst",
  pending_manager: "Waiting for manager",
  approved: "Approved & applied",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default function ShiftChanges() {
  const { me, members, toast } = useApp();
  const manager = isManager(me);
  const analysts = useMemo(() => members.filter((m) => m.active !== false && m.role === "analyst" && SOC_TEAMS.includes(m.team)), [members]);
  const targets = analysts.filter((a) => a.id !== me.id);
  const [form, setForm] = useState({ date: tehranDate(), targetId: targets[0]?.id ?? "", reason: "" });
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useFetch("/api/shift/changes");
  const requests = data?.requests ?? [];

  const submit = async () => {
    if (!form.date || !form.targetId || busy) return;
    setBusy(true);
    try {
      await api("/api/shift/changes", { method: "POST", body: form });
      toast("Shift change request created");
      setForm({ ...form, reason: "" });
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const act = async (id, action) => {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/shift/changes", { method: "PATCH", body: { id, action } });
      toast(action === "approve" ? "Shift change approved and schedule updated" : `Request ${action}ed`);
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Shift Changes"
        meta={[manager ? "Review SOC shift-change requests" : "Request a swap or transfer", "one manager approval is enough"]}
        actions={<Link className="btn btn-secondary" href="/shift/schedule"><Icon name="cal" />Shift schedule</Link>}
      />

      {me.keepsShiftLog && (
        <Panel className={styles.changeForm} title="New request" meta="Choose your scheduled date and the analyst you want to exchange with">
          <div className={styles.changeFields}>
            <label className="field"><span>Shift date</span><input className="input" type="date" value={form.date} min={tehranDate()} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="field"><span>Requested analyst</span><select className="input" value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>{targets.map((a) => <option value={a.id} key={a.id}>{a.name} · {a.team}</option>)}</select></label>
            <label className="field"><span>Reason / note</span><input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Optional context for the analyst and manager" /></label>
            <button className="btn btn-primary" disabled={busy || !form.date || !form.targetId} onClick={submit}><Icon name="plus" />Submit request</button>
          </div>
        </Panel>
      )}

      <Panel className={styles.changeList} title={manager ? "Team requests" : "My requests"} meta={loading ? "Loading…" : `${requests.length} request${requests.length === 1 ? "" : "s"}`}>
        {error && <div style={{ padding: "12px 0", color: "var(--danger)" }}>Could not load requests. <button className="btn btn-ghost btn-sm" onClick={reload}>Retry</button></div>}
        <div className={styles.changeRows}>
          {!loading && !error && requests.length === 0 && <div className={styles.dayEmpty}>No shift change requests yet.</div>}
          {requests.map((r) => (
            <div className={styles.changeRow} key={r.id}>
              <div className={styles.changeMain}>
                <div className={styles.changePeople}>
                  <Who id={r.requesterId} />
                  <span>→</span>
                  <Who id={r.targetId} />
                  <span className={styles.status} data-status={r.status}>{STATUS_LABEL[r.status] || r.status}</span>
                </div>
                <div className={styles.changeMeta}>
                  <span className="num">{r.date}</span>
                  <span>{shiftLabel(r.requesterShift)}</span>
                  <span>·</span>
                  <span>{r.targetShift ? `swap with ${shiftLabel(r.targetShift)}` : "transfer to off-duty analyst"}</span>
                </div>
                {r.reason && <div className={styles.changeReason}>{r.reason}</div>}
              </div>

              <div className={styles.changeActions}>
                {r.status === "pending_target" && me.id === r.targetId && <>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(r.id, "reject")}>Reject</button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(r.id, "accept")}>Accept</button>
                </>}
                {OPEN.has(r.status) && me.id === r.requesterId && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(r.id, "cancel")}>Cancel</button>}
                {manager && OPEN.has(r.status) && <>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(r.id, "reject")}>Reject</button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(r.id, "approve")}>
                    {r.status === "pending_target" ? "Approve on behalf & apply" : "Approve & apply"}
                  </button>
                </>}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function shiftLabel(type) {
  const s = SHIFT_TYPES[type];
  return s ? `${s.label} ${s.start}–${s.end}` : "Off";
}
