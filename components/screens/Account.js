"use client";

import { useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { Field, FormAlert } from "@/components/ui/Field";
import { PageHeader, Panel } from "@/components/ui/layout";
import { Avatar } from "@/components/ui/indicators";
import { ROLE_LABELS } from "@/lib/roles";

export default function Account() {
  const { me, toast } = useApp();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: null })); setServerError(""); };

  const submit = async (e) => {
    e.preventDefault();
    const next = {
      current: form.current ? null : "Enter your current password.",
      next: form.next.length >= 8 ? null : "Use at least 8 characters.",
      confirm: form.confirm === form.next ? null : "The two new passwords don't match.",
    };
    setErrors(next);
    const firstBad = Object.keys(next).find((k) => next[k]);
    if (firstBad) return document.getElementById(`pw-${firstBad}`)?.focus();
    setBusy(true);
    try {
      await api("/api/account/password", { method: "POST", body: { current: form.current, next: form.next } });
      setForm({ current: "", next: "", confirm: "" });
      toast("Password changed · other devices were signed out");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <PageHeader leading={<Avatar id={me.id} size="lg" />} title={me.name} meta={[ROLE_LABELS[me.role], me.team]} />
      <div className="stack-lg">
        <Panel title="Profile" meta="Your role and team are managed by your manager">
          <dl className="kv panel-body">
            <dt>Email</dt><dd>{me.email}</dd>
            <dt>Role</dt><dd>{ROLE_LABELS[me.role]}</dd>
            <dt>Primary team</dt><dd>{me.team}</dd>
          </dl>
        </Panel>
        <Panel title="Change password" meta="Changing it signs you out on your other devices">
          <form onSubmit={submit} noValidate className="panel-body form-narrow">
            <Field label="Current password" htmlFor="pw-current" error={errors.current}>
              <input id="pw-current" type="password" className="input" value={form.current} onChange={set("current")} autoComplete="current-password" />
            </Field>
            <Field label="New password" htmlFor="pw-next" hint="At least 8 characters." error={errors.next}>
              <input id="pw-next" type="password" className="input" value={form.next} onChange={set("next")} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" htmlFor="pw-confirm" error={errors.confirm}>
              <input id="pw-confirm" type="password" className="input" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
            </Field>
            <FormAlert>{serverError}</FormAlert>
            <div><button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>Change password</button></div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
