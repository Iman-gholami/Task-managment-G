"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { ROLE_LABELS } from "@/lib/roles";
import Icon from "@/components/ui/Icon";
import { EmptyState, Status, Who } from "@/components/ui/indicators";

const ADMIN_SECTIONS = ["Users & Roles", "Teams", "Shift Templates", "Activity Definitions", "Notifications", "Audit Log"];
const PERMISSIONS = [
  ["Create & assign tasks", "Self only", "SOC", "All teams", "All"],
  ["Review & set quality", "—", "SOC", "All teams", "—"],
  ["Shift Log", "Own", "View SOC", "View all", "Configure"],
  ["Performance", "Own", "SOC", "All teams", "—"],
  ["Export reports", "Own", "SOC", "All", "All"],
];

export function Admin() {
  const { members: people } = useApp();
  return (
    <div className="split">
      <nav className="split-nav" aria-label="Administration">
        {ADMIN_SECTIONS.map((n, i) => <span key={n} className={`nav-item ${i ? "" : "active"}`}><span>{n}</span></span>)}
      </nav>
      <div className="page" style={{ minWidth: 0 }}>
        <div className="page-head">
          <div><h1>Users &amp; Roles</h1><p>{people.length} active users</p></div>
          <div className="actions"><Link className="btn btn-primary" href="/team"><Icon name="plus" />Add Member</Link></div>
        </div>
        <div className="toolbar"><div className="search"><Icon name="search" /><input className="input" placeholder="Search users" /></div><button className="chip"><Icon name="plus" />Role</button><button className="chip"><Icon name="plus" />Team</button></div>
        <table className="dt">
          <thead><tr><th>User</th><th>Role</th><th>Primary team</th><th>Temporary assignment</th><th>Email</th><th>Status</th></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td className="title"><Who id={p.id} /></td>
                <td>{ROLE_LABELS[p.role]}</td>
                <td>{p.team}</td>
                <td>{p.assist ? <>{p.assist} <span className="muted">· until Oct 15</span></> : <span className="muted">—</span>}</td>
                <td className="muted">{p.email}</td>
                <td><Status s="done" label="Active" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="section-head" style={{ marginTop: 32 }}><h2>Role permissions</h2></div>
        <table className="dt">
          <thead><tr><th>Capability</th><th>Analyst</th><th>SOC Manager</th><th>Security Manager</th><th>Admin</th></tr></thead>
          <tbody>
            {PERMISSIONS.map((r) => (
              <tr key={r[0]}><td className="title">{r[0]}</td>{r.slice(1).map((c, i) => <td key={i}>{c === "—" ? <span className="muted">—</span> : c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function States() {
  const { setCreateOpen } = useApp();
  return (
    <div className="page">
      <div className="page-head"><div><h1>Empty, loading &amp; error states</h1></div></div>
      <div className="state-demo">
        <div className="panel"><EmptyState icon={<Icon name="check" />} title="You're all caught up." action={<button className="btn btn-secondary btn-sm" onClick={() => setCreateOpen(true)}>Create Task</button>}>No tasks are assigned to you right now.</EmptyState></div>
        <div className="panel"><EmptyState icon={<Icon name="shift" />} title="No shift activity yet" action={<Link className="btn btn-primary btn-sm" href="/shift">Start Shift Log</Link>}>No shift activity has been recorded for today.</EmptyState></div>
        <div className="panel"><EmptyState icon={<Icon name="report" />} title="Nothing to report" action={<button className="btn btn-ghost btn-sm">Reset filters</button>}>No activity was found for the selected period.</EmptyState></div>
        <div className="panel" style={{ padding: "12px 16px" }}><TableSkeleton rows={7} /></div>
        <div className="panel"><EmptyState danger icon={<Icon name="alert" />} title="Couldn't load team tasks" action={<><button className="btn btn-secondary btn-sm">Retry</button><button className="btn btn-ghost btn-sm">Go Back</button></>}>The server didn&apos;t respond in time. Your filters are kept.</EmptyState></div>
        <div className="panel"><EmptyState icon={<Icon name="admin" />} title="You don't have access" action={<button className="btn btn-ghost btn-sm">Contact Administrator</button>}>Team performance is visible to SOC and Security Managers.</EmptyState></div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }) {
  return Array.from({ length: rows }, (_, i) => (
    <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", gap: 16, height: 36, alignItems: "center", borderBottom: "1px solid var(--divider)" }}>
      <div className="sk" style={{ width: `${60 + ((i * 13) % 35)}%` }} /><div className="sk" style={{ width: "70%" }} /><div className="sk" style={{ width: "50%" }} /><div className="sk" style={{ width: "40%" }} />
    </div>
  ));
}

export function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: { email: f.get("email"), password: f.get("password") } });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <main className="login-l">
        <form className="login-form" onSubmit={submit} noValidate={false}>
          <div className="brand" style={{ padding: 0, margin: 0 }}><span className="brand-mark">S</span><span>Sentinel Ops</span></div>
          <div style={{ marginTop: "var(--s-8)" }}>
            <h1>Welcome back</h1>
            <p className="muted" style={{ marginTop: "var(--s-2)" }}>Sign in to the Security Department workspace.</p>
          </div>
          <div className="field"><label htmlFor="email">Work email</label><input id="email" name="email" type="email" className="input" autoComplete="username" inputMode="email" required autoFocus aria-invalid={!!error} /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" className="input" type="password" autoComplete="current-password" required aria-invalid={!!error} /></div>
          {error && <div role="alert" className="field-error"><Icon name="alert" />{error}</div>}
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} aria-busy={busy}>Sign in</button>
          <p className="muted" style={{ fontSize: "var(--fs-13)" }}>Trouble signing in? Ask your administrator to reset your password.</p>
        </form>
      </main>
      <aside className="login-r" aria-hidden="true">
        <div className="eyebrow">Security Department</div>
        <div>
          <p className="quote">Every task, every shift, <em>in one calm place.</em></p>
          <p className="muted" style={{ marginTop: "var(--s-6)", maxWidth: "40ch" }}>Assign and review work, keep the daily SOC shift log, and see what the team actually accomplished.</p>
        </div>
      </aside>
    </div>
  );
}
