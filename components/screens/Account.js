"use client";

import { useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { Avatar } from "@/components/ui/indicators";
import { ROLE_LABELS } from "@/lib/roles";

export default function Account() {
  const { me, toast } = useApp();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(""); };

  const submit = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm) return setError("The new passwords don't match.");
    setBusy(true);
    try {
      await api("/api/account/password", { method: "POST", body: { current: form.current, next: form.next } });
      setForm({ current: "", next: "", confirm: "" });
      toast("Password changed · other devices were signed out");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Avatar id={me.id} size="lg" />
          <div><h1>{me.name}</h1><p>{ROLE_LABELS[me.role]} · {me.team}</p></div>
        </div>
      </div>
      <section className="section">
        <div className="section-head"><h2>Profile</h2><span className="meta">Role and team are managed by your manager</span></div>
        <dl className="kv" style={{ gridTemplateColumns: "140px 1fr" }}>
          <dt>Email</dt><dd>{me.email}</dd>
          <dt>Role</dt><dd>{ROLE_LABELS[me.role]}</dd>
          <dt>Primary team</dt><dd>{me.team}</dd>
        </dl>
      </section>
      <section className="section">
        <div className="section-head"><h2>Change password</h2></div>
        <form onSubmit={submit} style={{ display: "grid", gap: 14, maxWidth: 380 }}>
          <div className="field"><label htmlFor="pw-current">Current password</label><input id="pw-current" type="password" className="input" value={form.current} onChange={set("current")} autoComplete="current-password" required /></div>
          <div className="field"><label htmlFor="pw-next">New password</label><input id="pw-next" type="password" className="input" value={form.next} onChange={set("next")} autoComplete="new-password" minLength={8} required /><span className="muted" style={{ fontSize: 12 }}>At least 8 characters.</span></div>
          <div className="field"><label htmlFor="pw-confirm">Confirm new password</label><input id="pw-confirm" type="password" className="input" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required /></div>
          {error && <div role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
          <div><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button></div>
        </form>
      </section>
    </div>
  );
}
