// ECharts option builders for the analytics screens. One visual grammar for every chart:
// 2px lines, ≤ 24px bars with a rounded data end, a 2px surface gap between touching fills,
// solid hairline grids, Persian numerals, right-to-left layout (category labels on the right,
// bars growing leftwards), and one HTML tooltip style that leads with the value.
import { fmtNum, fmtPct, isNum } from "@/lib/analytics/format";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Formats a value for axes and tooltips by kind ("count", "rate", "days", "avg"). */
export function fmtBy(kind) {
  if (kind === "rate") return (v) => fmtPct(v);
  if (kind === "days") return (v) => (isNum(v) ? `${fmtNum(v)} روز` : "—");
  if (kind === "hours") return (v) => (isNum(v) ? `${fmtNum(v, 0)} ساعت` : "—");
  return (v) => fmtNum(v, isNum(v) && !Number.isInteger(v) ? 1 : 0);
}
/**
 * Chart text is drawn in a left-to-right box (so the engine anchors it correctly); wrapping each
 * label in a right-to-left embedding keeps mixed Persian/Latin text ("۱ مهر", "… در Splunk") in order.
 */
export const rtl = (s) => (s === null || s === undefined || s === "" ? "" : `\u202B${s}\u202C`);
const axisFmt = (kind) => (kind === "rate" ? (v) => rtl(fmtPct(v)) : (v) => rtl(fmtNum(v, 1)));

/** Tooltip body: a title, then one row per series — value first, then a line key and the name. */
export function tipHtml(title, rows, note) {
  const body = rows
    .map((r) => `<div class="ec-tip-row"><b>${esc(r.value)}</b><i style="background:${esc(r.color)}"></i><span>${esc(r.name)}</span></div>`)
    .join("");
  return `<div class="ec-tip" dir="rtl"><div class="ec-tip-title">${esc(title)}</div>${body}${note ? `<div class="ec-tip-note">${esc(note)}</div>` : ""}</div>`;
}

function base(t) {
  return {
    animationDuration: 550,
    animationEasing: "cubicOut",
    textStyle: { fontFamily: t.font, color: t["text-2"], fontSize: 12 },
    tooltip: {
      confine: true, backgroundColor: "transparent", borderWidth: 0, padding: 0, extraCssText: "box-shadow:none;",
      textStyle: { fontFamily: t.font },
    },
    aria: { enabled: true },
  };
}

const axisCommon = (t) => ({
  axisLine: { lineStyle: { color: t.border } },
  axisTick: { show: false },
  axisLabel: { color: t["text-3"], fontFamily: t.font, fontSize: 11.5 },
  splitLine: { lineStyle: { color: t.divider, width: 1 } },
});

const legend = (t, names) => (names.length > 1 ? {
  show: true, top: 0, right: 0, align: "right", itemWidth: 14, itemHeight: 8, itemGap: 16, icon: "roundRect",
  // Laid out left to right by the engine; reversed so the first series sits on the right (RTL reading order).
  textStyle: { color: t["text-2"], fontFamily: t.font, fontSize: 12 }, data: [...names].reverse(), formatter: rtl,
} : { show: false });

/**
 * Time series (one axis): `series` [{ name, data, color?, area?, emphasis? }], `prev` an optional
 * comparison series drawn as a quiet grey line behind. `kind` formats values; `labels` the buckets.
 */
