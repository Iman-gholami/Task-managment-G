"use client";

import { useCallback, useMemo } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { calendarOption, hbarOption, lineOption } from "@/components/analytics/chartOptions";
import { ChartPanel } from "@/components/analytics/ui";
import Segmented from "@/components/ui/Segmented";
import { J_MONTHS, WEEKDAYS, addDays, diffDays, faDate, maxIso, toJalali, weekStart, weekdayIndex } from "@/lib/analytics/calendar";
import { fmtNum } from "@/lib/analytics/format";
import { GRAN_LABEL, buckets } from "@/lib/analytics/periods";
import { METRICS, backlogSeries, bucketStats, dailySeries, groupsIn, idsOf } from "@/lib/analytics/metrics";

const BY = [
  { value: "all", label: "کل" },
  { value: "team", label: "به تفکیک تیم" },
  { value: "level", label: "به تفکیک سطح SOC" },
];

export default function Trends() {
  return (
    <AnalyticsFrame title="روندها و تحلیل زمانی">
      <TrendsBody />
    </AnalyticsFrame>
  );
}

function TrendsBody() {
  const a = useAnalytics();
  const { view, range, cmp, gran, params, setParam, today } = a;
  const hasShift = view.people.some((p) => p.shift);
  const keys = Object.keys(METRICS).filter((k) => METRICS[k].area !== "soc" || hasShift);
  const metric = keys.includes(params.get("metric")) ? params.get("metric") : "completed";
  const def = METRICS[metric];
  const groups = groupsIn(view);
  const levels = ["L1", "L2", "L3"].filter((l) => view.people.some((p) => p.level === l));
  const byOptions = BY.filter((b) => b.value === "all" || (b.value === "team" ? groups.length > 1 : levels.length > 1));
  const by = byOptions.some((b) => b.value === params.get("by")) ? params.get("by") : "all";

  const m = useMemo(() => {
    const b = buckets(range.from, range.end, gran);
    const pb = cmp ? buckets(cmp.from, cmp.to, gran) : [];
    const parts = by === "team"
      ? groups.map((g) => ({ name: g.fa, ids: idsOf(view.people.filter((p) => p.group === g.name)) }))
      : by === "level" ? levels.map((l) => ({ name: l, ids: idsOf(view.people.filter((p) => p.level === l)) }))
        : [{ name: def.label, ids: null }];
    const series = parts.map((p) => bucketStats(view, p.ids, b).map((x) => x[metric]));
    const prev = by === "all" && cmp ? bucketStats(view, null, pb).map((x) => x[metric]) : null;
    // Twelve months of daily completions for the calendar, whatever the period.
    const yFrom = maxIso(view.window.from, addDays(today, -363));
    const year = dailySeries(view, null, yFrom, today, "completed");
    // Average per weekday over the selected period.
    const days = dailySeries(view, null, range.from, range.end, metric);
    const sum = Array(7).fill(0), count = Array(7).fill(0);
    for (const [d, v] of days) { const w = weekdayIndex(d); if (v !== null) { sum[w] += v; count[w] += 1; } }
    return { b, pb, parts, series, prev, year, yFrom, weekday: sum.map((s, i) => (count[i] ? s / count[i] : null)), backlog: backlogSeries(view, null, b) };
  }, [view, range, cmp, gran, by, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const asBars = by === "all" && def.kind === "count" && m.b.length <= 31;
  const main = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), partial: m.b.map((x) => x.partial), kind: def.kind, bars: asBars,
    series: m.parts.map((p, i) => ({ name: p.name, data: m.series[i], color: by === "all" ? (asBars ? undefined : t.primary) : t.cat[i], area: by === "all" && !asBars })),
    prev: m.prev ? { name: `${def.label} — ${cmp.label}`, data: m.prev, labels: m.pb.map((x) => x.label) } : null,
  }), [m, by, def, asBars, cmp]);
  const backlog = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), series: [{ name: "صف باز در پایان بازه", data: m.backlog, color: t["cat-2"], area: true }],
  }), [m]);

  const cal = useMemo(() => {
    const start = weekStart(m.yFrom);
    const weeks = Math.floor(diffDays(start, today) / 7) + 1;
    const weekLabels = Array.from({ length: weeks }, (_, w) => {
      const d = addDays(start, w * 7);
      const j = toJalali(d);
      return w === 0 || toJalali(addDays(d, -7)).jm !== j.jm ? J_MONTHS[j.jm - 1] : "";
    });
    const cells = m.year.map(([d, v]) => ({ week: Math.floor(diffDays(start, d) / 7), day: weekdayIndex(d), date: d, value: v, label: `${WEEKDAYS[weekdayIndex(d)]} ${faDate(d)}` }));
    return { weekLabels, cells, cell: Math.max(11, Math.min(20, Math.floor(1050 / weeks))) };
  }, [m, today]);
  const calendar = useCallback((t) => calendarOption(t, { cells: cal.cells, weekLabels: cal.weekLabels, dayLabels: WEEKDAYS, name: "تسک تکمیل‌شده", cell: cal.cell }), [cal]);
  const weekday = useCallback((t) => hbarOption(t, { rows: WEEKDAYS.map((label, i) => ({ label, value: m.weekday[i] })), kind: def.kind === "count" ? "avg" : def.kind }), [m, def]);

  return (
    <>
      <ChartPanel
        title={`روند «${def.label}»`}
        question={`${GRAN_LABEL[gran]}${by === "all" && cmp ? `؛ خط خاکستری: ${cmp.label}` : ""}. ${def.hint ?? ""}`}
        build={main}
        height={320}
        actions={
          <>
            <select className="input input-sm" style={{ width: 190 }} value={metric} onChange={(e) => setParam("metric", e.target.value)} aria-label="شاخص" data-testid="trend-metric">
              {keys.map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
            </select>
            {byOptions.length > 1 && <Segmented label="تفکیک" value={by} onChange={(v) => setParam("by", v === "all" ? "" : v)} options={byOptions} />}
          </>
        }
        table={{
          columns: [{ key: "b", label: "بازه", value: (r) => r.label }, ...m.parts.map((p, i) => ({ key: `s${i}`, label: p.name, kind: def.kind, value: (r) => r.v[i] })), ...(m.prev ? [{ key: "p", label: cmp.label, kind: def.kind, value: (r) => r.p }] : [])],
          rows: m.b.map((x, j) => ({ id: x.from, label: x.label, v: m.series.map((s) => s[j]), p: m.prev?.[j] ?? null })),
        }}
        fileName={`trend-${metric}`}
        testId="chart-trend"
      />

      <div className="an-row">
        <ChartPanel title="صف کار باز در طول زمان" question="کار انجام‌نشده (همه وضعیت‌های باز) در پایان هر بازه؛ از تاریخ ایجاد و بسته‌شدن تسک‌ها بازسازی شده." build={backlog} height={240}
          table={{ columns: [{ key: "b", label: "بازه", value: (r) => r.label }, { key: "v", label: "صف باز", kind: "count", value: (r) => r.v }], rows: m.b.map((x, i) => ({ id: x.from, label: x.label, v: m.backlog[i] })) }}
          fileName="backlog-over-time" />
        <ChartPanel title={`میانگین «${def.label}» در روزهای هفته`} question="کدام روزهای هفته پرکارترند؟ (میانگین در بازه انتخاب‌شده)" build={weekday} height={240}
          table={{ columns: [{ key: "d", label: "روز", value: (r) => r.label }, { key: "v", label: "میانگین", kind: "avg", value: (r) => r.v }], rows: WEEKDAYS.map((label, i) => ({ id: i, label, v: m.weekday[i] })) }}
          fileName="weekday-average" />
      </div>

      <ChartPanel
        title="الگوی روزانه تسک‌های تکمیل‌شده — ۱۲ ماه اخیر"
        question="ماه‌ها و روزهای پرکار و کم‌کار در یک نگاه؛ هر خانه یک روز است."
        build={calendar}
        height={7 * cal.cell + 76}
        table={{ columns: [{ key: "d", label: "روز", value: (r) => r.label }, { key: "v", label: "تسک تکمیل‌شده", kind: "count", value: (r) => r.value }], rows: cal.cells.filter((c) => c.value).map((c) => ({ ...c, id: c.date })) }}
        fileName="daily-calendar"
        footer={<span>جمع ۱۲ ماه: {fmtNum(m.year.reduce((s, [, v]) => s + (v || 0), 0), 0)} تسک</span>}
      />
    </>
  );
}
