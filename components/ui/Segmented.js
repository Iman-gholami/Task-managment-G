"use client";

import { useRef } from "react";
import Icon from "@/components/ui/Icon";

/**
 * Segmented control. `kind="radio"` (default) for a single choice such as a period or a view;
 * `kind="tabs"` when it switches the content below (task status tabs).
 * Roving focus: Tab enters on the selected option, ←/→/Home/End move and select (mirrored in RTL).
 * options: [{ value, label, icon?, count?, ariaLabel? }]
 */
export default function Segmented({ label, value, onChange, options, kind = "radio", iconOnly, className = "" }) {
  const ref = useRef(null);
  const tabs = kind === "tabs";
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const onKeyDown = (e) => {
    const last = options.length - 1;
    // In right-to-left screens the next option is on the left.
    const step = ref.current && getComputedStyle(ref.current).direction === "rtl" ? -1 : 1;
    const next = { ArrowRight: index + step, ArrowDown: index + 1, ArrowLeft: index - step, ArrowUp: index - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const i = (next + options.length) % options.length;
    onChange(options[i].value);
    ref.current?.querySelectorAll("button")[i]?.focus();
  };

  return (
    <div ref={ref} className={`seg ${iconOnly ? "icon-only" : ""} ${className}`} role={tabs ? "tablist" : "radiogroup"} aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const on = i === index;
        return (
          <button
            key={o.value}
            type="button"
            role={tabs ? "tab" : "radio"}
            aria-selected={tabs ? on : undefined}
            aria-checked={tabs ? undefined : on}
            aria-label={o.ariaLabel}
            data-tooltip={iconOnly ? o.ariaLabel : undefined}
            tabIndex={on ? 0 : -1}
            className={on ? "on" : ""}
            onClick={() => onChange(o.value)}
          >
            {o.icon && <Icon name={o.icon} />}
            {o.label}
            {o.count !== undefined && <span className="count">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