export function lineOption(t, { labels, series, prev, kind = "count", partial = [], bars = false, markValue }) {
  const f = fmtBy(kind);
  const names = [...series.map((s) => s.name), ...(prev ? [prev.name] : [])];
  return {
    ...base(t),
    legend: legend(t, names),
    grid: { top: names.length > 1 ? 34 : 14, right: 8, bottom: 6, left: 8, containLabel: true },
    tooltip: {
      ...base(t).tooltip, trigger: "axis",
      axisPointer: { type: bars ? "shadow" : "line", lineStyle: { color: t["border-strong"], width: 1 }, shadowStyle: { color: "rgba(127,127,127,.08)" } },
      formatter: (ps) => {
        const i = ps[0]?.dataIndex ?? 0;
        const rows = ps.map((p) => ({ value: f(p.value), color: p.color, name: p.seriesName === prev?.name && prev.labels ? `${p.seriesName} (${prev.labels[i] ?? ""})` : p.seriesName }));
        return tipHtml(labels[i], rows, partial[i] ? "بازه ناقص" : null);
      },
    },
    xAxis: { type: "category", data: labels, boundaryGap: bars, ...axisCommon(t), splitLine: { show: false }, axisLabel: { ...axisCommon(t).axisLabel, hideOverlap: true, formatter: rtl } },
    yAxis: { type: "value", position: "right", ...axisCommon(t), axisLine: { show: false }, axisLabel: { ...axisCommon(t).axisLabel, formatter: axisFmt(kind) }, max: kind === "rate" ? 1 : undefined, minInterval: kind === "count" ? 1 : undefined },
    series: [
      ...(prev ? [{
        name: prev.name, type: "line", data: prev.data, symbol: "none", z: 1,
        lineStyle: { width: 2, color: t["text-3"], opacity: 0.45 }, itemStyle: { color: t["text-3"] }, emphasis: { disabled: true },
      }] : []),
      ...series.map((s, i) => (bars ? {
        name: s.name, type: "bar", data: s.data, barMaxWidth: 24, z: 2,
        itemStyle: { color: s.color ?? t["viz-bar"], borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: t["viz-bar-strong"] } },
        markLine: markValue !== undefined && i === 0 ? markLine(t, markValue, kind) : undefined,
      } : {
        name: s.name, type: "line", data: s.data, z: 3 + i,
        symbol: "circle", symbolSize: 8, showSymbol: s.data.length <= 16,
        lineStyle: { width: 2, color: s.color }, itemStyle: { color: s.color, borderColor: t["surface-card"], borderWidth: 2 },
        areaStyle: s.area ? { color: s.color, opacity: 0.1 } : undefined,
        emphasis: { focus: "series" },
        markLine: markValue !== undefined && i === 0 ? markLine(t, markValue, kind) : undefined,
      })),
    ],
  };
}

function markLine(t, value, kind, label = "میانه") {
  if (!isNum(value)) return undefined;
  return {
    silent: true, symbol: "none", data: [{ yAxis: value }],
    lineStyle: { color: t["text-3"], width: 1, type: "solid" },
    label: { formatter: rtl(`${label}: ${fmtBy(kind)(value)}`), color: t["text-3"], fontFamily: t.font, fontSize: 11, position: "insideStartTop" },
  };
}

/**
 * Horizontal bars for named categories (teams, people, activities): one series, one colour,
 * labels on the right, values at the bar ends, an optional median line.
 * rows: [{ label, value, id?, color?, note? }]
 */
