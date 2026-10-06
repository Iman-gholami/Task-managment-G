"use client";

import { useEffect, useState } from "react";

// Colour tokens the charts read from CSS. Only tokens that hold plain hex values are listed:
// the chart engine paints on its own and can't resolve color-mix() expressions.
const VARS = [
  "text", "text-2", "text-3", "divider", "border", "border-strong", "surface-card", "surface-raised",
  "viz-1", "viz-2", "viz-3", "viz-4", "viz-bar", "viz-bar-strong", "viz-track",
  "primary", "accent", "success", "warning", "danger", "info",
  "shift-morning", "shift-evening", "shift-night", "cat-1", "cat-2", "cat-3", "cat-4",
];

function read(el) {
  const cs = getComputedStyle(el);
  const t = Object.fromEntries(VARS.map((v) => [v, cs.getPropertyValue(`--${v}`).trim()]));
  const fa = cs.getPropertyValue("--font-vazirmatn").trim();
  t.font = `${fa ? `${fa}, ` : ""}Tahoma, sans-serif`;
  t.cat = [t["cat-1"], t["cat-2"], t["cat-3"], t["cat-4"]];
  t.ramp = [t["viz-1"], t["viz-2"], t["viz-3"], t["viz-4"]];
  return t;
}

/** Tokens of the current theme. */
export const currentTokens = () => read(document.documentElement);

/** Tokens of the light theme, whatever the page shows (image export, print). */
export function lightTokens() {
  const probe = document.createElement("div");
  probe.setAttribute("data-theme", "light");
  probe.hidden = true;
  document.body.appendChild(probe);
  const t = read(probe);
  probe.remove();
  return t;
}

/** Re-reads tokens whenever the theme changes, so charts follow the theme picker (and print). */
export function useChartTokens() {
  const [tokens, setTokens] = useState(null);
  useEffect(() => {
    const update = () => setTokens(currentTokens());
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return tokens;
}
