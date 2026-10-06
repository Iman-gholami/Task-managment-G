"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Chart, { downloadUrl } from "@/components/analytics/Chart";
import { fmtBy } from "@/components/analytics/chartOptions";
import Icon from "@/components/ui/Icon";
import Segmented from "@/components/ui/Segmented";
import useFocusTrap from "@/components/useFocusTrap";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { toJalali } from "@/lib/analytics/calendar";
import { change, isNum } from "@/lib/analytics/format";

const jalaliStamp = (iso) => { const j = toJalali(iso); return `${j.jy}-${String(j.jm).padStart(2, "0")}-${String(j.jd).padStart(2, "0")}`; };

// ---- Files -------------------------------------------------------------------------

/** CSV that Excel opens with Persian intact (UTF-8 BOM). columns: [{ label, kind?, value(row) }]. */
export function downloadCsv(name, columns, rows) {
  const cell = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const raw = (c, r) => {
    const v = c.value(r);
    if (c.kind === "rate" && isNum(v)) return Math.round(v * 1000) / 10;
    if (isNum(v)) return Math.round(v * 100) / 100;
    return v;
  };
  const head = columns.map((c) => cell(c.kind === "rate" ? `${c.label} (%)` : c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(raw(c, r))).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${head}\r\n${body}`], { type: "text/csv;charset=utf-8" }));
  downloadUrl(url, name.endsWith(".csv") ? name : `${name}.csv`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Small figures ---------------------------------------------------------------------

/** Tiny trend line for KPI cards. Decorative: the card states the value. */
export function Sparkline({ values, width = 96, height = 30 }) {
  const v = values.map((x) => (isNum(x) ? x : 0));
  if (v.length < 2) return null;
  const max = Math.max(...v, 1e-9), min = Math.min(...v, 0);
  const x = (i) => 2 + (i / (v.length - 1)) * (width - 4);
  const y = (n) => height - 3 - ((n - min) / (max - min || 1)) * (height - 6);
  const pts = v.map((n, i) => `${x(i)},${y(n)}`).join(" ");
  const last = v.length - 1;
  return (
    <svg className="an-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <polygon points={`${x(0)},${height} ${pts} ${x(last)},${height}`} className="an-spark-area" />
      <polyline points={pts} className="an-spark-line" />
      <circle cx={x(last)} cy={y(v[last])} r="3" className="an-spark-dot" />
    </svg>
  );
}

/**
 * Change against the comparison period, stated neutrally (arrow + amount): the dashboard reports
 * statistics and does not colour a rise or fall as good or bad.
 */
export function Delta({ now, before, kind = "count", label }) {
  const c = change(now, before, kind);
  if (!c) return label ? <span className="muted">{label}</span> : null;
  return (
    <span className="an-delta" data-dir={c.dir}>
      {c.dir !== "flat" && <Icon name={c.dir === "up" ? "arrowUp" : "arrowDown"} />}
      <b>{c.text}</b>
      {label && <span>نسبت به {label}</span>}
    </span>
  );
}

/** KPI card (reuses the app's .metric styles). */
export function Kpi({ label, value, unit, foot, delta, spark, icon, hint, tone, href, onClick, loading, testId }) {
  const body = (
    <>
      <div className="metric-label">
        {icon && <span className="metric-icon" aria-hidden="true"><Icon name={icon} size="sm" /></span>}
        <span>{label}</span>
        {hint && <span className="metric-hint" tabIndex={0} role="img" aria-label={hint} data-tooltip={hint}><Icon name="info" size="sm" /></span>}
        {(href || onClick) && <Icon name="left" size="sm" />}
      </div>
      <div className="metric-body">
        {loading ? <div className="sk sk-late" aria-hidden="true" /> : <div className="metric-value an-kpi-value">{value}{unit && <small>{unit}</small>}</div>}
        {!loading && spark}
      </div>
      <div className="metric-foot an-kpi-foot">{loading ? " " : <>{delta}{foot && <span className="an-foot">{foot}</span>}</>}</div>
    </>
  );
  const cls = `metric an-kpi ${tone === "alert" ? "alert" : ""} ${href || onClick ? "link" : ""}`;
  if (href) return <Link href={href} className={cls} data-testid={testId}>{body}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick} data-testid={testId}>{body}</button>;
  return <div className={cls} data-testid={testId}>{body}</div>;
}

// ---- States -----------------------------------------------------------------------------

export function AnEmpty({ icon = "report", title, children, action }) {
  return (
    <div className="empty compact">
      <div className="glyph" aria-hidden="true"><Icon name={icon} /></div>
      {title && <h3>{title}</h3>}
      {children && <p>{children}</p>}
      {action && <div className="actions">{action}</div>}
    </div>
  );
}

/** Failure of one region, in Persian; the rest of the page keeps working. */
export function AnError({ error, onRetry }) {
  const status = error?.status ?? 0;
  const e = error?.kind === "network"
    ? { icon: "offline", title: "اتصال به سرور برقرار نشد", body: "اتصال شبکه را بررسی کنید و دوباره تلاش کنید." }
    : status === 403 ? { icon: "lock", title: "به این بخش دسترسی ندارید", body: "اگر لازم دارید، با مدیر سیستم تماس بگیرید." }
      : status >= 500 ? { icon: "server", title: "سرور با خطا روبه‌رو شد", body: "داده‌ها سالم است. چند لحظه بعد دوباره تلاش کنید." }
        : { icon: "alert", title: "داده بارگذاری نشد", body: error?.message || "دوباره تلاش کنید." };
  return (
    <div className="empty danger" role="alert">
      <div className="glyph" aria-hidden="true"><Icon name={e.icon} /></div>
      <h3>{e.title}</h3>
      <p>{e.body}</p>
      {onRetry && status !== 403 && <div className="actions"><button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>تلاش دوباره</button></div>}
    </div>
  );
}

export function PanelSkeleton({ height = 260 }) {
  return <div className="an-skel sk-late" style={{ height }} aria-hidden="true"><div className="sk" /><div className="sk" /><div className="sk" /></div>;
}

// ---- Panels -----------------------------------------------------------------------------

/**
 * A chart in a card, with the question it answers, a chart/table switch (the table is the
 * accessible twin and the source of the CSV), CSV and PNG downloads.
 * table: { columns: [{ key, label, kind?, value(row), render?(row) }], rows }
 */
export function ChartPanel({ title, question, meta, build, height = 260, table, fileName, actions, footer, empty, onChartClick, className = "", testId }) {
  const [mode, setMode] = useState("chart");
  const chart = useRef(null);
  const id = useId();
  const { range } = useAnalytics();
  // ASCII file names (some browsers drop non-Latin download names), stamped with the Jalali period.
  const name = `analytics-${(fileName ?? "chart").replace(/[^\w.-]+/g, "-")}_${jalaliStamp(range.from)}_${jalaliStamp(range.end)}`;
  return (
    <section className={`panel an-panel ${className}`} aria-labelledby={id} data-testid={testId}>
      <div className="panel-head an-panel-head">
        <div className="an-panel-titles">
          <h2 id={id}>{title}</h2>
          {question && <p className="an-q">{question}</p>}
        </div>
        {meta && <span className="meta">{meta}</span>}
        <div className="right an-no-print">
          {actions}
          {!empty && table && (
            <Segmented
              label="نمایش"
              value={mode}
              onChange={setMode}
              iconOnly
              options={[{ value: "chart", icon: "bars", ariaLabel: "نمودار" }, { value: "table", icon: "sheet", ariaLabel: "جدول" }]}
            />
          )}
          {!empty && table && (
            <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label="دانلود CSV" data-tooltip="دانلود داده (CSV)" onClick={() => downloadCsv(name, table.columns, table.rows)}>
              <Icon name="download" />
            </button>
          )}
          {!empty && build && mode === "chart" && (
            <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label="ذخیره تصویر نمودار" data-tooltip="تصویر نمودار (PNG)" onClick={() => chart.current?.png(`${name}.png`)}>
              <Icon name="image" />
            </button>
          )}
        </div>
      </div>
      {empty ? empty : mode === "chart" && build ? (
        <div className="an-chart-wrap"><Chart ref={chart} build={build} height={height} label={title} onClick={onChartClick} /></div>
      ) : table ? (
        <DataTable columns={table.columns} rows={table.rows} maxHeight={height + 80} dense />
      ) : null}
      {/* Print always gets the table under the chart: values stay readable on paper. */}
      {!empty && table && mode === "chart" && <div className="an-print-only"><DataTable columns={table.columns} rows={table.rows} dense /></div>}
      {footer && <div className="panel-foot">{footer}</div>}
    </section>
  );
}

// ---- Table ---------------------------------------------------------------------------------

/**
 * Sortable data table. Default order is the order given (alphabetical for people): sorting is a tool
 * the reader chooses, not a ranking. columns: [{ key, label, kind?, value(row), render?(row), sort?, title? }].
 */
export function DataTable({ columns, rows, rowKey = (r, i) => r.id ?? i, onRowClick, rowHref, maxHeight, dense, empty, caption, testId }) {
  const [sort, setSort] = useState(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const val = (r) => col.sortValue?.(r) ?? col.value(r);
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      const xn = x === null || x === undefined || x === "", yn = y === null || y === undefined || y === "";
      if (xn || yn) return xn === yn ? 0 : xn ? 1 : -1;
      const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fa");
      return sort.dir === "asc" ? d : -d;
    });
  }, [rows, columns, sort]);
  const toggle = (key) => setSort((s) => (s?.key !== key ? { key, dir: "desc" } : s.dir === "desc" ? { key, dir: "asc" } : null));
  if (!rows.length) return empty ?? <AnEmpty title="داده‌ای نیست">در این بازه و با این فیلترها رکوردی ثبت نشده است.</AnEmpty>;
  return (
    <div className="table-wrap an-table-wrap" style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined} data-testid={testId}>
      <table className={`dt an-dt ${dense ? "dense" : ""}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const num = c.kind && c.kind !== "text";
              const s = sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined;
              return (
                <th key={c.key} scope="col" className={num ? "n" : ""} aria-sort={s} title={c.title}>
                  {c.sort === false ? c.label : (
                    <button type="button" className="sort" onClick={() => toggle(c.key)}>
                      {c.label}
                      <Icon name={s === "ascending" ? "up" : s === "descending" ? "down" : "sort"} />
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const link = rowHref?.(r);
            return (
              <tr key={rowKey(r, i)} className={onRowClick || link ? "is-link" : ""} onClick={onRowClick ? (e) => !e.target.closest("a,button") && onRowClick(r) : undefined}>
                {columns.map((c, j) => {
                  const v = c.value(r);
                  const num = c.kind && c.kind !== "text";
                  const content = c.render ? c.render(r) : num ? (isNum(v) ? fmtBy(c.kind)(v) : <span className="muted">—</span>) : (v ?? <span className="muted">—</span>);
                  return (
                    <td key={c.key} className={`${num ? "n" : ""} ${j === 0 ? "title" : ""} ${num && v === 0 ? "zero" : ""}`}>
                      {j === 0 && link ? <Link href={link}>{content}</Link> : content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Drawer -----------------------------------------------------------------------------

/** Side panel for a quick look (a person, a team, all filters). Esc and the scrim close it. */
export function Drawer({ title, subtitle, onClose, children, footer, width = 460, label }) {
  const ref = useFocusTrap(onClose);
  const id = useId();
  // Portalled to <body> so no transformed or sticky ancestor can trap the fixed panel.
  return createPortal(
    <div className="an-scrim" dir="rtl" lang="fa" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside ref={ref} className="an-drawer" role="dialog" aria-modal="true" aria-labelledby={id} aria-label={label} style={{ width: `min(${width}px, 100vw)` }}>
        <header className="an-drawer-head">
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label="بستن" data-tooltip="بستن (Esc)" onClick={onClose}><Icon name="x" /></button>
        </header>
        <div className="an-drawer-body">{children}</div>
        {footer && <footer className="an-drawer-foot">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}

/** Small "label: value" row used in drawers and the report. */
export function Stat({ label, value, sub }) {
  return (
    <div className="an-stat">
      <span className="l">{label}</span>
      <span className="v">{value}</span>
      {sub && <span className="s">{sub}</span>}
    </div>
  );
}

export const useStableBuild = (fn, deps) => useCallback(fn, deps); // eslint-disable-line react-hooks/exhaustive-deps