export function hbarOption(t, { rows, kind = "count", median, color, max, labelWidth = 150 }) {
  const f = fmtBy(kind);
  return {
    ...base(t),
    grid: { top: isNum(median) ? 24 : 8, right: 8, bottom: 4, left: 48, containLabel: true },
    tooltip: {
      ...base(t).tooltip, trigger: "item",
      formatter: (p) => tipHtml(rows[p.dataIndex].label, [{ value: f(rows[p.dataIndex].value), color: p.color, name: rows[p.dataIndex].note ?? "" }]),
    },
    xAxis: { type: "value", inverse: true, max: max ?? (kind === "rate" ? 1 : undefined), ...axisCommon(t), axisLine: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: {
      type: "category", position: "right", inverse: true, data: rows.map((r) => r.label), ...axisCommon(t),
      axisLine: { show: false }, axisLabel: { ...axisCommon(t).axisLabel, color: t["text-2"], fontSize: 12, width: labelWidth, overflow: "truncate", formatter: rtl },
    },
    series: [{
      type: "bar", barMaxWidth: 18, barCategoryGap: "38%",
      data: rows.map((r) => ({ value: isNum(r.value) ? r.value : 0, itemStyle: { color: r.color ?? color ?? t["viz-bar"] }, id: r.id })),
      itemStyle: { borderRadius: [4, 0, 0, 4] },
      label: { show: true, position: "left", color: t["text-2"], fontFamily: t.font, fontSize: 11.5, formatter: (p) => rtl(f(rows[p.dataIndex].value)) },
      markLine: median !== undefined && isNum(median) ? {
        silent: true, symbol: "none", data: [{ xAxis: median }], lineStyle: { color: t["text-3"], width: 1, type: "solid" },
        label: { formatter: rtl(`میانه ${f(median)}`), color: t["text-3"], fontFamily: t.font, fontSize: 11, position: "end" },
      } : undefined,
    }],
  };
}

/**
 * Horizontal stacked bars (absolute or 100%) for parts of a whole per row.
 * rows: [{ label, parts: [n…] }], parts: [{ name, color }]. Counts stay in the tooltip; the
 * 100% form shows shares, so rows of different sizes compare by mix.
 */
export function stackedOption(t, { rows, parts, percent = true }) {
  const totals = rows.map((r) => r.parts.reduce((s, x) => s + x, 0));
  return {
    ...base(t),
    legend: { ...legend(t, parts.map((p) => p.name)), show: true },
    grid: { top: 34, right: 8, bottom: 4, left: 8, containLabel: true },
    tooltip: {
      ...base(t).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(127,127,127,.08)" } },
      formatter: (ps) => {
        const i = ps[0]?.dataIndex ?? 0;
        return tipHtml(`${rows[i].label} · ${fmtNum(totals[i], 0)}`, ps.map((p) => ({
          value: `${fmtNum(rows[i].parts[p.seriesIndex], 0)}${percent && totals[i] ? ` (${fmtPct(rows[i].parts[p.seriesIndex] / totals[i])})` : ""}`,
          color: p.color, name: p.seriesName,
        })));
      },
    },
    xAxis: { type: "value", inverse: true, max: percent ? 1 : undefined, ...axisCommon(t), axisLine: { show: false }, axisLabel: { ...axisCommon(t).axisLabel, formatter: percent ? (v) => rtl(fmtPct(v)) : (v) => rtl(fmtNum(v, 0)) } },
    yAxis: { type: "category", position: "right", inverse: true, data: rows.map((r) => r.label), ...axisCommon(t), axisLine: { show: false }, axisLabel: { ...axisCommon(t).axisLabel, color: t["text-2"], fontSize: 12, formatter: rtl } },
    series: parts.map((p, k) => ({
      name: p.name, type: "bar", stack: "all", barMaxWidth: 22,
      data: rows.map((r, i) => (percent ? (totals[i] ? r.parts[k] / totals[i] : 0) : r.parts[k])),
      itemStyle: { color: p.color, borderColor: t["surface-card"], borderWidth: 1 },
      emphasis: { focus: "series" },
    })),
  };
}

/**
 * Heatmap of a value per cell (activity × analyst, weekday × week). One-hue sequential ramp;
 * empty cells (null) stay blank. data: [[x, y, value]].
 */
export function heatmapOption(t, { xLabels, yLabels, data, kind = "rate", max, min = 0, xTip, yTip }) {
  const f = fmtBy(kind);
  const values = data.map((d) => d[2]).filter(isNum);
  return {
    ...base(t),
    grid: { top: 8, right: 8, bottom: 40, left: 8, containLabel: true },
    tooltip: {
      ...base(t).tooltip, trigger: "item",
      formatter: (p) => tipHtml(`${(yTip ?? yLabels)[p.value[1]]} · ${(xTip ?? xLabels)[p.value[0]]}`, [{ value: isNum(p.value[2]) ? f(p.value[2]) : "—", color: p.color, name: "" }]),
    },
    xAxis: { type: "category", data: xLabels, inverse: true, ...axisCommon(t), axisLine: { show: false }, splitArea: { show: false }, axisLabel: { ...axisCommon(t).axisLabel, interval: 0, hideOverlap: true, formatter: rtl } },
    yAxis: { type: "category", data: yLabels, position: "right", inverse: true, ...axisCommon(t), axisLine: { show: false }, axisLabel: { ...axisCommon(t).axisLabel, color: t["text-2"], fontSize: 12, formatter: rtl } },
    visualMap: {
      min, max: max ?? Math.max(1e-9, ...values), calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 120,
      inRange: { color: [t["viz-track"], t["viz-1"], t["viz-2"], t["viz-3"], t["viz-4"]] },
      textStyle: { color: t["text-3"], fontFamily: t.font, fontSize: 11 }, formatter: (v) => rtl(f(v)),
    },
    series: [{
      type: "heatmap", data: data.filter((d) => isNum(d[2])),
      itemStyle: { borderColor: t["surface-card"], borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } },
    }],
  };
}

