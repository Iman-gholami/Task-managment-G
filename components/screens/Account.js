"use client";

import { useI18n as useUiI18n } from "@/components/I18nProvider";

import { useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { Field, FormAlert } from "@/components/ui/Field";
import { PageHeader, Panel } from "@/components/ui/layout";
import { Avatar } from "@/components/ui/indicators";
import { ThemeChooser } from "@/components/ThemePicker";

export default function Account() {
  const { t: __uiTr, role: roleText, team: teamText } = useUiI18n();
  const { me, toast, theme, setTheme } = useApp();
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
      <PageHeader leading={<Avatar id={me.id} size="lg" />} title={me.name} meta={[roleText(me.role), teamText(me.team)]} />
      <div className="stack-lg">
        <Panel title={__uiTr("Profile")} meta={__uiTr("Your role and team are managed by your manager")}>
          <dl className="kv panel-body">
            <dt>{"" + __uiTr("Email") + ""}</dt><dd>{me.email}</dd>
            <dt>{"" + __uiTr("Role") + ""}</dt><dd>{roleText(me.role)}</dd>
            <dt>{"" + __uiTr("Primary team") + ""}</dt><dd>{teamText(me.team)}</dd>
          </dl>
        </Panel>
        <Panel title={__uiTr("Appearance")} meta={__uiTr("Saved on this device · also in the top bar")}>
          <div className="panel-body">
            <ThemeChooser value={theme} onChange={setTheme} />
          </div>
        </Panel>
        <Panel title={__uiTr("Change password")} meta={__uiTr("Changing it signs you out on your other devices")}>
          <form onSubmit={submit} noValidate className="panel-body form-narrow">
            <Field label={__uiTr("Current password")} htmlFor="pw-current" error={errors.current}>
              <input id="pw-current" type="password" className="input" value={form.current} onChange={set("current")} autoComplete="current-password" />
            </Field>
            <Field label={__uiTr("New password")} htmlFor="pw-next" hint={__uiTr("At least 8 characters.")} error={errors.next}>
              <input id="pw-next" type="password" className="input" value={form.next} onChange={set("next")} autoComplete="new-password" />
            </Field>
            <Field label={__uiTr("Confirm new password")} htmlFor="pw-confirm" error={errors.confirm}>
              <input id="pw-confirm" type="password" className="input" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
            </Field>
            <FormAlert>{serverError}</FormAlert>
            <div><button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>{"" + __uiTr("Change password") + ""}</button></div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
