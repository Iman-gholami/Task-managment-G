"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";

/**
 * Anchored menu or panel (opened through `openPopover` from AppProvider).
 * - `items`: [{ value, label, kbd?, hint?, icon?, danger?, checked? } | { separator: true }] renders a keyboard menu:
 *   ↑/↓ move, Enter picks, digits pick items that show a digit shortcut, Esc closes.
 *   Items with `checked` (true/false) are radio items (`menuitemradio`) and show a check mark when chosen.
 * - `render(close)`: custom content (notifications, profile).
 * Placement flips above the anchor when there is no room below; focus returns to the anchor on close.
 */
export default function Popover({ anchor, title, header, items, render, onPick, onClose, width, align = "start", label }) {
  const ref = useRef(null);
  const uid = useId();
  const [pos, setPos] = useState(null);
  const actionable = items ? items.filter((it) => !it.separator) : [];
  // Radio menus open on the chosen item.
  const [hl, setHl] = useState(() => Math.max(0, actionable.findIndex((it) => it.checked)));

  const close = (restoreFocus = true) => {
    onClose();
    if (restoreFocus && anchor?.isConnected) anchor.focus({ preventScroll: true });
  };
  const pick = (value) => { close(); onPick?.(value); };

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const el = ref.current;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = align === "end" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    let up = false;
    if (top + h > window.innerHeight - 8) {
      if (r.top - h - 6 >= 8) { top = r.top - h - 6; up = true; }
      else top = Math.max(8, window.innerHeight - h - 8);
    }
    setPos({ left, top, up });
    el.focus({ preventScroll: true });
  }, [anchor, align]);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target) && !anchor.contains(e.target)) close(false); };
    const onEsc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    const onScroll = (e) => { if (ref.current && !ref.current.contains(e.target)) close(false); };
    const onResize = () => close(false);
    // Defer so the click that opened the popover doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener("mousedown", onDown));
    document.addEventListener("keydown", onEsc, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  });

  const onKeyDown = (e) => {
    if (e.key === "Tab" && !render) { close(); return; } // menus close on Tab; focus moves on from the trigger
    if (!items) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHl((h) => (h + 1) % actionable.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => (h - 1 + actionable.length) % actionable.length); }
    else if (e.key === "Home") { e.preventDefault(); setHl(0); }
    else if (e.key === "End") { e.preventDefault(); setHl(actionable.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (actionable[hl]) pick(actionable[hl].value); }
    else {
      const hit = actionable.find((it) => it.kbd && it.kbd === e.key);
      if (hit) { e.preventDefault(); pick(hit.value); }
    }
  };

  const style = { width, left: pos?.left ?? -9999, top: pos?.top ?? -9999 };
  const optionId = (i) => `${uid}-o${i}`;
  let n = -1;

  return (
    <div
      ref={ref}
      className={`pop ${pos?.up ? "up" : ""}`}
      style={style}
      role={items ? "menu" : "dialog"}
      aria-label={label ?? title}
      aria-activedescendant={items && actionable.length ? optionId(hl) : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {title && <div className="ph" aria-hidden="true">{title}</div>}
      {header}
      {render
        ? render(close)
        : items.map((it, i) => {
            if (it.separator) return <div key={`sep-${i}`} className="sep" role="separator" />;
            const idx = ++n;
            return (
              <div
                key={it.value}
                id={optionId(idx)}
                role={it.checked === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={it.checked}
                className={`mi ${idx === hl ? "hl" : ""} ${it.danger ? "danger" : ""} ${it.checked ? "checked" : ""}`}
                onMouseEnter={() => setHl(idx)}
                onClick={() => pick(it.value)}
              >
                {it.icon}
                {it.label}
                {it.hint && <span className="hint">{it.hint}</span>}
                {it.checked && <Icon name="check" className="i mi-check" />}
                {it.kbd && <kbd>{it.kbd}</kbd>}
              </div>
            );
          })}
    </div>
  );
}
