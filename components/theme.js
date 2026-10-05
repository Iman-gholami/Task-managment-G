"use client";

import { THEME_KEY, isTheme, themeById } from "@/lib/themes";

/** The theme currently on <html> (set before first paint by app/layout.js). */
export function currentTheme() {
  const t = document.documentElement.dataset.theme;
  return isTheme(t) ? t : "light";
}

/** Keeps the browser UI colour (mobile address bar, PWA title bar) in step with the theme. */
export function syncThemeColor(id = currentTheme()) {
  const color = themeById(id).swatch.bg;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
}

function commit(id) {
  document.documentElement.dataset.theme = id;
  syncThemeColor(id);
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {}
}

/** Centre of an element, used as the reveal origin when a theme is picked with the keyboard. */
export function centerOf(el) {
  const r = el?.getBoundingClientRect?.();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

/**
 * Applies and remembers a theme. With an `origin` ({ x, y } in viewport pixels) the new theme spreads
 * from that point in a circle, where the browser supports view transitions and motion is allowed.
 */
export function applyTheme(id, origin) {
  if (!isTheme(id)) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!origin || reduce || id === currentTheme() || typeof document.startViewTransition !== "function") {
    commit(id);
    return;
  }
  const { x, y } = origin;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(() => commit(id));
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 560, easing: "cubic-bezier(.2, 0, 0, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    })
    .catch(() => {});
}
