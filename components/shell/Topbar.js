"use client";

import Link from "next/link";
import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/layout";
import { Notice } from "@/components/ui/states";
import { TODAY, addDays, isOpen } from "@/lib/format";
import { inTeamScope, isManager } from "@/lib/roles";

// Notification kinds, derived from live task data (there is no separate notification store).
const KINDS = {
  returned: { label: "Task returned for changes", icon: "arrowLeft", tone: "var(--warning)" },
  review: { label: "Waiting for your review", icon: "review", tone: "var(--violet)" },
  overdue: { label: "Overdue", icon: "flag", tone: "var(--danger)" },
  soon: { label: "Deadline approaching", icon: "clock", tone: "var(--warning)" },
  assigned: { label: "New task assigned", icon: "inbox", tone: "var(--info)" },
};

function useNotifications() {
  const { tasks, me, peopleMap } = useApp();
  const manager = isManager(me);
  const list = [];
  for (const t of tasks) {
    const mine = t.a === me.id;
    if (mine && t.status === "returned") list.push(["returned", t]);
    else if (manager && t.status === "review" && !mine && (t.createdBy === me.id || inTeamScope(me, peopleMap[t.a]))) list.push(["review", t]);
    else if (mine && isOpen(t) && t.due !== "—" && t.due < TODAY) list.push(["overdue", t]);
    else if (mine && isOpen(t) && t.due !== "—" && t.due <= addDays(TODAY, 2)) list.push(["soon", t]);
    else if (mine && t.status === "todo" && t.createdBy && t.createdBy !== me.id) list.push(["assigned", t]);
  }
  return list.slice(0, 12);
}

export default function Topbar({ crumbs, onToggleNav, navLabel, navExpanded, onSearch }) {
  const { theme, setTheme, openPopover } = useApp();
  const router = useRouter();
  const notifications = useNotifications();
  const count = notifications.length;

  const openNotifications = (anchor) =>
    openPopover(anchor, {
      label: "Notifications",
      title: count ? `Notifications · ${count}` : "Notifications",
      width: 360,
      align: "end",
      render: (close) =>
        count === 0 ? (
          <Notice icon="checkCircle">You&apos;re all caught up. Nothing needs your attention.</Notice>
        ) : (
          <div className="notif-list">
            {notifications.map(([kind, t]) => (
              <button key={kind + t.id} type="button" className="mi notif" onClick={() => { close(false); router.push(`/tasks/${t.id}`); }}>
                <span className="notif-ic" style={{ color: KINDS[kind].tone }}><Icon name={KINDS[kind].icon} /></span>
                <span className="notif-body">
                  <b>{KINDS[kind].label}</b>
                  <span><span className="mono">{t.id}</span> · {t.title}</span>
                </span>
              </button>
            ))}
          </div>
        ),
    });

  return (
    <header className="header">
      <IconButton icon="side" label={navLabel} aria-controls="sidebar" aria-expanded={navExpanded} onClick={onToggleNav} side="bottom" />
      <nav aria-label="Breadcrumb">
        <ol className="crumbs">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={i}>
                <li>{last ? <span aria-current="page">{c.label}</span> : c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}</li>
                {!last && <li aria-hidden="true"><Icon name="chev" /></li>}
              </Fragment>
            );
          })}
        </ol>
      </nav>
      <div className="header-actions">
        <button type="button" className="cmdk" onClick={onSearch} aria-label="Search and commands" aria-keyshortcuts="Meta+K Control+K">
          <Icon name="search" />
          <span className="cmdk-label">Search tasks, people, pages…</span>
          <kbd>⌘K</kbd>
        </button>
        <button type="button" className="btn btn-ghost icon-btn" style={{ position: "relative" }} aria-label={count ? `Notifications (${count})` : "Notifications"} aria-haspopup="dialog" data-tooltip="Notifications" data-tooltip-side="bottom" onClick={(e) => openNotifications(e.currentTarget)}>
          <Icon name="bell" />
          {count > 0 && <span className="notif-dot" aria-hidden="true" />}
        </button>
        <IconButton icon={theme === "dark" ? "sun" : "moon"} label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} side="bottom" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} />
      </div>
    </header>
  );
}
