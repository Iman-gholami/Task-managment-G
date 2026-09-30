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

/** Compact multi-series line chart used for manager-level trends. */
export function TrendLines({ series, labels, name = "Trend" }) {
  const width = 680;
  const height = 190;
  const pad = { top: 16, right: 14, bottom: 30, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const all = series.flatMap((s) => s.values);
  const top = Math.max(1, ...all);
  const x = (i) => pad.left + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const y = (v) => pad.top + innerH - (v / top) * innerH;
  const grid = [0, 0.25, 0.5, 0.75, 1];
  const summary = series.map((s) => `${s.name}: ${s.values.join(", ")}`).join(" · ");

  return (
    <div className="trend-chart" role="img" aria-label={`${name}. ${summary}`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {grid.map((p) => (
          <line key={p} className="trend-grid" x1={pad.left} x2={width - pad.right} y1={pad.top + innerH * p} y2={pad.top + innerH * p} />
        ))}
        {series.map((s, si) => {
          const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          return (
            <g key={s.name} style={{ "--trend-color": `var(--viz-${(si % 4) + 1})` }}>
              <polyline className="trend-line" points={points} />
              {s.values.map((v, i) => <circle key={i} className="trend-dot" cx={x(i)} cy={y(v)} r="4" />)}
            </g>
          );
        })}
      </svg>
      <div className="trend-axis" aria-hidden="true">
        {labels.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="trend-legend">
        {series.map((s, si) => (
          <span key={s.name}><i style={{ background: `var(--viz-${(si % 4) + 1})` }} />{s.name}<b>{s.values.at(-1) ?? 0}</b></span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal comparison bars. Preserve the supplied order; this is not a leaderboard. */
export function CompareBars({ rows, name, unit = "" }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="compare-bars" role="img" aria-label={`${name}: ${rows.map((r) => `${r.label} ${r.value}${unit}`).join(", ")}`}>
      {rows.map((r) => (
        <div className="compare-bar" key={r.label}>
          <span className="compare-bar__label">{r.label}</span>
          <span className="compare-bar__track"><span style={{ width: `${Math.round((r.value / top) * 100)}%` }} /></span>
          <b className="num">{r.value}{unit}</b>
        </div>
      ))}
    </div>
  );
}
