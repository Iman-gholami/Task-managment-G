"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";

const POLL_MS = 30_000;

/** The browser must remain open. Polling does not renew an idle session. */
export default function useTaskAssignmentNotifications() {
  const { me, refreshTasks } = useApp();
  const memoryCursor = useRef(0);
  const [permission, setPermission] = useState("checking");
  const [assignments, setAssignments] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const permissionNow = useCallback(() => {
    if (!window.isSecureContext || !("Notification" in window)) return "unavailable";
    return Notification.permission;
  }, []);

  const enable = useCallback(async () => {
    if (permissionNow() !== "default") return;
    try {
      setPermission(await Notification.requestPermission());
      setRefreshKey((value) => value + 1);
    } catch {
      setPermission("unavailable");
    }
  }, [permissionNow]);

  useEffect(() => {
    let active = true;
    let pending = false;
    const key = `so.assignment-notification.${me.id}`;
    const refresh = async () => {
      if (!active || pending) return;
      pending = true;
      try {
        const { notifications } = await api("/api/task-assignments");
        if (!active) return;
        setAssignments(notifications);
        const currentPermission = permissionNow();
        setPermission(currentPermission);

        // Refresh visible tasks as well, so status and ownership changes made
        // by other users are reflected even without desktop permission.
        await refreshTasks();
        if (!active) return;

        if (currentPermission !== "granted") return;
        const show = () => {
          let cursor = memoryCursor.current;
          try { cursor = Math.max(cursor, Number(localStorage.getItem(key)) || 0); } catch {}
          for (const item of notifications) {
            if (item.id <= cursor) continue;
            try {
              const notice = new Notification("New task assigned", { body: `${item.taskId} · ${item.title}`, tag: `task-assignment-${me.id}-${item.id}`, icon: "/icon.svg" });
              notice.onclick = () => { window.focus(); window.location.assign(`/tasks/${encodeURIComponent(item.taskId)}`); notice.close(); };
              cursor = item.id;
              memoryCursor.current = cursor;
              try { localStorage.setItem(key, String(cursor)); } catch {}
            } catch { break; }
          }
        };
        // Locks serialize tabs on browsers that support them; the tag and shared
        // cursor also reduce duplication on browsers without the Locks API.
        if (navigator.locks?.request) await navigator.locks.request(key, show);
        else show();
      } catch {
        // A temporary connection error is retried at the next poll or focus.
      } finally {
        pending = false;
      }
    };
    setPermission(permissionNow());
    void refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [me.id, permissionNow, refreshKey, refreshTasks]);

  return { permission, enable, assignments };
}
