"use client";

import Link from "next/link";
import { Children } from "react";
import Icon from "@/components/ui/Icon";

const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/**
 * KPI card: label, value, and one quiet line of context (comparison or explanation).
 * `tone="alert"` colours the value when it needs action. `href` makes the whole card a link.
 * `loading` keeps the card's height while data is on its way.
 */
export function Metric({ label, value, unit, foot, tone, href, onClick, aside, loading, hint, testId }) {
  const body = (
    <>
      <div className="metric-label">
        <span>{label}</span>
        {hint && <span className="metric-hint" tabIndex={0} role="img" aria-label={hint} data-tooltip={hint}><Icon name="info" size="sm" /></span>}
        {(href || onClick) && <Icon name="chev" size="sm" />}
      </div>
      <div className="metric-body">
        {loading ? <div className="sk sk-late" aria-hidden="true" /> : <div className="metric-value">{typeof value === "number" ? NUM.format(value) : value}{unit && <small>{unit}</small>}</div>}
        {!loading && aside}
      </div>
      <div className="metric-foot">{loading ? " " : foot}</div>
    </>
  );
  const cls = `metric ${tone === "alert" ? "alert" : ""} ${href || onClick ? "link" : ""}`;
  const common = { className: cls, "data-testid": testId, "aria-busy": loading || undefined };
  if (href) return <Link href={href} {...common}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} {...common}>{body}</button>;
  return <div {...common}>{body}</div>;
}

/** Row of KPI cards. Wraps into balanced rows (3 + 2, 3 + 3, 2 + 2) as its container narrows. */
export function MetricGrid({ children, label }) {
  const n = Children.toArray(children).filter(Boolean).length;
  return (
    <div className="metrics-wrap">
      <div className="metrics" role="group" aria-label={label} data-n={n} style={{ "--n": n }}>{children}</div>
    </div>
  );
}

/**
 * Change against the previous period. Only rendered when the previous value is known.
 * `goodWhen="up"` colours an increase as positive; decreases stay neutral (not every drop is a problem).
 */
export function Delta({ now, before, label, goodWhen = "up" }) {
  if (before === null || before === undefined || now === null || now === undefined) return null;
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return <><span className="delta">No change</span><span>{label}</span></>;
  const up = d > 0;
  return (
    <>
      <span className={`delta ${up && goodWhen === "up" ? "up" : ""}`}>
        <Icon name={up ? "arrowUp" : "arrowDown"} />
        {Math.abs(d)}
      </span>
      <span>{label}</span>
    </>
  );
}
