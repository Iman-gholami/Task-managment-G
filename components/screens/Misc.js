"use client";

import { useI18n as useSharedI18n } from "@/components/I18nProvider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { TEAMS } from "@/lib/roles";
import Icon from "@/components/ui/Icon";
import { Field, FormAlert } from "@/components/ui/Field";
import { PageHeader, Panel } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { Who } from "@/components/ui/indicators";
import { plural } from "@/lib/format";
import { ThemeChooser } from "@/components/ThemePicker";
import { applyTheme, currentTheme, syncThemeColor } from "@/components/theme";
import { LanguageSwitcher, useI18n } from "@/components/I18nProvider";

// What each role can do, as enforced by the API (lib/roles.js, lib/workflow.js, app/api/*).
const ROLES = ["analyst", "engineer", "soc_manager", "security_manager", "observer"];
const NO = null;
const PERMISSIONS = [
  ["Create tasks", "For themselves", "For themselves", "For anyone", "For anyone", NO],
  ["Edit task details (title, deadline, assignee)", NO, NO, "Yes", "Yes", NO],
  ["Approve or return tasks in review", NO, NO, "Yes, except their own", "Yes, except their own", NO],
  ["Reopen approved tasks", NO, NO, "Yes", "Yes", NO],
  ["Keep a Shift Log", "SOC · L1–L3 only", NO, NO, NO, NO],
  ["Define Shift Log checklists and assign them to SOC groups", NO, NO, "Yes", "Yes", NO],
  ["View performance", "Their own", "Their own", "Everyone", "Everyone", "All staff"],
  ["Reports and Excel export", "Own data (no team report)", "Own data (no team report)", "All reports", "All reports", "All reports (read-only)"],
  ["Add, edit and remove members", NO, NO, "SOC analysts", "Everyone except Security Managers", NO],
];

