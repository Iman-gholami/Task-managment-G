"use client";

import { CX } from "@/lib/format";

const CX_LABELS = CX.slice(1);

/**
 * Complexity mix as a 100% stacked bar (Simple → Advanced). Counts are in the tooltip and the
 * accessible label, so colour is never the only carrier of the data.
 */
export function Distribution({ parts, labels = CX_LABELS, name = "Complexity mix" }) {
  const text = labels.map((l, i) => `${l} ${parts[i] ?? 0}`).join(" · ");
  return (
    <div className="dist" role="img" aria-label={`${name}: ${text}`} data-tooltip={text}>
      {parts.map((n, i) => (n > 0 ? <span key={i} style={{ flex: n, background: `var(--viz-${i + 1})` }} /> : null))}
    </div>
  );
}

/** Legend for the complexity ramp; pass `counts` to show totals next to each step. */
export function CxLegend({ counts }) {
  return (
    <div className="legend">
      {CX_LABELS.map((c, i) => (
        <span key={c}><i style={{ background: `var(--viz-${i + 1})` }} aria-hidden="true" />{c}{counts && <b>{counts[i]}</b>}</span>
      ))}
    </div>
  );
}

/**
 * Mini column chart. Bars share a baseline and — when `max` is passed — a scale across rows,
 * so two teams can be compared at a glance. The latest value is emphasised.
 */
export function Bars({ values, labels, max, name, unit = "", size }) {
  const top = max ?? Math.max(1, ...values);
  const summary = values.map((v, i) => `${labels?.[i] ?? i + 1} ${v}${unit}`).join(", ");
  return (
    <span className={`bars ${size === "lg" ? "lg fill" : ""}`} role="img" aria-label={`${name}: ${summary}`}>
      {values.map((v, i) => (
        <span
          key={i}
          className={`${i === values.length - 1 ? "last" : ""} ${v === 0 ? "zero" : ""}`}
          style={{ "--h": top ? v / top : 0 }}
          data-tooltip={`${labels?.[i] ?? i + 1}: ${v}${unit}`}
        />
      ))}
    </span>
  );
}

/** Labelled progress bar with a numeric readout. */
export function Meter({ value, max = 100, label, tone, readout }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <span className="meter">
      <span className={`progress ${tone ?? ""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="num">{readout ?? `${pct}%`}</span>
    </span>
  );
}
