"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/indicators";
import CreateTaskModal from "@/components/CreateTaskModal";
import { isOpen } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { api } from "@/components/AppProvider";
import { REPORTS } from "@/lib/reports";

const REPORT_NAMES = Object.fromEntries(REPORTS.map(([k, n]) => [k, n]));

function crumbsFor(path) {
  const [a, b] = path.split("/").filter(Boolean);
  switch (a) {
    case "tasks":
      return b === "my" ? ["Tasks", "My Tasks"] : b === "team" ? ["Tasks", "Team Tasks"] : b === "all" ? ["Tasks", "All Tasks"] : ["Tasks", b];
    case "shift":
      return ["Shift Logs", b === "history" ? "History" : "Today"];
    case "team":
      return ["Team"];
    case "performance":
      return b === "employees" ? ["Performance", "Employees", "Sara Rahimi"] : ["Performance", "Overview"];
    case "reports":
      return ["Reports", REPORT_NAMES[b] || "Reports"];
    case "admin":
      return ["Administration", "Users & Roles"];
    case "states":
      return ["System", "States"];
    default:
      return ["Dashboard"];
  }
}

const JUMPS = [
  ["/dashboard", "Dashboard"], ["/tasks/my", "My Tasks"], ["/tasks/team", "Team Tasks"], ["/shift", "Today's Shift Log"],
  ["/performance/employees", "Employee Performance"], ["/reports/tickets", "Ticket Report"], ["/states", "Empty / loading / error states"], ["/login", "Login screen"],
];

const NOTIFICATIONS = [
  ["New task assigned", "T-1042 · by Leila Nouri", "3h"],
  ["Task returned", "T-1033 · changes requested", "1h"],
  ["Mentioned in comment", "T-1038 · Reza Jafari", "1d"],
  ["Deadline approaching", "T-1041 due in 2 days", "1d"],
];

export default function AppShell({ children }) {
  const app = useApp();
  const { me, theme, setTheme, collapsed, setCollapsed, openPopover, setCreateOpen, tasks } = app;
  const path = usePathname();
  const router = useRouter();
  const cmdRef = useRef(null);
  const crumbs = crumbsFor(path);

  const counts = {
    "/tasks/my": tasks.filter((t) => t.a === me.id && isOpen(t)).length,
    "/tasks/team": tasks.filter((t) => t.team.startsWith("SOC") && isOpen(t)).length,
  };
  const NAV = [
    ["/dashboard", "Dashboard", "home"],
    ["/tasks", "Tasks", "tasks", [["/tasks/my", "My Tasks"], ["/tasks/team", "Team Tasks"], ["/tasks/all", "All Tasks"]]],
    ["/shift", "Shift Logs", "shift"],
    ["/team", "Team", "team"],
    ["/performance", "Performance", "perf", [["/performance/overview", "Overview"], ["/performance/employees", "Employees"]]],
    ["/reports", "Reports", "report"],
    ["/admin", "Administration", "admin"],
  ];

  const openCommand = () =>
    openPopover(cmdRef.current, {
      title: "Jump to",
      width: 300,
      items: [...JUMPS.map(([v, l]) => ({ value: v, label: l })), { value: "create", label: <><Icon name="plus" />Create Task</>, kbd: "C" }],
      onPick: (v) => (v === "create" ? setCreateOpen(true) : router.push(v)),
    });

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openCommand(); return; }
      if (e.target.matches("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c" && !document.querySelector(".pop, .scrim")) { e.preventDefault(); setCreateOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand"><span className="brand-mark">S</span><span>Sentinel Ops</span></div>
        {NAV.map(([href, label, icon, subs]) => {
          const on = path === href || path.startsWith(href + "/");
          return (
            <Fragment key={href}>
              <Link className={`nav-item ${on && !subs ? "active" : ""}`} href={subs ? subs[0][0] : href} data-tip={label} aria-current={on && !subs ? "page" : undefined}>
                <Icon name={icon} /><span>{label}</span>
              </Link>
              {subs && on && subs.map(([sh, sl]) => (
                <Link key={sh} className={`nav-item sub ${path === sh ? "active" : ""}`} href={sh} aria-current={path === sh ? "page" : undefined}>
                  <span>{sl}</span>
                  {counts[sh] != null && <span className="count num">{counts[sh]}</span>}
                </Link>
              ))}
            </Fragment>
          );
        })}
        <div className="sidebar-foot">
          <button className="nav-item" style={{ border: 0, background: "none", width: "100%" }} data-tip="Sign out" onClick={signOut}>
            <Icon name="side" /><span>Sign out</span>
          </button>
          <div className="me"><Avatar id={me.id} /><div className="me-meta">{me.name}<small>{ROLE_LABELS[me.role]} · {me.team}</small></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <button className="btn btn-ghost icon-btn" aria-label="Toggle sidebar" onClick={() => setCollapsed(!collapsed)}><Icon name="side" /></button>
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (i === crumbs.length - 1 ? <b key={i}>{c}</b> : <span key={i} style={{ display: "contents" }}>{c}<Icon name="chev" /></span>))}
          </nav>
          <div className="spacer" />
          <div className="cmdk" ref={cmdRef} role="button" tabIndex={0} onClick={openCommand} onKeyDown={(e) => e.key === "Enter" && openCommand()}>
            <Icon name="search" />Search or jump to…<kbd>⌘K</kbd>
          </div>
          <button className="btn btn-ghost icon-btn" aria-label="Notifications" onClick={(e) => openPopover(e.currentTarget, {
            title: "Notifications",
            render: () => NOTIFICATIONS.map(([a, b, w]) => (
              <div key={a} className="mi" style={{ height: "auto", padding: 8, alignItems: "flex-start", width: 320 }}>
                <div><div>{a}</div><div className="muted" style={{ fontSize: 12 }}>{b}</div></div>
                <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>{w}</span>
              </div>
            )),
          })}><Icon name="bell" /></button>
          <button className="btn btn-ghost icon-btn" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name="sun" /></button>
        </header>
        <div className="content">{children}</div>
      </main>
      <CreateTaskModal />
    </div>
  );
}
