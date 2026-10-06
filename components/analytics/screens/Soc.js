"use client";

import { useCallback, useMemo, useState } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { AlertCard } from "@/components/analytics/blocks";
import { hbarOption, heatmapOption, lineOption, stackedOption } from "@/components/analytics/chartOptions";
import PersonDrawer from "@/components/analytics/PersonDrawer";
import { AnEmpty, ChartPanel, DataTable, Delta, Kpi, Sparkline } from "@/components/analytics/ui";
import { MetricGrid } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/layout";
import { buildAlerts } from "@/lib/analytics/alerts";
import { faDate, faDigits } from "@/lib/analytics/calendar";
import { fmtInt, fmtNum, fmtPct } from "@/lib/analytics/format";
import { ACTIVITIES_FA, SHIFT_FA, SHIFT_KEYS } from "@/lib/analytics/labels";
import { bucketStats, dailySeries, idsOf, stats } from "@/lib/analytics/metrics";
import { buckets } from "@/lib/analytics/periods";

// Short column labels for the heatmap; the full activity name is in the tooltip and the table.
const ACT_SHORT = ["Splunk", "فایل IP", "اسکنر و سنسور", "گزارش ترافیک", "Grafana", "سایت مرکز", "اخبار امنیتی", "MISP و IOC"];

export default function Soc() {
  return (
    <AnalyticsFrame title="عملیات شیفت SOC" subtitle="فقط تحلیلگران SOC (L1 تا L3)">
      <SocBody />
    </AnalyticsFrame>
  );
}

