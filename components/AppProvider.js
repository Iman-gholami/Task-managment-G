"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { SOC_TEAMS, dashboardFor } from "@/lib/roles";
import { isOpen } from "@/lib/format";
import Icon from "@/components/ui/Icon";
import Popover from "@/components/ui/Popover";
import TooltipLayer from "@/components/ui/Tooltip";

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

/** Error from the app's API. `kind` is "network" when the server couldn't be reached; `status` is the HTTP status otherwise. */
export class ApiError extends Error {
  constructor(message, { status = 0, kind = "http" } = {}) {
    super(message);
    this.status = status;
    this.kind = kind;
  }
}

/** JSON fetch helper for the app's API. Throws ApiError with a user-facing message on failure. `body` may be FormData. */
export async function api(url, { method = "GET", body } = {}) {
  const form = typeof FormData !== "undefined" && body instanceof FormData;
  let res;
  try {
    res = await fetch(url, { method, headers: body && !form ? { "Content-Type": "application/json" } : undefined, body: body ? (form ? body : JSON.stringify(body)) : undefined });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", { kind: "network" });
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith("/api/auth/")) window.location.href = "/login";
  if (!res.ok) {
    const fallback = res.status >= 500 ? "The server couldn't complete the request. Try again in a moment." : "Something went wrong. Try again.";
    throw new ApiError(json.error || fallback, { status: res.status });
  }
  return json;
}

const TOAST_MS = { success: 3200, info: 4500, error: 6500 };

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
  const [theme, setThemeState] = useState("light");
  const [collapsed, setCollapsedState] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [popover, setPopover] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const toastId = useRef(0);
  const popoverId = useRef(0);

  // Restore per-viewer preferences after hydration (the theme attribute is set before paint in app/layout.js).
  useEffect(() => {
    setThemeState(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
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

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  /** toast(message) confirms; toast(message, "error" | "info") for failures and notes. */
  const toast = useCallback((message, tone = "success") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, message, tone }]);
    setTimeout(() => dismissToast(id), TOAST_MS[tone] ?? TOAST_MS.success);
  }, [dismissToast]);

  /** Open a menu anchored to `anchor`; opening it again from the same anchor closes it. See components/ui/Popover. */
  const openPopover = useCallback((anchor, options) => {
    setPopover((p) => (p?.anchor === anchor && !options.force ? null : { ...options, anchor, key: ++popoverId.current }));
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
      toast(e.message, "error");
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

  const peopleMap = useMemo(() => Object.fromEntries(data.users.map((u) => [u.id, u])), [data.users]);

  const value = useMemo(
    () => ({ ...data, dispatch, role, peopleMap, members, theme, setTheme, collapsed, setCollapsed, toast, openPopover, closePopover, createOpen, setCreateOpen, addTask, updateTask }),
    [data, role, peopleMap, members, theme, setTheme, collapsed, setCollapsed, toast, openPopover, closePopover, createOpen, addTask, updateTask]
  );

  // React's special `key` prop must be passed directly, never through a spread object.
  const { key: popoverKey, ...popoverProps } = popover ?? {};

  return (
    <AppContext.Provider value={value}>
      {children}
      {popover && <Popover key={popoverKey} {...popoverProps} onClose={closePopover} />}
      <TooltipLayer />
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" data-tone={t.tone} role={t.tone === "error" ? "alert" : "status"}>
            <span className="t-icon"><Icon name={t.tone === "error" ? "alert" : t.tone === "info" ? "info" : "checkCircle"} /></span>
            <span>{t.message}</span>
            <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label="Dismiss notification" onClick={() => dismissToast(t.id)}><Icon name="x" size="sm" /></button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
