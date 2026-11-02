"use client";

import { useI18n as useExtraI18n } from "@/components/I18nProvider";

import { useI18n as useAnalyticsI18n } from "@/components/I18nProvider";

import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { stripOption } from "@/components/analytics/chartOptions";
import PersonDrawer from "@/components/analytics/PersonDrawer";
import { AnEmpty, ChartPanel, DataTable, Delta, Sparkline } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { Panel } from "@/components/ui/layout";
import { faDigits } from "@/lib/analytics/calendar";
import { median } from "@/lib/analytics/format";
import { ROLE_FA, QUAL_FA, groupFa } from "@/lib/analytics/labels";
import { METRICS, bucketStats, groupsIn, peopleRows } from "@/lib/analytics/metrics";
import { buckets } from "@/lib/analytics/periods";

const DIST_METRICS = ["completed", "units", "hours", "hoursPerTask", "onTimeRate", "cycleMedian", "created", "tickets", "iocs", "routineRate"];

export default function People() {
  const { t: __analyticsTr } = useAnalyticsI18n();
  return (
    <AnalyticsFrame title={__analyticsTr("کارشناسان")} subtitle="آماری، بدون امتیاز و رتبه">
      <PeopleBody />
    </AnalyticsFrame>
  );
}

function PeopleBody() {
  const { t: __extraTr } = useExtraI18n();
  const { t: __analyticsTr } = useAnalyticsI18n();
  const a = useAnalytics();
  const { view, range, cmp, gran, params, setParam } = a;
  const person = params.get("person");
  const metric = DIST_METRICS.includes(params.get("metric")) ? params.get("metric") : "completed";
  const m = useMemo(() => {
    const b = buckets(range.from, range.end, gran, a.locale);
    const rows = peopleRows(view, range, cmp).map((r) => ({ ...r, id: r.person.id, spark: bucketStats(view, [r.person.id], b).map((x) => x.completed) }));
    return { rows, groups: groupsIn(view), shift: rows.some((r) => r.person.shift) };
  }, [view, range, cmp, gran]);
  const reviews = useMemo(() => [...(view.reviews ?? [])].sort(
    (a, b) => b.month.localeCompare(a.month) || a.a.localeCompare(b.a)
  ), [view]);
  const def = METRICS[metric];

  const distRows = m.rows.filter((r) => def.area !== "soc" || r.person.shift);
  const dist = useCallback((t) => stripOption(t, {
    groups: m.groups.map((g) => g.fa),
    points: distRows.map((r) => ({ id: r.person.id, name: r.person.name, value: r.cur[metric], groupIndex: m.groups.findIndex((g) => g.name === r.person.group) })),
    kind: def.kind, median: median(distRows.map((r) => r.cur[metric])),
  }), [m, metric]); // eslint-disable-line react-hooks/exhaustive-deps



  if (!m.rows.length) return <Panel><AnEmpty title={__analyticsTr("کارشناسی در این دامنه نیست")}>{"" + __analyticsTr("فیلترها را تغییر دهید یا اعضای تیم را از صفحه Team اضافه کنید.") + ""}</AnEmpty></Panel>;

  return (
    <>
      <PeopleSearchTable m={m} setParam={setParam} />

      <Panel title={__analyticsTr("سوابق ارزیابی ماهانه شیفت‌لاگ")} meta={__analyticsTr("جدیدترین ارزیابی‌ها در ابتدا نمایش داده می‌شوند")}>
        {!reviews.length ? <p className="panel-body muted">{"" + __analyticsTr("برای این استان و دوره، ارزیابی ماهانه ثبت نشده است.") + ""}</p> : (
          <DataTable dense columns={[
            { key: "month", label: __extraTr("ماه ارزیابی"), value: (r) => r.month },
            { key: "name", label: __analyticsTr("کارشناس"), value: (r) => m.rows.find((p) => p.person.id === r.a)?.person.name ?? "—" },
            { key: "rating", label: __extraTr("نتیجه"), value: (r) => QUAL_FA[r.rating] ?? r.rating },
            { key: "note", label: __extraTr("توضیحات ارزیابی"), value: (r) => r.note || "—" },
          ]} rows={reviews.map((r, i) => ({ ...r, id: `${r.a}-${r.month}-${i}` }))} caption="سوابق ارزیابی کارشناسان" />
        )}
      </Panel>

      <ChartPanel
        title={`توزیع «${def.label}» میان کارشناسان`}
        question="پراکندگی را نشان می‌دهد، نه رتبه را: هر نقطه یک نفر، خط عمودی میانه. روی نقطه کلیک کنید."
        build={dist}
        height={80 + 56 * Math.max(1, m.groups.length)}
        onChartClick={(e) => e.data?.id && setParam("person", e.data.id)}
        actions={
          <select className="input input-sm" style={{ width: 170 }} value={metric} onChange={(e) => setParam("metric", e.target.value)} aria-label={__analyticsTr("شاخص توزیع")}>
            {DIST_METRICS.filter((k) => METRICS[k].area !== "soc" || m.shift).map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
          </select>
        }
        table={{ columns: [{ key: "n", label: __analyticsTr("کارشناس"), value: (r) => r.person.name }, { key: "t", label: __analyticsTr("تیم"), value: (r) => groupFa(r.person.group) }, { key: "v", label: def.label, kind: def.kind, value: (r) => r.cur[metric] }], rows: distRows }}
        fileName={`distribution-${metric}`}
      />
      {person && m.rows.some((r) => r.person.id === person) && <PersonDrawer id={person} onClose={() => setParam("person", "")} />}
    </>
  );
}

// Search input state belongs to this small table subtree. ECharts, detailed
// employee metrics, and the province's history do not rerender per keystroke.
const PeopleSearchTable = memo(function PeopleSearchTable({ m, setParam }) {
  const { t: __extraTr } = useExtraI18n();
  const { t: __analyticsTr } = useAnalyticsI18n();
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const shown = useMemo(() => {
    const query = deferredQ.trim();
    return query ? m.rows.filter((r) => r.person.name.includes(query)) : m.rows;
  }, [deferredQ, m.rows]);

  const columns = [
    { key: "name", label: __analyticsTr("کارشناس"), value: (r) => r.person.name, render: (r) => <span className="an-person">{r.person.name}<small>{[r.person.province || "استان تعیین‌نشده", groupFa(r.person.group), r.person.level, ROLE_FA[r.person.role], r.person.active ? null : "غیرفعال"].filter(Boolean).join(" · ")}</small></span> },
    { key: "c", label: __extraTr("تکمیل‌شده"), kind: "count", value: (r) => r.cur.completed },
    { key: "good", label: __extraTr("عالی/خوب"), kind: "count", value: (r) => r.cur.quality[0] + r.cur.quality[1] },
    { key: "needs", label: __extraTr("نیاز بهبود"), kind: "count", value: (r) => r.cur.quality[3] },
    { key: "d", label: __extraTr("تغییر"), value: (r) => (r.prev ? r.cur.completed - r.prev.completed : null), render: (r) => (r.prev ? <Delta now={r.cur.completed} before={r.prev.completed} /> : "—") },
    { key: "u", label: __extraTr("حجم وزن‌دار"), kind: "count", value: (r) => r.cur.units },
    { key: "h", label: __extraTr("ساعت"), kind: "count", value: (r) => r.cur.hours },
    { key: "hp", label: __extraTr("ساعت/تسک"), kind: "avg", value: (r) => r.cur.hoursPerTask },
    { key: "ot", label: __extraTr("به‌موقع"), kind: "rate", value: (r) => r.cur.onTimeRate, title: __extraTr("نرخ وقتی حداقل ۵ تسک دارای ددلاین باشد نمایش داده می‌شود") },
    { key: "cy", label: __extraTr("زمان انجام"), kind: "days", value: (r) => r.cur.cycleMedian },
    { key: "rt", label: __extraTr("برگشت"), kind: "count", value: (r) => r.cur.returns },
    { key: "o", label: __extraTr("صف باز"), kind: "count", value: (r) => r.open.open },
    { key: "od", label: __extraTr("معوق"), kind: "count", value: (r) => r.open.overdue },
    ...(m.shift ? [
      { key: "s", label: __analyticsTr("شیفت"), kind: "count", value: (r) => (r.person.shift ? r.cur.shifts : null) },
      { key: "off", label: __analyticsTr("تعطیل شیفت"), kind: "count", value: (r) => (r.person.shift ? r.cur.offDays : null) },
      { key: "leave", label: __analyticsTr("مرخصی"), kind: "count", value: (r) => (r.person.shift ? r.cur.leaveDays : null) },
      { key: "cl", label: __extraTr("بسته‌شدن لاگ"), kind: "rate", value: (r) => (r.person.shift ? r.cur.closureRate : null) },
      { key: "rn", label: __extraTr("روتین"), kind: "rate", value: (r) => (r.person.shift ? r.cur.routineRate : null) },
      { key: "io", label: "IOC", kind: "count", value: (r) => (r.person.shift ? r.cur.iocs : null) },
      { key: "tk", label: __analyticsTr("تیکت"), kind: "count", value: (r) => (r.person.shift ? r.cur.tickets : null) },
    ] : []),
    { key: "sp", label: __extraTr("روند"), sort: false, value: () => null, render: (r) => <Sparkline values={r.spark} width={76} height={22} /> },
  ];
  return (
      <Panel
        title={__analyticsTr("همه کارشناسان")}
        meta={`${faDigits(shown.length)} نفر · الفبایی؛ مرتب‌سازی با کلیک روی سرستون`}
        actions={
          <div className="search an-no-print" style={{ width: 220 }}>
            <Icon name="search" />
            <input type="search" className="input" placeholder={__analyticsTr("جست‌وجوی نام")} aria-label={__analyticsTr("جست‌وجوی کارشناس")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={shown}
          onRowClick={(r) => setParam("person", r.person.id)}
          caption="آمار کارشناسان"
          testId="people-table"
          empty={<AnEmpty icon="search" title={__analyticsTr("کسی پیدا نشد")}>{"" + __analyticsTr("نامی شبیه «") + ""}{q}{"" + __analyticsTr("» در این فهرست نیست.") + ""}</AnEmpty>}
        />
      </Panel>
  );
});