export function Admin() {
  const { t: __sharedTr, locale, role: roleText, team: teamText, province: provinceText } = useSharedI18n();
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
        title={__sharedTr("Users & roles")}
        meta={[locale === "fa" ? `${members.length} کاربر فعال` : plural(members.length, "active user"), __sharedTr("Access is granted by role")]}
        actions={<Link className="btn btn-secondary" href="/team"><Icon name="team" />{"" + __sharedTr("Manage members") + ""}</Link>}
      />
      <div className="stack-lg">
        <div>
          <div className="toolbar" role="search" aria-label={__sharedTr("Filter users")}>
            <div className="search"><Icon name="search" /><input type="search" className="input" placeholder={__sharedTr("Search name or email")} aria-label={__sharedTr("Search users")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className={`input ${role ? "is-set" : ""}`} style={{ width: 180 }} value={role} onChange={(e) => setRole(e.target.value)} aria-label={__sharedTr("Role")}>
              <option value="">{"" + __sharedTr("All roles") + ""}</option>
              {ROLES.map((r) => <option key={r} value={r}>{roleText(r)}</option>)}
            </select>
            <select className={`input ${team ? "is-set" : ""}`} style={{ width: 200 }} value={team} onChange={(e) => setTeam(e.target.value)} aria-label={__sharedTr("Team")}>
              <option value="">{"" + __sharedTr("All teams") + ""}</option>
              {teams.map((t) => <option key={t} value={t}>{teamText(t)}</option>)}
            </select>
            {active > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setRole(""); setTeam(""); }}><Icon name="x" />{"" + __sharedTr("Reset filters (") + ""}{active})</button>}
            <div className="end"><span className="result-count">{locale === "fa" ? `${list.length} از ${members.length} کاربر` : list.length === members.length ? plural(list.length, "user") : `${list.length} of ${members.length}`}</span></div>
          </div>
          <div className="panel">
            {list.length === 0 ? <EmptyState compact icon="search" title={__sharedTr("No users match")}>{"" + __sharedTr("Try another name, role or team.") + ""}</EmptyState> : (
              <div className="table-wrap">
                <table className="dt hover">
                  <thead><tr><th scope="col">{"" + __sharedTr("User") + ""}</th><th scope="col">{"" + __sharedTr("Role") + ""}</th><th scope="col">{"" + __sharedTr("Primary team") + ""}</th><th scope="col">{"" + __sharedTr("استان") + ""}</th><th scope="col">{"" + __sharedTr("Assisting") + ""}</th><th scope="col">{"" + __sharedTr("Email") + ""}</th><th scope="col">{"" + __sharedTr("Status") + ""}</th></tr></thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id}>
                        <td className="title"><Who id={p.id} /></td>
                        <td>{roleText(p.role)}</td>
                        <td>{teamText(p.team)}</td><td>{p.province ? provinceText(p.province) : __sharedTr("تعیین‌نشده")}</td>
                        <td>{p.assist ? teamText(p.assist) : <span className="muted">—</span>}</td>
                        <td className="muted">{p.email}</td>
                        <td><span className="badge dot success">{"" + __sharedTr("Active") + ""}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <Panel title={__sharedTr("Role permissions")} meta={__sharedTr("Enforced by the server; the interface only offers allowed actions")}>
          <div className="table-wrap">
            <table className="dt hover perm">
              <thead><tr><th scope="col">{"" + __sharedTr("Capability") + ""}</th>{ROLES.map((r) => <th key={r} scope="col">{roleText(r)}</th>)}</tr></thead>
              <tbody>
                {PERMISSIONS.map(([cap, ...cells]) => (
                  <tr key={cap}>
                    <th scope="row" className="title">{__sharedTr(cap)}</th>
                    {cells.map((c, i) => (
                      <td key={i}>{c ? <span className="perm-yes"><Icon name="check" size="sm" />{__sharedTr(c)}</span> : <span className="muted" aria-label={__sharedTr("Not allowed")}>—</span>}</td>
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
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState("light");
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  useEffect(() => { setTheme(currentTheme()); syncThemeColor(); }, []);
  const checkCaps = (e) => setCaps(e.getModifierState?.("CapsLock") ?? false);
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
          <LanguageSwitcher />
          <ThemeChooser variant="dots" value={theme} onChange={changeTheme} />
        </div>
        <form className="login-form" onSubmit={submit}>
          <div className="login-title">
            <span className="eyebrow">{t("Security Department workspace")}</span>
            <h1>{t("Welcome back")}</h1>
            <p className="sec">{t("Sign in to pick up your tasks, shifts and reports.")}</p>
          </div>
          <Field label={t("Work email")} htmlFor="email">
            <div className="input-wrap">
              <Icon name="mail" />
              <input id="email" name="email" type="email" className="input input-lg" placeholder="name@company" autoComplete="username" inputMode="email" required autoFocus aria-invalid={!!error || undefined} readOnly={busy} />
            </div>
          </Field>
          <Field label={t("Password")} htmlFor="password">
            <div className="input-wrap">
              <Icon name="lock" />
              <input id="password" name="password" className="input input-lg" type={showPw ? "text" : "password"} autoComplete="current-password" required aria-invalid={!!error || undefined} aria-describedby={caps ? "caps-hint" : undefined} readOnly={busy} onKeyDown={checkCaps} onKeyUp={checkCaps} onBlur={() => setCaps(false)} />
              <button type="button" className="input-action" aria-pressed={showPw} title={t(showPw ? "Hide password" : "Show password")} onClick={() => setShowPw((v) => !v)}>
                <Icon name={showPw ? "eyeOff" : "eye"} /><span className="sr-only">{t(showPw ? "Hide password" : "Show password")}</span>
              </button>
            </div>
            {caps && <span id="caps-hint" className="field-hint caps-hint"><Icon name="alert" size="sm" />{t("Caps Lock is on")}</span>}
          </Field>
          <FormAlert>{t(error)}</FormAlert>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? t("Signing in…") : <>{t("Sign in")}<Icon name="arrowRight" /></>}</button>
          <p className="muted small">{t("Trouble signing in? Ask your administrator to reset your password.")}</p>
        </form>
        <p className="login-foot muted small"><Icon name="lock" size="sm" />{t("Internal use only · Security Department")}</p>
      </main>
      <aside className="login-r" aria-hidden="true">
        <div className="login-grid" />
        <div className="radar">
          <span className="radar-ring r1" /><span className="radar-ring r2" /><span className="radar-ring r3" />
          <span className="radar-sweep" />
          <span className="radar-blip b1" /><span className="radar-blip b2" /><span className="radar-blip b3" />
          <span className="radar-core"><Icon name="brand" /></span>
        </div>
        <div className="login-chip c1"><span><Icon name="tasks" /></span>{t("Review workflow")}</div>
        <div className="login-chip c2"><span><Icon name="shift" /></span>{t("SOC Shift Log")}</div>
        <div className="login-chip c3"><span><Icon name="report" /></span>{t("Excel reports")}</div>
        <div className="login-copy">
          <div className="eyebrow">{t("Security Department")}</div>
          <p className="statement">{t("Every task, every shift —")} <em>{t("in one calm place.")}</em></p>
          <ul>
            <li><Icon name="tasks" />{t("Assign, review and approve work with a clear workflow.")}</li>
            <li><Icon name="shift" />{t("Keep the daily SOC Shift Log, IOCs and tickets together.")}</li>
            <li><Icon name="report" />{t("See what the team accomplished, with Excel-ready reports.")}</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
