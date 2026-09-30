"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, useApp } from "@/components/AppProvider";
import CreateTaskModal from "@/components/CreateTaskModal";
import Dialog from "@/components/ui/Dialog";
import Icon from "@/components/ui/Icon";
import Sidebar from "@/components/shell/Sidebar";
import Topbar from "@/components/shell/Topbar";
import CommandMenu from "@/components/shell/CommandMenu";
import { crumbsFor, navFor } from "@/components/shell/nav";
import { isOpen } from "@/lib/format";

const DRAWER = "(max-width: 1023px)";
const subscribe = (cb) => { const m = window.matchMedia(DRAWER); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
/** True when the sidebar is an off-canvas drawer (tablet and phone). */
const useDrawer = () => useSyncExternalStore(subscribe, () => window.matchMedia(DRAWER).matches, () => false);

const SHORTCUTS = [
  ["⌘K / Ctrl K", "Search tasks, people and pages"],
  ["C", "Create a task"],
  ["/", "Focus the search field on task lists"],
  ["J / K", "Move through task rows"],
  ["Enter", "Open the selected task"],
  ["S / P", "Change status / priority of the selected task"],
  ["Esc", "Close menus and dialogs"],
];

export default function AppShell({ children }) {
  const { me, collapsed, setCollapsed, setCreateOpen, tasks, peopleMap, openPopover } = useApp();
  const path = usePathname();
  const router = useRouter();
  const drawer = useDrawer();
  const [navOpen, setNavOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const counts = {
    my: tasks.filter((t) => t.a === me.id && isOpen(t)).length,
    assigned: tasks.filter((t) => t.createdBy === me.id && t.a !== me.id && isOpen(t)).length,
  };
  const groups = navFor(me, counts);
  const crumbs = crumbsFor(path, peopleMap, me);

  // Drawer: close on navigation and on Escape; move focus into it when it opens.
  useEffect(() => { setNavOpen(false); }, [path]);
  useEffect(() => {
    if (!navOpen) return;
    document.querySelector("#sidebar .nav-item")?.focus();
    const onKey = (e) => { if (e.key === "Escape") { setNavOpen(false); document.querySelector('[aria-controls="sidebar"]')?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((o) => !o); return; }
      if (e.target.matches("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c" && !document.querySelector(".pop, .scrim")) { e.preventDefault(); setCreateOpen(true); }
      if (e.key === "?" && !document.querySelector(".pop, .scrim")) { e.preventDefault(); setShortcutsOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setCreateOpen]);

  const toggleNav = () => (drawer ? setNavOpen((o) => !o) : setCollapsed(!collapsed));

  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  };

  const openProfile = (anchor) =>
    openPopover(anchor, {
      label: "Account menu",
      width: 240,
      header: (
        <div className="pop-profile">
          <b>{me.name}</b>
          <span>{me.email}</span>
        </div>
      ),
      items: [
        { value: "account", label: "Account & password", icon: <Icon name="user" /> },
        { value: "shortcuts", label: "Keyboard shortcuts", icon: <Icon name="keyboard" />, kbd: "?" },
        { separator: true },
        { value: "signout", label: "Sign out", icon: <Icon name="logout" /> },
      ],
      onPick: (v) => (v === "account" ? router.push("/account") : v === "shortcuts" ? setShortcutsOpen(true) : signOut()),
    });

  return (
    <div className={`app ${collapsed ? "collapsed" : ""} ${navOpen ? "nav-open" : ""}`}>
      <a href="#main" className="btn btn-primary sr-only skip-link">Skip to content</a>
      <div className="nav-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
      <Sidebar groups={groups} path={path} collapsed={collapsed && !drawer} inert={drawer && !navOpen} onProfile={openProfile} />

      <div className="main">
        <Topbar
          crumbs={crumbs}
          onToggleNav={toggleNav}
          navLabel={drawer ? (navOpen ? "Close navigation" : "Open navigation") : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          navExpanded={drawer ? navOpen : !collapsed}
          onSearch={() => setCmdOpen(true)}
        />
        <main className="content" id="main" tabIndex={-1}>
          <div className="route" key={path}>{children}</div>
        </main>
      </div>

      <CreateTaskModal />
      {cmdOpen && <CommandMenu onClose={() => setCmdOpen(false)} />}
      {shortcutsOpen && (
        <Dialog label="Keyboard shortcuts" title="Keyboard shortcuts" onClose={() => setShortcutsOpen(false)} width={440}>
          <div className="modal-body">
            <dl className="shortcuts">
              {SHORTCUTS.map(([k, d]) => <div key={k}><dt>{k.split(" / ").map((x, i) => <kbd key={i}>{x}</kbd>)}</dt><dd>{d}</dd></div>)}
            </dl>
          </div>
        </Dialog>
      )}
    </div>
  );
}