function SocBody() {
  const a = useAnalytics();
  const { view, range, cmp, gran } = a;
  const [person, setPerson] = useState(null);
  const m = useMemo(() => {
    const analysts = view.people.filter((p) => p.shift);
    const ids = idsOf(analysts);
    const b = buckets(range.from, range.end, gran);
    const rows = analysts
      .map((p) => ({ id: p.id, person: p, cur: stats(view, [p.id], range), prev: cmp ? stats(view, [p.id], cmp) : null }))
      .filter((r) => r.person.active || r.cur.shifts)
      .sort((x, y) => x.person.name.localeCompare(y.person.name, "fa"));
    const shiftAlert = buildAlerts({ ...view, tasks: [] }, {}).find((x) => x.id === "missed-logs") ?? null;
    return {
      ids, rows, b, shiftAlert,
      cur: stats(view, ids, range),
      prev: cmp ? stats(view, ids, cmp) : null,
      series: bucketStats(view, ids, b),
      iocs: dailySeries(view, ids, range.from, range.end, "iocs"),
      tickets: dailySeries(view, ids, range.from, range.end, "tickets"),
    };
  }, [view, range, cmp, gran]);
  const { cur, prev } = m;
  const short = cmp?.short;

  const heat = useCallback((t) => heatmapOption(t, {
    xLabels: ACT_SHORT, xTip: ACTIVITIES_FA, yLabels: m.rows.map((r) => r.person.name),
    data: m.rows.flatMap((r, y) => r.cur.activityRates.map((v, x) => [x, y, v])), kind: "rate", max: 1,
  }), [m]);
  const types = useCallback((t) => stackedOption(t, {
    rows: m.rows.map((r) => ({ label: r.person.name, parts: SHIFT_KEYS.map((k) => r.cur.shiftTypes[k]) })), percent: false,
    parts: SHIFT_KEYS.map((k) => ({ name: SHIFT_FA[k], color: t[`shift-${k}`] })),
  }), [m]);
  const daily = (key, name) => (t) => lineOption(t, { labels: m[key].map(([d]) => faDate(d, { year: false })), bars: true, series: [{ name, data: m[key].map(([, v]) => v) }] });
  const iocBuild = useCallback(daily("iocs", "IOC"), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticketBuild = useCallback(daily("tickets", "تیکت"), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const acts = useCallback((t) => hbarOption(t, { rows: ACTIVITIES_FA.map((label, i) => ({ label, value: cur.activityRates[i], note: `${faDigits(cur.activityN[i])} شیفت` })).filter((r) => r.value !== null), kind: "rate", max: 1, labelWidth: 260 }), [cur]);

  if (!m.ids.length) return <Panel><AnEmpty icon="shift" title="تحلیلگر SOC در این دامنه نیست">شیفت‌لاگ فقط برای تحلیلگران SOC (L1 تا L3) ثبت می‌شود.</AnEmpty></Panel>;

  const typeCounts = SHIFT_KEYS.map((k) => cur.shiftTypes[k]);
  const columns = [
    { key: "n", label: "تحلیلگر", value: (r) => r.person.name, render: (r) => <span className="an-person">{r.person.name}<small>{r.person.level}</small></span> },
    { key: "s", label: "شیفت", kind: "count", value: (r) => r.cur.shifts },
    ...SHIFT_KEYS.map((k) => ({ key: k, label: SHIFT_FA[k], kind: "count", value: (r) => r.cur.shiftTypes[k] })),
    { key: "h", label: "ساعت شیفت", kind: "count", value: (r) => r.cur.shiftHours },
    { key: "c", label: "بسته‌شدن لاگ", kind: "rate", value: (r) => r.cur.closureRate },
    { key: "m", label: "جامانده", kind: "count", value: (r) => r.cur.missed },
    { key: "r", label: "روتین", kind: "rate", value: (r) => r.cur.routineRate },
    { key: "i", label: "IOC", kind: "count", value: (r) => r.cur.iocs },
    { key: "t", label: "تیکت", kind: "count", value: (r) => r.cur.tickets },
    { key: "rp", label: "گزارش ترافیک", kind: "count", value: (r) => r.cur.reports },
    { key: "is", label: "Issue", kind: "count", value: (r) => r.cur.issues },
  ];

  return (
    <>
      <MetricGrid label="شاخص‌های شیفت SOC">
        <Kpi label="شیفت‌ها" icon="cal" value={fmtInt(cur.shifts)} foot={SHIFT_KEYS.map((k, i) => `${SHIFT_FA[k]} ${faDigits(typeCounts[i])}`).join(" · ")} delta={prev && <Delta now={cur.shifts} before={prev.shifts} label={short} />} />
        <Kpi label="بسته‌شدن شیفت‌لاگ" icon="shift" value={fmtPct(cur.closureRate)} tone={cur.missed ? "alert" : undefined} delta={prev && cur.closureRate !== null && <Delta now={cur.closureRate} before={prev.closureRate} kind="rate" label={short} />} foot={cur.missed ? `${faDigits(cur.missed)} شیفت‌لاگ جامانده` : "بدون شیفت‌لاگ جامانده"} />
        <Kpi label="انجام روتین" icon="checkCircle" value={fmtPct(cur.routineRate)} delta={prev && cur.routineRate !== null && <Delta now={cur.routineRate} before={prev.routineRate} kind="rate" label={short} />} spark={<Sparkline values={m.series.map((x) => x.routineRate)} />} />
        <Kpi label="IOC ثبت‌شده" icon="shield" value={fmtInt(cur.iocs)} delta={prev && <Delta now={cur.iocs} before={prev.iocs} label={short} />} foot={`${fmtNum(cur.iocPerShift)} به ازای هر شیفت‌لاگ`} spark={<Sparkline values={m.series.map((x) => x.iocs)} />} />
        <Kpi label="تیکت (تعداد)" icon="inbox" value={fmtInt(cur.tickets)} delta={prev && <Delta now={cur.tickets} before={prev.tickets} label={short} />} foot={`${fmtNum(cur.ticketsPerShift)} به ازای هر شیفت‌لاگ`} spark={<Sparkline values={m.series.map((x) => x.tickets)} />} />
        <Kpi label="گزارش ترافیک و Issue" icon="report" value={fmtInt(cur.reports)} unit="گزارش" foot={`${faDigits(cur.issues)} Issue گزارش‌شده`} />
      </MetricGrid>

      {m.shiftAlert && <Panel title="شیفت‌لاگ‌های کامل‌نشده" meta="۳ روز گذشته"><AlertCard alert={m.shiftAlert} open /></Panel>}

      <ChartPanel
        title="انجام هر فعالیت روتین به تفکیک تحلیلگر"
        question="کدام فعالیت، نزد چه کسی، مدام جا می‌ماند؟ تیره‌تر یعنی درصد انجام بیشتر؛ خانه خالی یعنی آن فعالیت در شیفت‌های او نبوده."
        build={heat}
        height={90 + 30 * m.rows.length}
        onChartClick={(e) => m.rows[e.value?.[1]] && setPerson(m.rows[e.value[1]].id)}
        table={{ columns: [{ key: "n", label: "تحلیلگر", value: (r) => r.person.name }, ...ACTIVITIES_FA.map((l, i) => ({ key: `a${i}`, label: l, kind: "rate", value: (r) => r.cur.activityRates[i] }))], rows: m.rows }}
        fileName="routine-by-analyst"
        testId="soc-heatmap"
      />

      <div className="an-row">
        <ChartPanel title="درصد انجام هر فعالیت (کل SOC)" question="کدام فعالیت روتین بیشتر جا می‌ماند؟" build={acts} height={300}
          table={{ columns: [{ key: "l", label: "فعالیت", value: (r) => r.label }, { key: "v", label: "درصد انجام", kind: "rate", value: (r) => r.v }, { key: "n", label: "شیفت", kind: "count", value: (r) => r.n }], rows: ACTIVITIES_FA.map((label, i) => ({ id: i, label, v: cur.activityRates[i], n: cur.activityN[i] })) }}
          fileName="activity-completion" />
        <ChartPanel title="توزیع نوع شیفت هر تحلیلگر" question="شیفت‌های شب و تا ساعت ۲۰ منصفانه تقسیم شده‌اند؟" build={types} height={70 + 30 * m.rows.length}
          table={{ columns: [{ key: "n", label: "تحلیلگر", value: (r) => r.person.name }, ...SHIFT_KEYS.map((k) => ({ key: k, label: SHIFT_FA[k], kind: "count", value: (r) => r.cur.shiftTypes[k] }))], rows: m.rows }}
          fileName="shift-types" />
      </div>

      <div className="an-row">
        <ChartPanel title="IOC ثبت‌شده در هر روز" build={iocBuild} height={220} fileName="ioc-daily"
          table={{ columns: [{ key: "d", label: "روز", value: (r) => faDate(r[0]) }, { key: "v", label: "IOC", kind: "count", value: (r) => r[1] }], rows: m.iocs }} />
        <ChartPanel title="تیکت ثبت‌شده در هر روز (تعداد)" build={ticketBuild} height={220} fileName="tickets-daily"
          table={{ columns: [{ key: "d", label: "روز", value: (r) => faDate(r[0]) }, { key: "v", label: "تیکت", kind: "count", value: (r) => r[1] }], rows: m.tickets }} />
      </div>

      <Panel title="تحلیلگران" meta="الفبایی · برای خلاصه روی ردیف کلیک کنید">
        <DataTable columns={columns} rows={m.rows} onRowClick={(r) => setPerson(r.id)} caption="آمار شیفت تحلیلگران" testId="soc-table" />
      </Panel>
      {person && <PersonDrawer id={person} onClose={() => setPerson(null)} />}
    </>
  );
}
