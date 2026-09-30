"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { EmptyState, Who } from "@/components/ui/indicators";
import { isManager } from "@/lib/roles";
import { SHIFT_TYPES } from "@/lib/shifts";
import { TODAY } from "@/lib/format";

const STATUS = {
  pending_target: ["Waiting for analyst", "warning"],
  pending_manager: ["Waiting for manager", "primary"],
  approved: ["Approved", "success"],
  rejected: ["Rejected", "danger"],
  cancelled: ["Cancelled", ""],
};

export default function ShiftChanges() {
  const { me, members, toast } = useApp();
  const manager = isManager(me);
  const analysts = useMemo(() => members.filter((m) => m.role === "analyst" && m.team.startsWith("SOC · L") && m.id !== me.id), [members, me.id]);
  const [form, setForm] = useState({ date: TODAY, targetId: analysts[0]?.id ?? "", reason: "" });
  const [saving, setSaving] = useState(false);
  const { data, loading, error, reload } = useFetch("/api/shifts/changes");
  const requests = data?.requests ?? [];

  const create = async () => {
    if (!form.date || !form.targetId) return;
    setSaving(true);
    try {
      await api("/api/shifts/changes", { method: "POST", body: form });
      toast("Shift change request sent");
      setForm({ ...form, reason: "" });
      reload();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const act = async (id, action) => {
    setSaving(true);
    try {
      await api("/api/shifts/changes", { method: "PATCH", body: { id, action } });
      toast(action === "approve" ? "Shift change approved and schedule updated" : `Request ${action}ed`);
      reload();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page shift-changes-page">
      <div className="page-head">
        <div><h1>Shift Changes</h1><p>Analyst acceptance + one manager approval. A manager can approve directly when the requested analyst is unavailable.</p></div>
        <div className="actions"><Link className="btn btn-secondary" href="/shifts"><Icon name="cal" />Shift calendar</Link></div>
      </div>

      {!manager && me.keepsShiftLog && (
        <section className="card shift-change-form">
          <div className="section-head"><h2>Request a change</h2><span className="meta">If the target has a shift that day, the two shifts are swapped. If they are off, your shift is transferred to them.</span></div>
          <div className="shift-change-fields">
            <label className="field"><span>Your shift date</span><input type="date" min={TODAY} className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="field"><span>Change with</span><select className="input" value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}><option value="">Choose analyst…</option>{analysts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.team}</option>)}</select></label>
            <label className="field shift-change-reason"><span>Reason (optional)</span><input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. appointment, leave, coverage" /></label>
            <button className="btn btn-primary" disabled={saving || !form.targetId} onClick={create}>Submit request</button>
          </div>
        </section>
      )}

      <section className="card shift-change-list">
        <div className="section-head"><h2>{manager ? "Shift change approvals" : "My shift changes"}</h2><span className="badge num">{requests.filter((r) => r.status.startsWith("pending")).length} pending</span></div>
        {loading && !data ? <p className="muted">Loading requests…</p> : error ? <EmptyState danger icon={<Icon name="alert" />} title="Could not load shift changes" action={<button className="btn btn-secondary btn-sm" onClick={reload}>Retry</button>}>{error}</EmptyState> : requests.length === 0 ? <EmptyState icon={<Icon name="edit" />} title="No shift change requests">Requests will appear here.</EmptyState> : (
          <div className="shift-change-rows">
            {requests.map((r) => <ChangeRow key={r.id} r={r} me={me} manager={manager} saving={saving} act={act} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function ChangeRow({ r, me, manager, saving, act }) {
  const [label, tone] = STATUS[r.status] ?? [r.status, ""];
  const mine = r.requesterId === me.id;
  const targeted = r.targetId === me.id;
  const source = SHIFT_TYPES[r.requesterShift];
  const target = r.targetShift ? SHIFT_TYPES[r.targetShift] : null;
  const open = r.status === "pending_target" || r.status === "pending_manager";
  return (
    <div className="shift-change-row">
      <div className="shift-change-main">
        <div className="shift-change-people"><Who id={r.requesterId} /><span>↔</span><Who id={r.targetId} /></div>
        <div className="shift-change-meta"><b className="num">{r.date}</b><span className={`shift-chip ${source.className}`}>{source.label}</span><span>→</span><span className={`shift-chip ${target?.className ?? "off"}`}>{target ? target.label : "Off"}</span></div>
        {r.reason && <div className="muted shift-change-note">{r.reason}</div>}
      </div>
      <div className="shift-change-actions">
        <span className={`badge ${tone}`}>{label}</span>
        {targeted && r.status === "pending_target" && !manager && <><button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => act(r.id, "accept")}>Accept</button><button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => act(r.id, "reject")}>Reject</button></>}
        {mine && open && !manager && <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => act(r.id, "cancel")}>Cancel</button>}
        {manager && open && <><button className="btn btn-primary btn-sm" disabled={saving} onClick={() => act(r.id, "approve")}>{r.status === "pending_target" ? "Approve on behalf & apply" : "Approve & apply"}</button><button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => act(r.id, "reject")}>Reject</button></>}
      </div>
    </div>
  );
}
