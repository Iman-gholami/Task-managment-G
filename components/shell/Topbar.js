"use client";

import Link from "next/link";
import { Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/layout";
import { Notice } from "@/components/ui/states";
import { themeMenuItems } from "@/components/ThemePicker";
import { centerOf } from "@/components/theme";
import { TODAY, addDays, isOpen } from "@/lib/format";
import { inTeamScope, isManager } from "@/lib/roles";

const OPEN_SHIFT = new Set(["pending_target", "pending_manager"]);
const TASK_KINDS = {
  returned: { label: "Task returned for changes", icon: "arrowLeft", tone: "var(--warning)" },
  review: { label: "Waiting for your review", icon: "review", tone: "var(--violet)" },
  overdue: { label: "Overdue", icon: "flag", tone: "var(--danger)" },
  soon: { label: "Deadline approaching", icon: "clock", tone: "var(--warning)" },
  assigned: { label: "New task assigned", icon: "inbox", tone: "var(--info)" },
};

function useNotifications(shiftRequests = []) {
  const { tasks, me, peopleMap } = useApp();
  const manager = isManager(me);
  const list = [];

  for (const r of shiftRequests) {
    if (r.status === "pending_target" && r.targetId === me.id) {
      list.push({
        key: `shift-target-${r.id}`,
        label: "درخواست تغییر شیفت",
        detail: `${r.requesterName} درخواست جابه‌جایی شیفت داده است`,
        icon: "cal",
        tone: "var(--primary)",
        href: "/shift/changes",
      });
    } else if (manager && OPEN_SHIFT.has(r.status)) {
      list.push({
        key: `shift-manager-${r.id}`,
        label: r.status === "pending_target" ? "درخواست تغییر شیفت جدید" : "تغییر شیفت آماده تأیید",
        detail: `${r.requesterName} ↔ ${r.targetName}`,
        icon: "cal",
        tone: "var(--primary)",
        href: "/shift/changes",
      });
    }
  }

  for (const t of tasks) {
    const mine = t.a === me.id;
    let kind = null;
    if (mine && t.status === "returned") kind = "returned";
    else if (manager && t.status === "review" && !mine && (t.createdBy === me.id || inTeamScope(me, peopleMap[t.a]))) kind = "review";
    else if (mine && isOpen(t) && t.due !== "—" && t.due < TODAY) kind = "overdue";
    else if (mine && isOpen(t) && t.due !== "—" && t.due <= addDays(TODAY, 2)) kind = "soon";
    else if (mine && t.status === "todo" && t.createdBy && t.createdBy !== me.id) kind = "assigned";

    if (kind) {
      const meta = TASK_KINDS[kind];
      list.push({
        key: `${kind}-${t.id}`,
        label: meta.label,
        detail: `${t.id} · ${t.title}`,
        icon: meta.icon,
        tone: meta.tone,
        href: `/tasks/${t.id}`,
      });
    }
  }

  return list.slice(0, 12);
}

export default function Topbar({ crumbs, onToggleNav, navLabel, navExpanded, onSearch }) {
  const { theme, setTheme, openPopover, me } = useApp();
  const router = useRouter();
  const shiftCapable = isManager(me) || !!me?.keepsShiftLog;
  const { data: shiftData, reload: reloadShiftNotifications } = useFetch(shiftCapable ? "/api/shift/changes" : null);
  const notifications = useNotifications(shiftData?.requests ?? []);
  const count = notifications.length;

  useEffect(() => {
    if (!shiftCapable) return undefined;
    const refresh = () => reloadShiftNotifications();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [shiftCapable, reloadShiftNotifications]);

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
            {notifications.map((item) => (
              <button key={item.key} type="button" className="mi notif" onClick={() => { close(false); router.push(item.href); }}>
                <span className="notif-ic" style={{ color: item.tone }}><Icon name={item.icon} /></span>
                <span className="notif-body">
                  <b>{item.label}</b>
                  <span>{item.detail}</span>
                </span>
              </button>
            ))}
          </div>
        ),
    });

  const openThemes = (anchor) =>
    openPopover(anchor, {
      label: "Theme",
      title: "Theme",
      width: 288,
      align: "end",
      items: themeMenuItems(theme),
      onPick: (id) => setTheme(id, centerOf(anchor)),
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
        <IconButton icon="palette" label="Theme" tooltip="Theme" aria-haspopup="menu" side="bottom" onClick={(e) => openThemes(e.currentTarget)} />
      </div>
    </header>
  );
}
