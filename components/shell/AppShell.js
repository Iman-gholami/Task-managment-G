"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/indicators";
import CreateTaskModal from "@/components/CreateTaskModal";
import { TODAY, addDays, isOpen } from "@/lib/format";
import { ROLE_LABELS, isManager } from "@/lib/roles";
import { REPORTS } from "@/lib/reports";
import { inTeamScope } from "@/components/screens/Tasks";

const REPORT_NAMES = Object.fromEntries(REPORTS.map(([k, n]) => [k, n]));
const TASK_VIEWS = { my: "My Tasks", assigned: "Assigned by Me", team: "Team Tasks" };

function crumbsFor(path, peopleMap) {
  const [a, b, c] = path.split("/").filter(Boolean);
  switch (a) {
    case "tasks":
      return ["Tasks", TASK_VIEWS[b] ?? b];
    case "shift":
      if (b === "schedule") return ["Shifts", "Schedule"];
      return ["Shift Log", b === "history" ? "History" : "Today"];
    case "team":
      return ["Team"];
    case "performance":
      return b === "employees" ? ["Performance", peopleMap[c]?.name ?? "Employee"] : ["Performance", "Overview"];
    case "reports":
      return ["Reports", REPORT_NAMES[b] || "Reports"];
    case "account":
      return ["Account"];
    case "admin":
      return ["Administration", "Users & Roles"];
    default:
      return ["Dashboard"];
  }
}

/** Notifications derived from live task data. */
function useNotifications() {
  const { tasks, me, peopleMap } = useApp();
  const manager = isManager(me);
  const list = [];
  for (const t of tasks) {
    if (t.a === me.id && t.status === "returned") list.push(["Task returned for changes", t]);
    else if (manager && t.status === "review" && t.a !== me.id && (t.createdBy === me.id || inTeamScope(me, peopleMap[t.a]))) list.push(["Waiting for your review", t]);
    else if (t.a === me.id && isOpen(t) && t.due !== "—" && t.due < TODAY) list.push(["Overdue", t]);
    else if (t.a === me.id && isOpen(t) && t.due !== "—" && t.due <= addDays(TODAY, 2)) list.push(["Deadline approaching", t]);
    else if (t.a === me.id && t.status === "todo" && t.createdBy && t.createdBy !== me.id) list.push(["New task assigned", t]);
  }
  return list.slice(0, 12);
}

export default function AppShell({ children }) {
  const { me, theme, setTheme, collapsed, setCollapsed, openPopover, setCreateOpen, tasks, peopleMap } = useApp();
  const path = usePathname();
  const router = useRouter();
  const cmdRef = useRef(null);
  const crumbs = crumbsFor(path, peopleMap);
  const manager = isManager(me);
  const notifications = useNotifications();
  const [navOpen, setNavOpen] = useState(false);

  // Mobile drawer: close on navigation and on Escape.
  useEffect(() => { setNavOpen(false); }, [path]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);
  const toggleNav = () => (window.matchMedia("(max-width: 1023px)").matches ? setNavOpen((o) => !o) : setCollapsed(!collapsed));

  const counts = {
    "/tasks/my": tasks.filter((t) => t.a === me.id && isOpen(t)).length,
    "/tasks/assigned": tasks.filter((t) => t.createdBy === me.id && t.a !== me.id && isOpen(t)).length,
  };
  const taskViews = manager
    ? [["/tasks/assigned", "Assigned by Me"], ["/tasks/team", "Team Tasks"], ["/tasks/my", "My Tasks"]]
    : [["/tasks/my", "My Tasks"], ["/tasks/team", "Team Tasks"]];
  const shiftViews = [
    manager && ["/shift/schedule", "Schedule"],
    me.keepsShiftLog && ["/shift", "Today"],
    me.keepsShiftLog && ["/shift/history", "History"],
  ].filter(Boolean);
  const NAV = [
    ["/dashboard", "Dashboard", "home"],
    ["/tasks", "Tasks", "tasks", taskViews],
    shiftViews.length && ["/shift", manager ? "Shifts" : "Shift Log", "shift", shiftViews],
    ["/team", "Team", "team"],
    manager ? ["/performance", "Performance", "perf", [["/performance/overview", "Overview"]]] : [`/performance/employees/${me.id}`, "My Performance", "perf"],
    ["/reports", "Reports", "report"],
    manager && ["/admin", "Administration", "shield"],
    ["/account", "Account", "user"],
  ].filter(Boolean);

  const jumps = [
    ["/dashboard", "Dashboard"], ...taskViews,
    manager && ["/shift/schedule", "Shift Schedule"],
    me.keepsShiftLog && ["/shift", "Shift Log"],
    manager ? ["/performance/overview", "Performance"] : [`/performance/employees/${me.id}`, "My Performance"],
    ["/reports/employee", "Reports"], ["/account", "Account & password"],
  ].filter(Boolean);

  const openCommand = () =>
    openPopover(cmdRef.current, {
      title: "Jump to",
      width: 300,
      items: [...jumps.map(([v, l]) => ({ value: v, label: l })), { value: "create", label: <><Icon name="plus" />Create Task</>, kbd: "C" }],
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
    <div className={`app ${collapsed ? "collapsed" : ""} ${navOpen ? "nav-open" : ""}`}>
      <a href="#main" className="btn btn-primary sr-only">Skip to content</a>
      <div className="nav-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
      <aside className="sidebar" id="sidebar" aria-label="Main navigation">
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
            <Icon name="logout" /><span>Sign out</span>
          </button>
          <div className="me"><Avatar id={me.id} /><div className="me-meta">{me.name}<small>{ROLE_LABELS[me.role]} · {me.team}</small></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <button className="btn btn-ghost icon-btn" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded={navOpen} onClick={toggleNav}><Icon name="side" /></button>
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (i === crumbs.length - 1 ? <b key={i}>{c}</b> : <span key={i} style={{ display: "contents" }}>{c}<Icon name="chev" /></span>))}
          </nav>
          <div className="spacer" />
          <div className="cmdk" ref={cmdRef} role="button" tabIndex={0} aria-label="Search or jump to" onClick={openCommand} onKeyDown={(e) => e.key === "Enter" && openCommand()}>
            <Icon name="search" /><span className="cmdk-label">Search or jump to…</span><kbd>⌘K</kbd>
          </div>
          <button className="btn btn-ghost icon-btn" aria-label={notifications.length ? `Notifications (${notifications.length})` : "Notifications"} style={{ position: "relative" }} onClick={(e) => openPopover(e.currentTarget, {
            title: "Notifications",
            render: (close) => notifications.length === 0
              ? <div className="mi muted" style={{ width: 320 }}>You&apos;re all caught up.</div>
              : notifications.map(([title, t]) => (
                <div key={title + t.id} className="mi" style={{ height: "auto", padding: 8, alignItems: "flex-start", width: 320 }} onClick={() => { close(); router.push(`/tasks/${t.id}`); }}>
                  <div><div>{title}</div><div className="muted" style={{ fontSize: 12 }}>{t.id} · {t.title}</div></div>
                </div>
              )),
          })}>
            <Icon name="bell" />
            {notifications.length > 0 && <span className="dot" aria-hidden="true" />}
          </button>
          <button className="btn btn-ghost icon-btn" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
        </header>
        <div className="content" id="main" tabIndex={-1}><div key={path}>{children}</div></div>
      </main>
      <CreateTaskModal />
    </div>
  );
}
