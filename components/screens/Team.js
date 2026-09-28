"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { EmptyState, Status, Who } from "@/components/ui/indicators";
import { ROLE_LABELS, assignableFor, canManageMember } from "@/lib/roles";

export function PeopleTable({ list, onRemove, onEdit }) {
  const router = useRouter();
  const { me } = useApp();
  return (
    <table className="dt">
      <thead><tr><th>Name</th><th>Role</th><th>Primary team</th><th>Workload</th><th className="r">Open tasks</th><th>Shift today</th><th /></tr></thead>
      <tbody>
        {list.map((p) => (
          <tr key={p.id} data-member={p.id} onClick={() => router.push("/performance/employees")}>
            <td className="title"><Who id={p.id} /></td>
            <td>{ROLE_LABELS[p.role] ?? p.role}</td>
            <td>{p.team}{p.assist && <span className="muted"> · assisting {p.assist}</span>}</td>
            <td>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span className="progress" style={{ width: 100 }}><span style={{ width: `${p.load}%`, ...(p.load > 90 ? { background: "var(--warning)" } : {}) }} /></span>
                <span className="num muted">{p.load}%</span>
              </span>
            </td>
            <td className="r num">{p.open}</td>
            <td>
              {p.shift === "missing" ? <span className="badge danger">Not started</span>
                : p.shift === "completed" ? <Status s="done" label="Completed" />
                : p.shift === "active" ? <Status s="progress" label="In progress" />
                : <span className="muted">—</span>}
            </td>
            <td className="r" onClick={(e) => e.stopPropagation()}>
              <span style={{ display: "inline-flex", gap: 4 }}>
                <Link className="btn btn-ghost btn-sm" href="/performance/employees">Performance</Link>
                {onEdit && canManageMember(me, p) && <button className="btn btn-ghost btn-sm" onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`}>Edit</button>}
                {onRemove && canManageMember(me, p) && (
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => onRemove(p)} aria-label={`Remove ${p.name}`}>Remove</button>
                )}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TEAM_FILTERS = ["All", "SOC", "Design & Automation", "Threat Intelligence"];

export default function Team() {
  const { members, me, dispatch, toast } = useApp();
  const [team, setTeam] = useState("All");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const canAdd = assignableFor(me).roles.length > 0;

  const list = members
    .filter((p) => team === "All" || p.team.startsWith(team) || (team === "SOC" && p.assist?.startsWith("SOC")))
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  const confirmRemove = async () => {
    const p = removing;
    try {
      await api(`/api/members/${p.id}`, { method: "DELETE" });
      dispatch({ type: "users/deactivate", id: p.id });
      toast(`${p.name} was removed from the team`);
    } catch (e) {
      toast(e.message);
    }
    setRemoving(null);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Team</h1><p>{members.length} people · Security Department</p></div>
        <div className="actions">
          <div className="seg">{TEAM_FILTERS.map((t) => <button key={t} className={t === team ? "on" : ""} onClick={() => setTeam(t)}>{t}</button>)}</div>
          {canAdd && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" />Add Member</button>}
        </div>
      </div>
      <div className="toolbar">
        <div className="search"><Icon name="search" /><input className="input" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {list.length ? <PeopleTable list={list} onRemove={setRemoving} onEdit={setEditingMember} /> : <EmptyState icon={<Icon name="team" />} title="No people match">Try a different name or team.</EmptyState>}
      {adding && <AddMemberModal onClose={() => setAdding(false)} />}
      {editingMember && <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} />}
      {removing && (
        <Dialog label="Remove member" onClose={() => setRemoving(null)}>
          <div className="modal-body">
            <h3 style={{ margin: "0 0 8px", font: "var(--text-section)" }}>Remove {removing.name}?</h3>
            <p className="sec" style={{ margin: 0 }}>They will lose access immediately. Their tasks, shift logs and tickets are kept for reports.</p>
          </div>
          <div className="modal-foot">
            <span style={{ marginLeft: "auto" }} />
            <button className="btn btn-ghost" onClick={() => setRemoving(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmRemove}>Remove member</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Dialog({ label, onClose, children, width = 480 }) {
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} style={{ width }}>{children}</div>
    </div>
  );
}

function AddMemberModal({ onClose }) {
  const { me, dispatch, toast } = useApp();
  const { roles, teams } = assignableFor(me);
  const [form, setForm] = useState({ name: "", email: "", role: roles[0], team: teams[0], password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const first = useRef(null);
  useEffect(() => first.current?.focus(), []);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(""); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { user } = await api("/api/members", { method: "POST", body: form });
      dispatch({ type: "users/add", user: { ...user, active: true } });
      toast(`${user.name} was added to ${user.team}`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label="Add member" onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <div className="modal-body" style={{ display: "grid", gap: 14 }}>
          <h3 style={{ margin: 0, font: "var(--text-section)" }}>Add member</h3>
          <div className="field"><label htmlFor="m-name">Full name</label><input id="m-name" ref={first} className="input" value={form.name} onChange={set("name")} required /></div>
          <div className="field"><label htmlFor="m-email">Work email</label><input id="m-email" type="email" className="input" value={form.email} onChange={set("email")} required /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label htmlFor="m-role">Role</label>
              <select id="m-role" className="input" value={form.role} onChange={set("role")}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="m-team">Primary team</label>
              <select id="m-team" className="input" value={form.team} onChange={set("team")}>{teams.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
          </div>
          <div className="field"><label htmlFor="m-pass">Initial password</label><input id="m-pass" type="password" className="input" value={form.password} onChange={set("password")} minLength={8} required autoComplete="new-password" />
            <span className="muted" style={{ fontSize: 12 }}>At least 8 characters. Share it with the member securely.</span>
          </div>
          {error && <div role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </div>
        <div className="modal-foot">
          <span style={{ marginLeft: "auto" }} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>Add Member</button>
        </div>
      </form>
    </Dialog>
  );
}

function EditMemberModal({ member, onClose }) {
  const { me, dispatch, toast } = useApp();
  const { roles, teams } = assignableFor(me);
  const [form, setForm] = useState({ role: member.role, team: member.team, password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(""); };
  const roleOptions = roles.includes(member.role) ? roles : [member.role, ...roles];
  const teamOptions = teams.includes(member.team) ? teams : [member.team, ...teams];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { role: form.role, team: form.team, ...(form.password ? { password: form.password } : {}) };
      const { user } = await api(`/api/members/${member.id}`, { method: "PATCH", body });
      dispatch({ type: "users/update", user });
      toast(`${member.name} updated${form.password ? " · password reset" : ""}`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label="Edit member" onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <div className="modal-body" style={{ display: "grid", gap: 14 }}>
          <h3 style={{ margin: 0, font: "var(--text-section)" }}>Edit {member.name}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label htmlFor="e-role">Role</label>
              <select id="e-role" className="input" value={form.role} onChange={set("role")}>{roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="e-team">Primary team</label>
              <select id="e-team" className="input" value={form.team} onChange={set("team")}>{teamOptions.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
          </div>
          <div className="field"><label htmlFor="e-pass">Reset password (optional)</label><input id="e-pass" type="password" className="input" value={form.password} onChange={set("password")} minLength={8} autoComplete="new-password" />
            <span className="muted" style={{ fontSize: 12 }}>Leave empty to keep the current password. Resetting signs the member out.</span>
          </div>
          {error && <div role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </div>
        <div className="modal-foot">
          <span style={{ marginLeft: "auto" }} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>Save changes</button>
        </div>
      </form>
    </Dialog>
  );
}
