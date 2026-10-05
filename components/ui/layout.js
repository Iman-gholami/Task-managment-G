"use client";

import { useId } from "react";
import Icon from "@/components/ui/Icon";

/**
 * Page header: Level 1 identity (title), quiet context line (`meta`: string or list, joined with "·"),
 * and the page's actions on the right. `leading` sits before the title (avatar on profile pages);
 * `eyebrow` is a short line above the title (the greeting on dashboards).
 */
export function PageHeader({ title, meta, actions, leading, eyebrow }) {
  const parts = (Array.isArray(meta) ? meta : [meta]).filter((m) => m !== null && m !== undefined && m !== false && m !== "");
  return (
    <header className="page-head">
      <div className="page-head-main">
        {leading}
        <div>
          {eyebrow !== undefined && <span className="page-eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {parts.length > 0 && <p className="page-meta">{parts.map((m, i) => <span key={i}>{m}</span>)}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

/** Card section with a header (title · meta · actions), body and optional footer. */
export function Panel({ title, meta, actions, footer, children, className = "", ...rest }) {
  const id = useId();
  return (
    <section className={`panel ${className}`} aria-labelledby={title ? id : undefined} {...rest}>
      {title && (
        <div className="panel-head">
          <h2 id={id}>{title}</h2>
          {meta && <span className="meta">{meta}</span>}
          {actions && <div className="right">{actions}</div>}
        </div>
      )}
      {children}
      {footer && <div className="panel-foot">{footer}</div>}
    </section>
  );
}

/** Header for a section that is not a card (task details, account). */
export function SectionHeader({ title, meta, actions, children }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {meta !== undefined && meta !== null && <span className="meta">{meta}</span>}
      {children}
      {actions && <div className="right">{actions}</div>}
    </div>
  );
}

/** Icon-only button: always has an accessible name and a matching tooltip. */
export function IconButton({ icon, label, tooltip = label, size, className = "", side, ...rest }) {
  return (
    <button type="button" className={`btn btn-ghost icon-btn ${size === "sm" ? "btn-sm" : ""} ${className}`} aria-label={label} data-tooltip={tooltip} data-tooltip-side={side} {...rest}>
      <Icon name={icon} />
    </button>
  );
}
