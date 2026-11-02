"use client";

import { useI18n as useUiI18n } from "@/components/I18nProvider";

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
import { assignableFor, canManageMember, canViewManagementAnalytics } from "@/lib/roles";
import ProvincePicker from "@/components/ui/ProvincePicker";

/** People with role, team and live workload (open tasks; 6 = full). Rows open the person's performance. */
export function PeopleTable({ list, onRemove, onEdit }) {
  const { t: __uiTr, locale, role: roleText, team: teamText, province: provinceText } = useUiI18n();
  const router = useRouter();
  const { me } = useApp();
  const canView = (p) => p.id === me.id || canViewManagementAnalytics(me);
  const hasActions = list.some((p) => canView(p) || (onEdit && canManageMember(me, p)));
  return (
    <div className="table-wrap">
      <table className="dt">
        <thead>
          <tr>
            <th scope="col">{"" + __uiTr("Name") + ""}</th>
            <th scope="col">{"" + __uiTr("Role") + ""}</th>
            <th scope="col">{"" + __uiTr("Primary team") + ""}</th>
            <th scope="col">{"" + __uiTr("استان") + ""}</th>
            <th scope="col">{"" + __uiTr("Workload") + ""}</th>
            <th scope="col" className="r">{"" + __uiTr("Open tasks") + ""}</th>
            {hasActions && <th scope="col"><span className="sr-only">{"" + __uiTr("Actions") + ""}</span></th>}
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} data-member={p.id} className={canView(p) ? "is-link" : ""} onClick={(e) => canView(p) && !e.target.closest("a, button") && router.push(`/performance/employees/${p.id}`)}>
              <td className="title">{canView(p) ? <Link href={`/performance/employees/${p.id}`}><Who id={p.id} /></Link> : <Who id={p.id} />}</td>
              <td>{roleText(p.role)}</td>
              <td>{teamText(p.team)}{p.assist && <span className="muted"> · {locale === "fa" ? "همکاری با" : "assisting"} {teamText(p.assist)}</span>}</td>
              <td>{p.province ? provinceText(p.province) : <span className="muted">{__uiTr("تعیین‌نشده")}</span>}</td>
              <td><Meter value={p.open} max={6} label={locale === "fa" ? `حجم کار ${p.name}` : `${p.name}'s workload`} tone={p.load > 90 ? "warn" : undefined} /></td>
              <td className="r">{p.open || <span className="zero">0</span>}</td>
              {hasActions && (
                <td className="actions">
                  <span>
                    {canView(p) && <Link className="btn btn-ghost btn-sm" href={`/performance/employees/${p.id}`}>{__uiTr("Performance")}</Link>}
                    {onEdit && canManageMember(me, p) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(p)} aria-label={locale === "fa" ? `ویرایش ${p.name}` : `Edit ${p.name}`}>{__uiTr("Edit")}</button>}
                    {onRemove && canManageMember(me, p) && <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => onRemove(p)} aria-label={locale === "fa" ? `حذف ${p.name}` : `Remove ${p.name}`}>{__uiTr("Remove")}</button>}
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
  const { t: __uiTr, locale, team: teamText } = useUiI18n();
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
      toast(locale === "fa" ? `${p.name} از تیم حذف شد` : `${p.name} was removed from the team`);
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
        title={__uiTr("Team")}
        meta={[locale === "fa" ? `${members.length} نفر` : plural(members.length, "person", "people"), teamText("Security Department")]}
        actions={canAdd && <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" />{"" + __uiTr("Add member") + ""}</button>}
      />
      <div className="toolbar" role="search" aria-label={__uiTr("Filter people")}>
        <div className="search"><Icon name="search" /><input type="search" className="input" placeholder={__uiTr("Search by name")} aria-label={__uiTr("Search people")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Segmented label={__uiTr("Team")} value={team} onChange={setTeam} options={TEAM_FILTERS.map((item) => ({ value: item, label: item === "All" ? __uiTr(item) : teamText(item), count: members.filter((p) => inTeam(p, item)).length }))} />
        <div className="end"><span className="result-count">{locale === "fa" ? `${list.length} از ${members.length} نفر` : list.length === members.length ? plural(list.length, "person", "people") : `${list.length} of ${members.length}`}</span></div>
      </div>
      <div className="panel">
        {list.length ? <PeopleTable list={list} onRemove={setRemoving} onEdit={setEditingMember} /> : (
          <EmptyState icon="team" title={__uiTr("No people match")} action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => { setQ(""); setTeam("All"); }}>{"" + __uiTr("Clear search") + ""}</button>}>{"" + __uiTr("Nobody") + ""}{team !== "All" ? ` in ${team}` : ""}{" " + __uiTr("matches “") + ""}{q}”.
          </EmptyState>
        )}
      </div>
      {adding && <AddMemberModal onClose={() => setAdding(false)} />}
      {editingMember && <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} />}
      {removing && (
        <Dialog label={__uiTr("Remove member")} title={locale === "fa" ? `${removing.name} حذف شود؟` : `Remove ${removing.name}?`} description={__uiTr("They lose access immediately and are signed out on every device.")} onClose={() => setRemoving(null)} width={460}>
          <div className="modal-body">
            <p className="sec">{"" + __uiTr("Their tasks, shift logs and tickets are kept, so reports for past periods stay complete.") + ""}</p>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={() => setRemoving(null)}>{"" + __uiTr("Cancel") + ""}</button>
            <button type="button" className="btn btn-danger" onClick={confirmRemove} disabled={busy} aria-busy={busy}>{"" + __uiTr("Remove member") + ""}</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

const EMAIL = /^\S+@\S+\.\S+$/;

function AddMemberModal({ onClose }) {
  const { t: __uiTr, locale, role: roleText, team: teamText } = useUiI18n();
  const { me, dispatch, toast } = useApp();
  const { roles, teams } = assignableFor(me);
  const [form, setForm] = useState({ name: "", email: "", role: roles[0], team: teams[0], province: "", password: "" });
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
      province: form.province ? null : "استان محل فعالیت را انتخاب کنید.",
    };
    setErrors(next);
    const firstBad = Object.keys(next).find((k) => next[k]);
    if (firstBad) return document.getElementById(`m-${firstBad === "password" ? "pass" : firstBad}`)?.focus();
    setBusy(true);
    try {
      const { user } = await api("/api/members", { method: "POST", body: form });
      dispatch({ type: "users/add", user: { ...user, active: true } });
      toast(locale === "fa" ? `${user.name} به ${teamText(user.team)} اضافه شد` : `${user.name} was added to ${teamText(user.team)}`);
      onClose();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label={__uiTr("Add member")} title={__uiTr("Add member")} description={__uiTr("They can sign in right away with this email and the initial password.")} onClose={onClose} width={520} dismissible={!dirty}>
      <form onSubmit={submit} noValidate>
        <div className="modal-body form">
          <Field label={__uiTr("Full name")} htmlFor="m-name" error={errors.name}>
            <input id="m-name" className="input" value={form.name} onChange={set("name")} autoComplete="off" data-autofocus />
          </Field>
          <Field label={__uiTr("Work email")} htmlFor="m-email" error={errors.email}>
            <input id="m-email" type="email" className="input" value={form.email} onChange={set("email")} autoComplete="off" />
          </Field>
          <div className="field-row">
            <Field label={__uiTr("Role")} htmlFor="m-role">
              <select id="m-role" className="input" value={form.role} onChange={set("role")}>{roles.map((r) => <option key={r} value={r}>{roleText(r)}</option>)}</select>
            </Field>
            <Field label={__uiTr("Primary team")} htmlFor="m-team">
              <select id="m-team" className="input" value={form.team} onChange={set("team")}>{teams.map((item) => <option key={item} value={item}>{teamText(item)}</option>)}</select>
            </Field>
          </div>
          <Field label={__uiTr("استان")} htmlFor="m-province" error={errors.province}>
            <ProvincePicker id="m-province" value={form.province}
              onChange={(value) => { setForm((f) => ({ ...f, province: value })); setErrors((old) => ({ ...old, province: null })); setServerError(""); }} />
          </Field>
          <Field label={__uiTr("Initial password")} htmlFor="m-pass" hint={__uiTr("At least 8 characters. Share it with the member securely.")} error={errors.password}>
            <input id="m-pass" type="password" className="input" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <FormAlert>{serverError}</FormAlert>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{"" + __uiTr("Cancel") + ""}</button>
          <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>{"" + __uiTr("Add member") + ""}</button>
        </div>
      </form>
    </Dialog>
  );
}

function EditMemberModal({ member, onClose }) {
  const { t: __uiTr, locale, role: roleText, team: teamText } = useUiI18n();
  const { me, dispatch, toast } = useApp();
  const { roles, teams } = assignableFor(me);
  const [form, setForm] = useState({ role: member.role, team: member.team, province: member.province ?? "", password: "" });
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(""); setPasswordError(null); };
  const roleOptions = roles.includes(member.role) ? roles : [member.role, ...roles];
  const teamOptions = teams.includes(member.team) ? teams : [member.team, ...teams];
  const changed = form.role !== member.role || form.team !== member.team || form.province !== (member.province ?? "") || form.password;

  const submit = async (e) => {
    e.preventDefault();
    if (form.password && form.password.length < 8) {
      setPasswordError("Use at least 8 characters, or leave it empty to keep the current password.");
      return document.getElementById("e-pass")?.focus();
    }
    setBusy(true);
    try {
      const body = { role: form.role, team: form.team, province: form.province, ...(form.password ? { password: form.password } : {}) };
      const { user } = await api(`/api/members/${member.id}`, { method: "PATCH", body });
      dispatch({ type: "users/update", user });
      toast(locale === "fa" ? `${member.name} به‌روزرسانی شد${form.password ? " · رمز عبور بازنشانی شد" : ""}` : `${member.name} updated${form.password ? " · password reset" : ""}`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label={__uiTr("Edit member")} title={locale === "fa" ? `ویرایش ${member.name}` : `Edit ${member.name}`} description={member.email} onClose={onClose} width={520} dismissible={!changed}>
      <form onSubmit={submit} noValidate>
        <div className="modal-body form">
          <div className="field-row">
            <Field label={__uiTr("Role")} htmlFor="e-role">
              <select id="e-role" className="input" value={form.role} onChange={set("role")}>{roleOptions.map((r) => <option key={r} value={r}>{roleText(r)}</option>)}</select>
            </Field>
            <Field label={__uiTr("Primary team")} htmlFor="e-team">
              <select id="e-team" className="input" value={form.team} onChange={set("team")}>{teamOptions.map((item) => <option key={item} value={item}>{teamText(item)}</option>)}</select>
            </Field>
          </div>
          <Field label={__uiTr("استان")} htmlFor="e-province">
            <ProvincePicker id="e-province" value={form.province}
              onChange={(value) => { setForm((f) => ({ ...f, province: value })); setError(""); }} />
          </Field>
          <Field label={__uiTr("Reset password (optional)")} htmlFor="e-pass" hint={__uiTr("Leave empty to keep the current password. Resetting signs the member out.")} error={passwordError}>
            <input id="e-pass" type="password" className="input" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <FormAlert>{error}</FormAlert>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{"" + __uiTr("Cancel") + ""}</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !changed} aria-busy={busy}>{"" + __uiTr("Save changes") + ""}</button>
        </div>
      </form>
    </Dialog>
  );
}
