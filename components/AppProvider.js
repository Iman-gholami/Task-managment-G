"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { initialActivities, initialTasks, initialTickets, P } from "@/lib/data";
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
    case "shift/complete":
      return { ...state, shiftDone: action.value };
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

export default function AppProvider({ children }) {
  const [data, dispatch] = useReducer(reducer, { tasks: initialTasks, activities: initialActivities, tickets: initialTickets, shiftDone: false });
  const [role, setRoleState] = useState("analyst");
  const [theme, setThemeState] = useState("dark");
  const [collapsed, setCollapsedState] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [popover, setPopover] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const toastId = useRef(0);

  // Restore per-viewer preferences after hydration.
  useEffect(() => {
    setRoleState(readPref("so.role", "analyst"));
    setThemeState(document.documentElement.dataset.theme || "dark");
    setCollapsedState(readPref("so.collapsed", "0") === "1");
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    writePref("so.theme", t);
  }, []);
  const setRole = useCallback((r) => {
    setRoleState(r);
    writePref("so.role", r);
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

  const addTask = useCallback((fields) => {
    const max = Math.max(...data.tasks.map((t) => Number(t.id.slice(2))));
    const task = { id: `T-${max + 1}`, status: "todo", due: "—", hours: 0, quality: null, upd: "now", team: P[fields.a].team, ...fields };
    dispatch({ type: "task/add", task });
    return task;
  }, [data.tasks]);

  const value = useMemo(
    () => ({ ...data, dispatch, role, setRole, theme, setTheme, collapsed, setCollapsed, toast, openPopover, closePopover, createOpen, setCreateOpen, addTask }),
    [data, role, setRole, theme, setTheme, collapsed, setCollapsed, toast, openPopover, closePopover, createOpen, addTask]
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
