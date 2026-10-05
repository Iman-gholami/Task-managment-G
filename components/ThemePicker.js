"use client";

import { useRef } from "react";
import { THEMES } from "@/lib/themes";
import { centerOf } from "@/components/theme";
import Icon from "@/components/ui/Icon";

// Preview colours come from lib/themes.js, so a preview always shows its own theme, whatever theme is active.
const vars = (t) => ({
  "--sw-bg": t.swatch.bg,
  "--sw-surface": t.swatch.surface,
  "--sw-line": t.swatch.line,
  "--sw-text": t.swatch.text,
  "--sw-primary": t.swatch.primary,
  "--sw-accent": t.swatch.accent,
});

/** Miniature of a theme: app background, sidebar, a card with text lines and a primary button. Decorative. */
export function ThemePreview({ theme, size = "md" }) {
  return (
    <span className={`theme-preview ${size}`} style={vars(theme)} aria-hidden="true">
      <span className="tp-side"><i /><i /><i /></span>
      <span className="tp-main">
        <span className="tp-card"><i /><i /></span>
        <span className="tp-btn" />
      </span>
    </span>
  );
}

/** Round chip: the theme's background ringed by its signature gradient. Decorative. */
export function ThemeDot({ theme }) {
  return <span className="theme-dot" style={vars(theme)} aria-hidden="true" />;
}

/**
 * Theme radio group. `variant="cards"` shows large previews (Account › Appearance);
 * `variant="dots"` shows compact round swatches (sign-in page).
 * Arrow keys move and select, like a native radio group. `onChange(id, origin)` gets the
 * pointer or focus position so the new theme can spread from it.
 */
export function ThemeChooser({ value, onChange, variant = "cards", label = "Theme" }) {
  const refs = useRef([]);
  const move = (e, i) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const n = (i + step + THEMES.length) % THEMES.length;
    refs.current[n]?.focus();
    onChange(THEMES[n].id, centerOf(refs.current[n]));
  };
  // A keyboard "click" has detail 0 and no pointer position; use the control's centre instead.
  const pick = (t, e) => onChange(t.id, e.detail ? { x: e.clientX, y: e.clientY } : centerOf(e.currentTarget));
  const selected = THEMES.some((t) => t.id === value) ? value : THEMES[0].id;

  return (
    <div className={variant === "dots" ? "theme-dots" : "theme-gallery"} role="radiogroup" aria-label={label}>
      {THEMES.map((t, i) => {
        const on = t.id === selected;
        const common = {
          ref: (el) => { refs.current[i] = el; },
          type: "button",
          role: "radio",
          "aria-checked": on,
          tabIndex: on ? 0 : -1,
          onClick: (e) => pick(t, e),
          onKeyDown: (e) => move(e, i),
        };
        if (variant === "dots") {
          return (
            <button key={t.id} {...common} className="theme-dot-btn" aria-label={t.name} title={t.name}>
              <ThemeDot theme={t} />
            </button>
          );
        }
        return (
          <button key={t.id} {...common} className="theme-card">
            <ThemePreview theme={t} size="lg" />
            <span className="theme-card-meta">
              <b>{t.name}</b>
              <small>{t.note}</small>
            </span>
            <span className="theme-card-check" aria-hidden="true"><Icon name="check" size="sm" /></span>
          </button>
        );
      })}
    </div>
  );
}

/** Menu items for the top bar's theme menu (see Popover `items`). Digits 1–4 pick a theme while it is open. */
export const themeMenuItems = (current) =>
  THEMES.map((t, i) => ({
    value: t.id,
    icon: <ThemePreview theme={t} size="sm" />,
    label: <span className="theme-mi"><b>{t.name}</b><small>{t.note}</small></span>,
    checked: t.id === current,
    kbd: String(i + 1),
  }));