/**
 * Distribution of one metric across people: a dot per person on a value axis, one row per team,
 * a hairline at the overall median. Shows spread, not rank. points: [{ id, name, value, group }].
 */
export function stripOption(t, { groups, points, kind = "count", median }) {
  const f = fmtBy(kind);
  const jitter = (id) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997; return (h / 997 - 0.5) * 0.5; };
  return {
    ...base(t),
    grid: { top: 22, right: 8, bottom: 8, left: 16, containLabel: true },
    tooltip: { ...base(t).tooltip, trigger: "item", formatter: (p) => tipHtml(p.data.name, [{ value: f(p.data.value[0]), color: p.color, name: groups[Math.round(p.data.value[1])] ?? "" }]) },
    xAxis: { type: "value", inverse: true, ...axisCommon(t), axisLine: { show: false }, axisLabel: { ...axisCommon(t).axisLabel, formatter: axisFmt(kind) }, max: kind === "rate" ? 1 : undefined },
    // Rows sit on integer ticks (one per team); the extra tick at each end is padding with no label.
    yAxis: { type: "value", position: "right", min: -1, max: groups.length, interval: 1, inverse: true, ...axisCommon(t), axisLine: { show: false },
      splitLine: { show: true, lineStyle: { color: t.divider } }, axisLabel: { ...axisCommon(t).axisLabel, color: t["text-2"], fontSize: 12, formatter: (v) => rtl(groups[v] ?? "") } },
    series: [{
      type: "scatter", symbolSize: 12,
      data: points.filter((p) => isNum(p.value)).map((p) => ({ id: p.id, name: p.name, value: [p.value, p.groupIndex + jitter(p.id)], itemStyle: { color: t.cat[p.groupIndex % 4] } })),
      itemStyle: { borderColor: t["surface-card"], borderWidth: 2, opacity: 0.9 },
      emphasis: { scale: 1.3, itemStyle: { opacity: 1 } },
      markLine: isNum(median) ? {
        silent: true, symbol: "none", data: [{ xAxis: median }], lineStyle: { color: t["text-3"], width: 1, type: "solid" },
        label: { formatter: rtl(`میانه ${f(median)}`), color: t["text-3"], fontFamily: t.font, fontSize: 11, position: "start" },
      } : undefined,
    }],
  };
}

/**
 * Calendar heatmap on the Jalali calendar: one column per week (Saturday first), one row per weekday.
 * cells: [{ week, day, date, value, label }], weeks: column labels (month names at month starts).
 */
export function calendarOption(t, { cells, weekLabels, dayLabels, kind = "count", name, cell = 20 }) {
  const f = fmtBy(kind);
  const values = cells.map((c) => c.value).filter(isNum);
  return {
    ...base(t),
    // Square cells of a fixed size: a short period stays a compact block instead of stretching.
    grid: { top: 22, right: 64, bottom: 40, width: weekLabels.length * cell, height: dayLabels.length * cell },
    tooltip: { ...base(t).tooltip, trigger: "item", formatter: (p) => tipHtml(cells[p.dataIndex].label, [{ value: f(cells[p.dataIndex].value), color: p.color, name }]) },
    xAxis: { type: "category", data: weekLabels, inverse: true, position: "top", ...axisCommon(t), axisLine: { show: false }, axisLabel: { ...axisCommon(t).axisLabel, interval: 0, align: "right", formatter: rtl } },
    yAxis: { type: "category", data: dayLabels, inverse: true, position: "right", ...axisCommon(t), axisLine: { show: false }, axisLabel: { ...axisCommon(t).axisLabel, fontSize: 11, formatter: rtl } },
    visualMap: {
      min: 0, max: Math.max(kind === "rate" ? 1 : 1, ...values), orient: "horizontal", right: 64, bottom: 0, itemWidth: 10, itemHeight: 120, calculable: false,
      inRange: { color: [t["viz-track"], t["viz-1"], t["viz-2"], t["viz-3"], t["viz-4"]] }, textStyle: { color: t["text-3"], fontFamily: t.font, fontSize: 11 }, formatter: (v) => rtl(f(v)),
    },
    series: [{ type: "heatmap", data: cells.map((c) => [c.week, c.day, c.value]), itemStyle: { borderColor: t["surface-card"], borderWidth: 2, borderRadius: 2 } }],
  };
}
