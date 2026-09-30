"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DELAY = 400;
const GAP = 6;

/**
 * One tooltip for the whole app. Any element with `data-tooltip="…"` gets a tooltip on hover
 * (after a short delay) or on keyboard focus. `data-tooltip-side="right|bottom"` changes placement.
 * It renders in a fixed layer, so scroll containers and overflow never clip it.
 * Tooltips only repeat information: icon buttons still need aria-label, charts an aria-label.
 */
export default function TooltipLayer() {
  const [tip, setTip] = useState(null);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    let timer = 0;
    let current = null;
    let warm = false; // once one tooltip is showing, neighbours open instantly
    const hide = () => { clearTimeout(timer); current = null; warm = false; setTip(null); };
    const show = (el, immediate) => {
      clearTimeout(timer);
      current = el;
      const run = () => {
        const text = el.getAttribute("data-tooltip");
        if (!text || !el.isConnected) return;
        warm = true;
        setTip({ text, rect: el.getBoundingClientRect(), side: el.getAttribute("data-tooltip-side") || "top" });
      };
      if (immediate || warm) run();
      else timer = setTimeout(run, DELAY);
    };
    const onOver = (e) => {
      if (e.pointerType === "touch") return;
      const el = e.target.closest?.("[data-tooltip]");
      if (el === current) return;
      if (!el) hide();
      else show(el, false);
    };
    const onFocus = (e) => {
      const el = e.target.closest?.("[data-tooltip]");
      if (el && e.target.matches(":focus-visible")) show(el, true);
    };
    const onKey = (e) => { if (e.key === "Escape") hide(); };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tip || !ref.current) return setPos(null);
    const { width: w, height: h } = ref.current.getBoundingClientRect();
    const r = tip.rect;
    let left, top;
    if (tip.side === "right") {
      left = r.right + GAP + 2;
      top = r.top + r.height / 2 - h / 2;
    } else {
      left = r.left + r.width / 2 - w / 2;
      top = tip.side === "bottom" || r.top - h - GAP < 4 ? r.bottom + GAP : r.top - h - GAP;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    top = Math.max(4, Math.min(top, window.innerHeight - h - 4));
    setPos({ left, top });
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={ref} className="tooltip" role="tooltip" style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}>
      {tip.text}
    </div>
  );
}
