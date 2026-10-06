"use client";

import { useCallback, useMemo, useState } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { stripOption } from "@/components/analytics/chartOptions";
import PersonDrawer from "@/components/analytics/PersonDrawer";
import { AnEmpty, ChartPanel, DataTable, Delta, Sparkline } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { Panel } from "@/components/ui/layout";
import { faDigits } from "@/lib/analytics/calendar";
import { median } from "@/lib/analytics/format";
import { ROLE_FA, groupFa } from "@/lib/analytics/labels";
import { METRICS, bucketStats, groupsIn, peopleRows } from "@/lib/analytics/metrics";
import { buckets } from "@/lib/analytics/periods";

const DIST_METRICS = ["completed", "units", "hours", "hoursPerTask", "onTimeRate", "cycleMedian", "created", "tickets", "iocs", "routineRate"];

export default function People() {
  return (
    <AnalyticsFrame title="کارشناسان" subtitle="آماری، بدون امتیاز و رتبه">
      <PeopleBody />
    </AnalyticsFrame>
  );
}

function PeopleBody() {
  const a = useAnalytics();
  const { view, range, cmp, gran, params, setParam } = a;
  const [q, setQ] = useState("");
  const person = params.get("person");
  const metric = DIST_METRICS.includes(params.get("metric")) ? params.get("metric") : "completed";
  const m = useMemo(() => {
    const b = buckets(range.from, range.end, gran);
    const rows = peopleRows(view, range, cmp).map((r) => ({ ...r, id: r.person.id, spark: bucketStats(view, [r.person.id], b).map((x) => x.completed) }));
    return { rows, groups: groupsIn(view), shift: rows.some((r) => r.person.shift) };
  }, [view, range, cmp, gran]);
  const shown = q.trim() ? m.rows.filter((r) => r.person.name.includes(q.trim())) : m.rows;
  const def = METRICS[metric];

  const distRows = m.rows.filter((r) => def.area !== "soc" || r.person.shift);
  const dist = useCallback((t) => stripOption(t, {
    groups: m.groups.map((g) => g.fa),
    points: distRows.map((r) => ({ id: r.person.id, name: r.person.name, value: r.cur[metric], groupIndex: m.groups.findIndex((g) => g.name === r.person.group) })),
    kind: def.kind, median: median(distRows.map((r) => r.cur[metric])),
  }), [m, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { key: "name", label: "کارشناس", value: (r) => r.person.name, render: (r) => <span className="an-person">{r.person.name}<small>{[groupFa(r.person.group), r.person.level, ROLE_FA[r.person.role], r.person.active ? null : "غیرفعال"].filter(Boolean).join(" · ")}</small></span> },
    { key: "c", label: "تکمیل‌شده", kind: "count", value: (r) => r.cur.completed },
    { key: "d", label: "تغییر", value: (r) => (r.prev ? r.cur.completed - r.prev.completed : null), render: (r) => (r.prev ? <Delta now={r.cur.completed} before={r.prev.completed} /> : "—") },
    { key: "u", label: "حجم وزن‌دار", kind: "count", value: (r) => r.cur.units },
    { key: "h", label: "ساعت", kind: "count", value: (r) => r.cur.hours },
    { key: "hp", label: "ساعت/تسک", kind: "avg", value: (r) => r.cur.hoursPerTask },
    { key: "ot", label: "به‌موقع", kind: "rate", value: (r) => r.cur.onTimeRate, title: "نرخ وقتی حداقل ۵ تسک دارای ددلاین باشد نمایش داده می‌شود" },
    { key: "cy", label: "زمان انجام", kind: "days", value: (r) => r.cur.cycleMedian },
    { key: "rt", label: "برگشت", kind: "count", value: (r) => r.cur.returns },
    { key: "o", label: "صف باز", kind: "count", value: (r) => r.open.open },
    { key: "od", label: "معوق", kind: "count", value: (r) => r.open.overdue },
    ...(m.shift ? [
      { key: "s", label: "شیفت", kind: "count", value: (r) => (r.person.shift ? r.cur.shifts : null) },
      { key: "cl", label: "بسته‌شدن لاگ", kind: "rate", value: (r) => (r.person.shift ? r.cur.closureRate : null) },
      { key: "rn", label: "روتین", kind: "rate", value: (r) => (r.person.shift ? r.cur.routineRate : null) },
      { key: "io", label: "IOC", kind: "count", value: (r) => (r.person.shift ? r.cur.iocs : null) },
      { key: "tk", label: "تیکت", kind: "count", value: (r) => (r.person.shift ? r.cur.tickets : null) },
    ] : []),
    { key: "sp", label: "روند", sort: false, value: () => null, render: (r) => <Sparkline values={r.spark} width={76} height={22} /> },
  ];

  if (!m.rows.length) return <Panel><AnEmpty title="کارشناسی در این دامنه نیست">فیلترها را تغییر دهید یا اعضای تیم را از صفحه Team اضافه کنید.</AnEmpty></Panel>;

  return (
    <>
      <Panel
        title="همه کارشناسان"
        meta={`${faDigits(shown.length)} نفر · الفبایی؛ مرتب‌سازی با کلیک روی سرستون`}
        actions={
          <div className="search an-no-print" style={{ width: 220 }}>
            <Icon name="search" />
            <input type="search" className="input" placeholder="جست‌وجوی نام" aria-label="جست‌وجوی کارشناس" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={shown}
          onRowClick={(r) => setParam("person", r.person.id)}
          caption="آمار کارشناسان"
          testId="people-table"
          empty={<AnEmpty icon="search" title="کسی پیدا نشد">نامی شبیه «{q}» در این فهرست نیست.</AnEmpty>}
        />
      </Panel>

      <ChartPanel
        title={`توزیع «${def.label}» میان کارشناسان`}
        question="پراکندگی را نشان می‌دهد، نه رتبه را: هر نقطه یک نفر، خط عمودی میانه. روی نقطه کلیک کنید."
        build={dist}
        height={80 + 56 * Math.max(1, m.groups.length)}
        onChartClick={(e) => e.data?.id && setParam("person", e.data.id)}
        actions={
          <select className="input input-sm" style={{ width: 170 }} value={metric} onChange={(e) => setParam("metric", e.target.value)} aria-label="شاخص توزیع">
            {DIST_METRICS.filter((k) => METRICS[k].area !== "soc" || m.shift).map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
          </select>
        }
        table={{ columns: [{ key: "n", label: "کارشناس", value: (r) => r.person.name }, { key: "t", label: "تیم", value: (r) => groupFa(r.person.group) }, { key: "v", label: def.label, kind: def.kind, value: (r) => r.cur[metric] }], rows: distRows }}
        fileName={`distribution-${metric}`}
      />
      {person && m.rows.some((r) => r.person.id === person) && <PersonDrawer id={person} onClose={() => setParam("person", "")} />}
    </>
  );
}
