"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import Dialog from "@/components/ui/Dialog";
import Segmented from "@/components/ui/Segmented";
import { Field, FormAlert } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/layout";
import { Meter } from "@/components/ui/charts";
import { EmptyState } from "@/components/ui/states";
import { Who } from "@/components/ui/indicators";
import { plural } from "@/lib/format";
import { ROLE_LABELS, assignableFor, canManageMember, inReportScope, isManager } from "@/lib/roles";

/** People with role, team and live workload (open tasks; 6 = full). Rows open the person's performance. */
export function PeopleTable({ list, onRemove, onEdit }) {
  const router = useRouter();
  const { me } = useApp();
  const canView = (p) => inReportScope(me, p);
  const hasActions = list.some((p) => canView(p) || (onEdit && canManageMember(me, p)));
  return (
    <div className="table-wrap">
      <table className="dt">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Role</th>
            <th scope="col">Primary team</th>
            <th scope="col">Workload</th>
            <th scope="col" className="r">Open tasks</th>
            {hasActions && <th scope="col"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} data-member={p.id} className={canView(p) ? "is-link" : ""} onClick={(e) => canView(p) && !e.target.closest("a, button") && router.push(`/performance/employees/${p.id}`)}>
              <td className="title">{canView(p) ? <Link href={`/performance/employees/${p.id}`}><Who id={p.id} /></Link> : <Who id={p.id} />}</td>
              <td>{ROLE_LABELS[p.role] ?? p.role}</td>
              <td>{p.team}{p.assist && <span className="muted"> · assisting {p.assist}</span>}</td>
              <td><Meter value={p.open} max={6} label={`${p.name}'s workload`} tone={p.load > 90 ? "warn" : undefined} /></td>
              <td className="r">{p.open || <span className="zero">0</span>}</td>
              {hasActions && (
                <td className="actions">
                  <span>
                    {canView(p) && <Link className="btn btn-ghost btn-sm" href={`/performance/employees/${p.id}`}>Performance</Link>}
                    {onEdit && canManageMember(me, p) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`}>Edit</button>}
                    {onRemove && canManageMember(me, p) && <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => onRemove(p)} aria-label={`Remove ${p.name}`}>Remove</button>}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TEAM_FILTERS = ["All", "SOC", "Design & Automation", "Threat Intelligence"];
const inTeam = (p, team) => team === "All" || p.team.startsWith(team) || (team === "SOC" && p.assist?.startsWith("SOC"));

export default function Team() {
  const { members, me, dispatch, toast } = useApp();
  const [team, setTeam] = useState("All");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const canAdd = assignableFor(me).roles.length > 0;

  const list = members.filter((p) => inTeam(p, team)).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  const confirmRemove = async () => {
    const p = removing;
    setBusy(true);
    try {
      await api(`/api/members/${p.id}`, { method: "DELETE" });
      dispatch({ type: "users/deactivate", id: p.id });
      toast(`${p.name} was removed from the team`);
      setRemoving(null);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Team"
        meta={[plural(members.length, "person", "people"), "Security Department"]}
        actions={canAdd && <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" />Add member</button>}
      />
      <div className="toolbar" role="search" aria-label="Filter people">
        <div className="search"><Icon name="search" /><input type="search" className="input" placeholder="Search by name" aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Segmented label="Team" value={team} onChange={setTeam} options={TEAM_FILTERS.map((t) => ({ value: t, label: t, count: members.filter((p) => inTeam(p, t)).length }))} />
        <div className="end"><span className="result-count">{list.length === members.length ? plural(list.length, "person", "people") : `${list.length} of ${members.length}`}</span></div>
      </div>
      <div className="panel">
        {list.length ? <PeopleTable list={list} onRemove={setRemoving} onEdit={setEditingMember} /> : (
          <EmptyState icon="team" title="No people match" action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => { setQ(""); setTeam("All"); }}>Clear search</button>}>
            Nobody{team !== "All" ? ` in ${team}` : ""} matches “{q}”.
          </EmptyState>
        )}
      </div>
      {adding && <AddMemberModal onClose={() => setAdding(false)} />}
      {editingMember && <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} />}
      {removing && (
        <Dialog label="Remove member" title={`Remove ${removing.name}?`} description="They lose access immediately and are signed out on every device." onClose={() => setRemoving(null)} width={460}>
          <div className="modal-body">
            <p className="sec">Their tasks, shift logs and tickets are kept, so reports for past periods stay complete.</p>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={() => setRemoving(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={confirmRemove} disabled={busy} aria-busy={busy}>Remove member</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

const EMAIL = /^\S+@\S+\.\S+$/;

function AddMemberModal({ onClose }) {
  const { me, dispatch, toast } = useApp();
  const { roles, teams } = assignableFor(me);
  const [form, setForm] = useState({ name: "", email: "", role: roles[0], team: teams[0], password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: null })); setServerError(""); };
  const dirty = form.name || form.email || form.password;

  const submit = async (e) => {
    e.preventDefault();
    const next = {
      name: form.name.trim() ? null : "Enter the member's full name.",
      email: EMAIL.test(form.email.trim()) ? null : "Enter a valid work email, like name@company.com.",
      password: form.password.length >= 8 ? null : "Use at least 8 characters.",
    };
    setErrors(next);
    const firstBad = Object.keys(next).find((k) => next[k]);
    if (firstBad) return document.getElementById(`m-${firstBad === "password" ? "pass" : firstBad}`)?.focus();
    setBusy(true);
    try {
      const { user } = await api("/api/members", { method: "POST", body: form });
      dispatch({ type: "users/add", user: { ...user, active: true } });
      toast(`${user.name} was added to ${user.team}`);
      onClose();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label="Add member" title="Add member" description="They can sign in right away with this email and the initial password." onClose={onClose} width={520} dismissible={!dirty}>
      <form onSubmit={submit} noValidate>
        <div className="modal-body form">
          <Field label="Full name" htmlFor="m-name" error={errors.name}>
            <input id="m-name" className="input" value={form.name} onChange={set("name")} autoComplete="off" data-autofocus />
          </Field>
          <Field label="Work email" htmlFor="m-email" error={errors.email}>
            <input id="m-email" type="email" className="input" value={form.email} onChange={set("email")} autoComplete="off" />
          </Field>
          <div className="field-row">
            <Field label="Role" htmlFor="m-role">
              <select id="m-role" className="input" value={form.role} onChange={set("role")}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
            </Field>
            <Field label="Primary team" htmlFor="m-team">
              <select id="m-team" className="input" value={form.team} onChange={set("team")}>{teams.map((t) => <option key={t}>{t}</option>)}</select>
            </Field>
          </div>
          <Field label="Initial password" htmlFor="m-pass" hint="At least 8 characters. Share it with the member securely." error={errors.password}>
            <input id="m-pass" type="password" className="input" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <FormAlert>{serverError}</FormAlert>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>Add member</button>
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
  const [passwordError, setPasswordError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(""); setPasswordError(null); };
  const roleOptions = roles.includes(member.role) ? roles : [member.role, ...roles];
  const teamOptions = teams.includes(member.team) ? teams : [member.team, ...teams];
  const changed = form.role !== member.role || form.team !== member.team || form.password;

  const submit = async (e) => {
    e.preventDefault();
    if (form.password && form.password.length < 8) {
      setPasswordError("Use at least 8 characters, or leave it empty to keep the current password.");
      return document.getElementById("e-pass")?.focus();
    }
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
    <Dialog label="Edit member" title={`Edit ${member.name}`} description={member.email} onClose={onClose} width={520} dismissible={!changed}>
      <form onSubmit={submit} noValidate>
        <div className="modal-body form">
          <div className="field-row">
            <Field label="Role" htmlFor="e-role">
              <select id="e-role" className="input" value={form.role} onChange={set("role")}>{roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
            </Field>
            <Field label="Primary team" htmlFor="e-team">
              <select id="e-team" className="input" value={form.team} onChange={set("team")}>{teamOptions.map((t) => <option key={t}>{t}</option>)}</select>
            </Field>
          </div>
          <Field label="Reset password (optional)" htmlFor="e-pass" hint="Leave empty to keep the current password. Resetting signs the member out." error={passwordError}>
            <input id="e-pass" type="password" className="input" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <FormAlert>{error}</FormAlert>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !changed} aria-busy={busy}>Save changes</button>
        </div>
      </form>
    </Dialog>
  );
}
