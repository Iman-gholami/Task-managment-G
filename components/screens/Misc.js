"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { ROLE_LABELS, TEAMS } from "@/lib/roles";
import Icon from "@/components/ui/Icon";
import { Field, FormAlert } from "@/components/ui/Field";
import { PageHeader, Panel } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { Who } from "@/components/ui/indicators";
import { plural } from "@/lib/format";
import { ThemeChooser } from "@/components/ThemePicker";
import { applyTheme, currentTheme, syncThemeColor } from "@/components/theme";

// What each role can do, as enforced by the API (lib/roles.js, lib/workflow.js, app/api/*).
const ROLES = ["analyst", "engineer", "soc_manager", "security_manager"];
const NO = null;
const PERMISSIONS = [
  ["Create tasks", "For themselves", "For themselves", "For anyone", "For anyone"],
  ["Edit task details (title, deadline, assignee)", NO, NO, "Yes", "Yes"],
  ["Approve or return tasks in review", NO, NO, "Yes, except their own", "Yes, except their own"],
  ["Reopen approved tasks", NO, NO, "Yes", "Yes"],
  ["Keep a Shift Log", "SOC · L1–L3 only", NO, NO, NO],
  ["View performance", "Their own", "Their own", "Everyone", "Everyone"],
  ["Reports and Excel export", "Own data (no team report)", "Own data (no team report)", "All reports", "All reports"],
  ["Add, edit and remove members", NO, NO, "SOC analysts", "Everyone except Security Managers"],
];

export function Admin() {
  const { members } = useApp();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [team, setTeam] = useState("");
  const list = members.filter((p) => (!q || `${p.name} ${p.email}`.toLowerCase().includes(q.toLowerCase())) && (!role || p.role === role) && (!team || p.team === team));
  const active = [q, role, team].filter(Boolean).length;
  const teams = TEAMS.filter((t) => members.some((m) => m.team === t));

  return (
    <div className="page">
      <PageHeader
        title="Users & roles"
        meta={[plural(members.length, "active user"), "Access is granted by role"]}
        actions={<Link className="btn btn-secondary" href="/team"><Icon name="team" />Manage members</Link>}
      />
      <div className="stack-lg">
        <div>
          <div className="toolbar" role="search" aria-label="Filter users">
            <div className="search"><Icon name="search" /><input type="search" className="input" placeholder="Search name or email" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className={`input ${role ? "is-set" : ""}`} style={{ width: 180 }} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <select className={`input ${team ? "is-set" : ""}`} style={{ width: 200 }} value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
              <option value="">All teams</option>
              {teams.map((t) => <option key={t}>{t}</option>)}
            </select>
            {active > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setRole(""); setTeam(""); }}><Icon name="x" />Reset filters ({active})</button>}
            <div className="end"><span className="result-count">{list.length === members.length ? plural(list.length, "user") : `${list.length} of ${members.length}`}</span></div>
          </div>
          <div className="panel">
            {list.length === 0 ? <EmptyState compact icon="search" title="No users match">Try another name, role or team.</EmptyState> : (
              <div className="table-wrap">
                <table className="dt hover">
                  <thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Primary team</th><th scope="col">Assisting</th><th scope="col">Email</th><th scope="col">Status</th></tr></thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id}>
                        <td className="title"><Who id={p.id} /></td>
                        <td>{ROLE_LABELS[p.role]}</td>
                        <td>{p.team}</td>
                        <td>{p.assist ?? <span className="muted">—</span>}</td>
                        <td className="muted">{p.email}</td>
                        <td><span className="badge dot success">Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <Panel title="Role permissions" meta="Enforced by the server; the interface only offers allowed actions">
          <div className="table-wrap">
            <table className="dt hover perm">
              <thead><tr><th scope="col">Capability</th>{ROLES.map((r) => <th key={r} scope="col">{ROLE_LABELS[r]}</th>)}</tr></thead>
              <tbody>
                {PERMISSIONS.map(([cap, ...cells]) => (
                  <tr key={cap}>
                    <th scope="row" className="title">{cap}</th>
                    {cells.map((c, i) => (
                      <td key={i}>{c ? <span className="perm-yes"><Icon name="check" size="sm" />{c}</span> : <span className="muted" aria-label="Not allowed">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState("light");
  useEffect(() => { setTheme(currentTheme()); syncThemeColor(); }, []);
  const changeTheme = (id, origin) => { setTheme(id); applyTheme(id, origin); };

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
        <div className="login-bar">
          <div className="brand"><span className="brand-mark" aria-hidden="true"><Icon name="brand" /></span><span>Sentinel Ops</span></div>
          <ThemeChooser variant="dots" value={theme} onChange={changeTheme} />
        </div>
        <form className="login-form" onSubmit={submit}>
          <div className="login-title">
            <span className="eyebrow">Security Department workspace</span>
            <h1>Welcome back</h1>
            <p className="sec">Sign in to pick up your tasks, shifts and reports.</p>
          </div>
          <Field label="Work email" htmlFor="email">
            <input id="email" name="email" type="email" className="input input-lg" placeholder="name@company" autoComplete="username" inputMode="email" required autoFocus aria-invalid={!!error || undefined} readOnly={busy} />
          </Field>
          <Field label="Password" htmlFor="password">
            <input id="password" name="password" className="input input-lg" type="password" autoComplete="current-password" required aria-invalid={!!error || undefined} readOnly={busy} />
          </Field>
          <FormAlert>{error}</FormAlert>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Signing in…" : <>Sign in<Icon name="arrowRight" /></>}</button>
          <p className="muted small">Trouble signing in? Ask your administrator to reset your password.</p>
        </form>
        <p className="login-foot muted small"><Icon name="lock" size="sm" />Internal use only · Security Department</p>
      </main>
      <aside className="login-r" aria-hidden="true">
        <div className="login-grid" />
        <div className="radar">
          <span className="radar-ring r1" /><span className="radar-ring r2" /><span className="radar-ring r3" />
          <span className="radar-sweep" />
          <span className="radar-blip b1" /><span className="radar-blip b2" /><span className="radar-blip b3" />
          <span className="radar-core"><Icon name="brand" /></span>
        </div>
        <div className="login-chip c1"><span><Icon name="tasks" /></span>Review workflow</div>
        <div className="login-chip c2"><span><Icon name="shift" /></span>SOC Shift Log</div>
        <div className="login-chip c3"><span><Icon name="report" /></span>Excel reports</div>
        <div className="login-copy">
          <div className="eyebrow">Security Department</div>
          <p className="statement">Every task, every shift — <em>in one calm place.</em></p>
          <ul>
            <li><Icon name="tasks" />Assign, review and approve work with a clear workflow.</li>
            <li><Icon name="shift" />Keep the daily SOC Shift Log, IOCs and tickets together.</li>
            <li><Icon name="report" />See what the team accomplished, with Excel-ready reports.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
