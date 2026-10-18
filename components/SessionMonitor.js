"use client";

import { useEffect } from "react";
import { SESSION_IDLE_MS, SESSION_PING_MS } from "@/lib/session-policy";

/**
 * Reports deliberate user activity without extending an idle session from
 * polling, hidden tabs, or background fetches. Server-side checks are authoritative.
 */
export default function SessionMonitor() {
  useEffect(() => {
    let mounted = true;
    let lastActivityAt = Date.now();
    let lastPingAt = 0;
    let pending = false;
    let redirecting = false;

    const leave = () => {
      if (redirecting || !mounted) return;
      redirecting = true;
      window.location.replace("/login");
    };

    const channel = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("sentinel-session-activity")
      : null;
    if (channel) {
      channel.onmessage = (event) => {
        const at = event.data;
        if (typeof at === "number" && at <= Date.now() && at > lastActivityAt) {
          lastActivityAt = at;
        }
      };
      channel.postMessage(lastActivityAt);
    }

    const ping = async () => {
      if (!mounted || redirecting || pending) return;
      pending = true;
      lastPingAt = Date.now();
      try {
        const response = await fetch("/api/auth/activity", { method: "POST", cache: "no-store" });
        if (response.status === 401) leave();
      } catch {
        // Temporary network failures must not falsely sign users out.
      } finally {
        pending = false;
      }
    };

    const onActivity = () => {
      if (redirecting || document.visibilityState === "hidden") return;
      const now = Date.now();
      // Interaction after the idle deadline must not restore the session.
      if (now - lastActivityAt >= SESSION_IDLE_MS) return leave();
      lastActivityAt = now;
      channel?.postMessage(now);
      if (now - lastPingAt >= SESSION_PING_MS) void ping();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastActivityAt >= SESSION_IDLE_MS) leave();
    };
    const checkIdle = () => {
      if (Date.now() - lastActivityAt >= SESSION_IDLE_MS) leave();
    };

    for (const name of ["pointerdown", "keydown", "wheel", "touchstart"]) {
      document.addEventListener(name, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    // A page visit is activity only when the server still considers the session valid.
    void ping();
    const timer = window.setInterval(checkIdle, 15_000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      for (const name of ["pointerdown", "keydown", "wheel", "touchstart"]) {
        document.removeEventListener(name, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      channel?.close();
    };
  }, []);

  return null;
}
