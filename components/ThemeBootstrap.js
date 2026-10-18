"use client";

import { useLayoutEffect } from "react";
import { THEME_IDS, THEME_KEY } from "@/lib/themes";
import { applyTheme } from "@/components/theme";

/**
 * Initialize the persisted theme during client hydration without rendering any
 * script tags. React 19 warns about scripts created inside React components.
 * useLayoutEffect runs before the browser repaints after hydration.
 */
export default function ThemeBootstrap() {
  useLayoutEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      // Storage can be disabled in a browser; follow the OS preference instead.
    }
    const initial = THEME_IDS.includes(saved)
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    applyTheme(initial);
  }, []);

  return null;
}
