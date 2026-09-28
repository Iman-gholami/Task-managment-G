"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { P as MOCK_PEOPLE } from "@/lib/data";
import { SOC_TEAMS, dashboardFor } from "@/lib/roles";
import { isOpen } from "@/lib/format";
import Icon from "@/components/ui/Icon";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function reducer(state, action) {
  switch (action.type) {
    case "task/update":
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) };
    case "task/add":
      return { ...state, tasks: [action.task, ...state.tasks] };
    case "activity/update":
      return { ...state, activities: state.activities.map((a) => (a.n === action.n ? { ...a, ...action.patch } : a)) };
    case "ticket/add":
      return { ...state, tickets: [...state.tickets, action.ticket] };
    case "activities/set":
      return { ...state, activities: action.activities };
    case "tickets/set":
      return { ...state, tickets: action.tickets };
    case "shift/complete":
      return { ...state, shiftDone: action.value };
    case "users/add":
      return { ...state, users: [...state.users, action.user].sort((a, b) => a.name.localeCompare(b.name)) };
    case "users/update":
      return { ...state, users: state.users.map((u) => (u.id === action.user.id ? { ...u, ...action.user } : u)) };
    case "users/deactivate":
      return { ...state, users: state.users.map((u) => (u.id === action.id ? { ...u, active: false } : u)) };
    default:
      return state;
  }
}

function readPref(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** JSON fetch helper for the app's API. Throws Error(message) on non-2xx. `body` may be FormData. */
export async function api(url, { method = "GET", body } = {}) {
  const form = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, { method, headers: body && !form ? { "Content-Type": "application/json" } : undefined, body: body ? (form ? body : JSON.stringify(body)) : undefined });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith("/api/auth/")) window.location.href = "/login";
  if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
  return json;
}

export default function AppProvider({ children, initial }) {
  const [data, dispatch] = useReducer(reducer, {
    me: initial.me,
    users: initial.users,
    tasks: initial.tasks,
    activities: initial.shift.activities,
    tickets: initial.shift.tickets,
    shiftDone: !!initial.shift.completedAt,
    shiftDate: initial.shift.date,
    stats: initial.stats,
  });
  const role = dashboardFor(initial.me);
  const [theme, setThemeState] = useState("dark");
  const [collapsed, setCollapsedState] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [popover, setPopover] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const toastId = useRef(0);

  // Restore per-viewer preferences after hydration.
  useEffect(() => {
    setThemeState(document.documentElement.dataset.theme || "dark");
    setCollapsedState(readPref("so.collapsed", "0") === "1");
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    writePref("so.theme", t);
  }, []);
  const setCollapsed = useCallback((c) => {
    setCollapsedState(c);
    writePref("so.collapsed", c ? "1" : "0");
  }, []);

  const toast = useCallback((message) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  /** Open a menu anchored under `anchor`. `items`: [{ value, label, kbd }] or `render()` for custom content. */
  const openPopover = useCallback((anchor, options) => {
    const r = anchor.getBoundingClientRect();
    setPopover({ ...options, left: Math.min(r.left, window.innerWidth - 340), top: r.bottom + 6 });
  }, []);
  const closePopover = useCallback(() => setPopover(null), []);

  const addTask = useCallback(async (fields) => {
    const { task } = await api("/api/tasks", { method: "POST", body: fields });
    dispatch({ type: "task/add", task });
    return task;
  }, []);

  /** Optimistic task update; reverts and reports on failure. */
  const updateTask = useCallback(async (task, patch) => {
    dispatch({ type: "task/update", id: task.id, patch: { ...patch, upd: "now" } });
    try {
      const res = await api(`/api/tasks/${task.id}`, { method: "PATCH", body: patch });
      dispatch({ type: "task/update", id: task.id, patch: res.task });
      return true;
    } catch (e) {
      dispatch({ type: "task/update", id: task.id, patch: task });
      toast(e.message);
      return false;
    }
  }, [toast]);

  /** Active members enriched with live workload and today's shift status. */
  const members = useMemo(() => data.users.filter((u) => u.active).map((u) => {
    const open = data.tasks.filter((t) => t.a === u.id && isOpen(t)).length;
    const isShiftAnalyst = u.role === "analyst" && SOC_TEAMS.includes(u.team);
    const shift = u.id === data.me.id ? (data.shiftDone ? "completed" : initial.shiftStatus[u.id]) : initial.shiftStatus[u.id];
    return { ...u, open, load: Math.min(100, Math.round((open / 6) * 100)), shift: isShiftAnalyst ? shift ?? "missing" : null };
  }), [data.users, data.tasks, data.me.id, data.shiftDone, initial.shiftStatus]);

  const peopleMap = useMemo(() => ({ ...MOCK_PEOPLE, ...Object.fromEntries(data.users.map((u) => [u.id, u])) }), [data.users]);

  const value = useMemo(
    () => ({ ...data, dispatch, role, peopleMap, members, theme, setTheme, collapsed, setCollapsed, toast, openPopover, closePopover, createOpen, setCreateOpen, addTask, updateTask }),
    [data, role, peopleMap, members, theme, setTheme, collapsed, setCollapsed, toast, openPopover, closePopover, createOpen, addTask, updateTask]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {popover && <Popover {...popover} onClose={closePopover} />}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span className="ok"><Icon name="check" /></span>
            {t.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

function Popover({ left, top, title, items, render, onPick, onClose, width }) {
  const ref = useRef(null);
  const [hl, setHl] = useState(0);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => {
      if (e.key === "Escape") return onClose();
      if (!items) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setHl((h) => Math.min(items.length - 1, h + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => Math.max(0, h - 1)); }
      if (e.key === "Enter") { e.preventDefault(); pick(items[hl].value); }
      const n = Number(e.key);
      if (n >= 1 && n <= items.length && items[n - 1].kbd === String(n)) pick(items[n - 1].value);
    };
    const pick = (v) => { onClose(); onPick?.(v); };
    // Defer so the click that opened the popover doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener("mousedown", onDown));
    document.addEventListener("keydown", onKey, true);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey, true); };
  }, [items, hl, onClose, onPick]);

  return (
    <div className="pop" ref={ref} style={{ left, top, width }} role="menu">
      {title && <div className="ph">{title}</div>}
      {render
        ? render(onClose)
        : items.map((it, i) => (
            <div key={it.value} role="menuitem" className={`mi ${i === hl ? "hl" : ""}`} onMouseEnter={() => setHl(i)} onClick={() => { onClose(); onPick?.(it.value); }}>
              {it.label}
              {it.kbd && <kbd>{it.kbd}</kbd>}
            </div>
          ))}
    </div>
  );
}
