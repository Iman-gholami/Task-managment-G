"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { AlertList, InsightList, Key, StatusBanner } from "@/components/analytics/blocks";
import { lineOption, stackedOption } from "@/components/analytics/chartOptions";
import { AnEmpty, ChartPanel, DataTable, Delta, Kpi, Sparkline } from "@/components/analytics/ui";
import { MetricGrid } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/layout";
import { buildAlerts, overallStatus } from "@/lib/analytics/alerts";
import { faDigits } from "@/lib/analytics/calendar";
import { INSIGHTS } from "@/lib/analytics/config";
import { fmtInt, fmtNum, fmtPct } from "@/lib/analytics/format";
import { buildInsights } from "@/lib/analytics/insights";
import { CX_FA, QUAL_FA, QUAL_KEYS } from "@/lib/analytics/labels";
import { backlogSeries, bucketStats, idsOf, openStats, stats, teamRows } from "@/lib/analytics/metrics";
import { buckets } from "@/lib/analytics/periods";

export default function Overview() {
  return (
    <AnalyticsFrame title="داشبورد مدیریتی">
      <OverviewBody />
    </AnalyticsFrame>
  );
}

/** Model for the overview: one pass over the facts for the period, the comparison and the buckets. */
function useOverview() {
  const { view, range, cmp, gran } = useAnalytics();
  return useMemo(() => {
    const b = buckets(range.from, range.end, gran);
    const pb = cmp ? buckets(cmp.from, cmp.to, gran) : [];
    const shiftIds = idsOf(view.people.filter((p) => p.shift));
    const alerts = buildAlerts(view, { range, cmp });
    return {
      b, pb,
      cur: stats(view, null, range),
      prev: cmp ? stats(view, null, cmp) : null,
      bs: bucketStats(view, null, b),
      pbs: bucketStats(view, null, pb),
      backlog: backlogSeries(view, null, b),
      open: openStats(view, null),
      shiftIds,
      soc: shiftIds.length ? stats(view, shiftIds, range) : null,
      socPrev: shiftIds.length && cmp ? stats(view, shiftIds, cmp) : null,
      socSeries: shiftIds.length ? bucketStats(view, shiftIds, b) : null,
      alerts,
      status: overallStatus(alerts),
      insights: buildInsights(view, { range, cmp }),
      teams: teamRows(view, range, cmp).map((t) => ({ ...t, spark: bucketStats(view, idsOf(t.people), b).map((x) => x.completed) })),
    };
  }, [view, range, cmp, gran]);
}

function OverviewBody() {
  const a = useAnalytics();
  const router = useRouter();
  const { cmp } = a;
  const m = useOverview();
  const { cur, prev, open, soc, socPrev } = m;
  const cmpLabel = cmp?.short;
  const noData = a.view.people.length === 0;

  const flow = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label),
    partial: m.b.map((x) => x.partial),
    series: [
      { name: "تکمیل‌شده", data: m.bs.map((x) => x.completed), color: t["cat-1"], area: true },
      { name: "ایجادشده", data: m.bs.map((x) => x.created), color: t["cat-2"] },
    ],
    prev: cmp ? { name: "تکمیل‌شده در دوره مقایسه", data: m.pbs.map((x) => x.completed), labels: m.pb.map((x) => x.label) } : null,
  }), [m, cmp]);

  const cxMix = useCallback((t) => stackedOption(t, {
    rows: [{ label: "کل واحد", parts: cur.cx }, ...m.teams.map((x) => ({ label: x.fa, parts: x.cur.cx }))],
    parts: CX_FA.map((name, i) => ({ name, color: t.ramp[i] })),
  }), [m, cur]);
  const qualityMix = useCallback((t) => stackedOption(t, {
    rows: [{ label: "کل واحد", parts: cur.quality }, ...m.teams.map((x) => ({ label: x.fa, parts: x.cur.quality }))],
    parts: QUAL_KEYS.map((k, i) => ({ name: QUAL_FA[k], color: t.ramp[3 - i] })),
  }), [m, cur]);

  if (noData) {
    return (
      <Panel>
        <AnEmpty
          icon="perf"
          title="هنوز داده‌ای برای گزارش ثبت نشده است"
          action={a.manager && <button type="button" className="btn btn-primary" onClick={() => a.setFilters({ demo: "1" })}>نمایش با داده نمایشی</button>}
        >
          آمار از تسک‌ها، شیفت‌لاگ‌ها و تیکت‌های ثبت‌شده در سیستم ساخته می‌شود. برای آشنایی با داشبورد پیش از ثبت داده واقعی، داده نمایشی را روشن کنید.
        </AnEmpty>
      </Panel>
    );
  }

  const teamColumns = [
    { key: "team", label: "تیم", value: (r) => r.fa, render: (r) => <span className="an-person"><b>{r.fa}</b></span> },
    { key: "n", label: "کارشناسان", kind: "count", value: (r) => r.headcount },
    { key: "done", label: "تکمیل‌شده", kind: "count", value: (r) => r.cur.completed },
    { key: "chg", label: "تغییر", value: (r) => (r.prev ? r.cur.completed - r.prev.completed : null), render: (r) => (r.prev ? <Delta now={r.cur.completed} before={r.prev.completed} /> : "—") },
    { key: "pc", label: "سرانه تکمیل‌شده", kind: "avg", value: (r) => r.pc.completed },
    { key: "units", label: "حجم وزن‌دار", kind: "count", value: (r) => r.cur.units },
    { key: "hours", label: "ساعت", kind: "count", value: (r) => r.cur.hours },
    { key: "ot", label: "تحویل به‌موقع", kind: "rate", value: (r) => r.cur.onTimeRate },
    { key: "open", label: "صف باز", kind: "count", value: (r) => r.open.open },
    { key: "od", label: "معوق", kind: "count", value: (r) => r.open.overdue, render: (r) => (r.open.overdue ? <span className="overdue">{fmtInt(r.open.overdue)}</span> : <span className="zero">۰</span>) },
    { key: "trend", label: "روند تکمیل‌شده", sort: false, value: () => null, render: (r) => <Sparkline values={r.spark} width={84} height={24} /> },
  ];

  const flowTable = {
    columns: [
      { key: "b", label: "بازه", value: (r) => r.label },
      { key: "c", label: "تکمیل‌شده", kind: "count", value: (r) => r.completed },
      { key: "n", label: "ایجادشده", kind: "count", value: (r) => r.created },
      { key: "q", label: "صف باز در پایان بازه", kind: "count", value: (r) => r.backlog },
      ...(cmp ? [{ key: "p", label: "تکمیل‌شده (مقایسه)", kind: "count", value: (r) => r.prev }] : []),
    ],
    rows: m.b.map((x, i) => ({ id: x.from, label: x.label, completed: m.bs[i].completed, created: m.bs[i].created, backlog: m.backlog[i], prev: m.pbs[i]?.completed ?? null })),
  };
  const mixTable = (key, labels) => ({
    columns: [{ key: "l", label: "تیم", value: (r) => r.label }, ...labels.map((l, i) => ({ key: `v${i}`, label: l, kind: "count", value: (r) => r.parts[i] }))],
    rows: [{ id: "all", label: "کل واحد", parts: cur[key] }, ...m.teams.map((x) => ({ id: x.key, label: x.fa, parts: x.cur[key] }))],
  });

  return (
    <>
      <StatusBanner status={m.status} />

      <MetricGrid label="شاخص‌های اصلی">
        <Kpi
          label="تسک‌های تکمیل‌شده" icon="checkCircle" testId="kpi-completed"
          hint="تسک‌هایی که تاریخ تأییدشان در این دوره است"
          value={fmtInt(cur.completed)}
          delta={prev && <Delta now={cur.completed} before={prev.completed} label={cmpLabel} />}
          spark={<Sparkline values={m.bs.map((x) => x.completed)} />}
          href={a.href("/analytics/trends", { metric: "completed" })}
        />
        <Kpi
          label="حجم کار وزن‌دار" icon="bars"
          hint="جمع سطح پیچیدگی تسک‌های تکمیل‌شده: ساده ۱، متوسط ۲، پیچیده ۳، پیشرفته ۴"
          value={fmtInt(cur.units)}
          delta={prev && <Delta now={cur.units} before={prev.units} label={cmpLabel} />}
          foot={cur.complexShare !== null ? `${fmtPct(cur.complexShare)} پیچیده و پیشرفته` : null}
          spark={<Sparkline values={m.bs.map((x) => x.units)} />}
          href={a.href("/analytics/trends", { metric: "units" })}
        />
        <Kpi
          label="ساعت ثبت‌شده" icon="clock"
          hint="جمع ساعت تسک‌های تکمیل‌شده. ساعت دستی وارد می‌شود؛ آن را کنار تعداد تسک بخوانید."
          value={fmtNum(cur.hours, 0)} unit="ساعت"
          delta={prev && <Delta now={cur.hours} before={prev.hours} label={cmpLabel} />}
          foot={cur.hoursPerTask !== null ? `${fmtNum(cur.hoursPerTask)} ساعت به ازای هر تسک` : null}
          spark={<Sparkline values={m.bs.map((x) => x.hours)} />}
          href={a.href("/analytics/trends", { metric: "hours" })}
        />
        <Kpi
          label="تحویل به‌موقع" icon="cal"
          hint="درصد تسک‌های تکمیل‌شده‌ای که تا ددلاین تأیید شده‌اند (فقط تسک‌های دارای ددلاین)"
          value={cur.onTimeRate === null ? "—" : fmtPct(cur.onTimeRate)}
          delta={prev && cur.onTimeRate !== null && <Delta now={cur.onTimeRate} before={prev.onTimeRate} kind="rate" label={cmpLabel} />}
          foot={`از ${faDigits(cur.onTimeN)} تسک دارای ددلاین`}
          href={a.href("/analytics/trends", { metric: "onTimeRate" })}
        />
        <Kpi
          label="صف کار باز (اکنون)" icon="tasks" testId="kpi-open"
          hint="همه تسک‌های انجام‌نشده و لغونشده در همین لحظه، مستقل از بازه"
          value={fmtInt(open.open)}
          tone={open.overdue ? "alert" : undefined}
          foot={`${faDigits(open.overdue)} معوق · ${faDigits(open.blocked)} مسدود · ${faDigits(open.review)} در بازبینی`}
          href={a.href("/analytics/alerts")}
        />
        {soc ? (
          <Kpi
            label="بسته‌شدن شیفت‌لاگ SOC" icon="shift"
            hint="شیفت‌لاگ‌های کامل‌شده از میان شیفت‌های گذشته در این دوره"
            value={soc.closureRate === null ? "—" : fmtPct(soc.closureRate)}
            tone={soc.missed > 0 && soc.closureRate < 0.9 ? "alert" : undefined}
            delta={socPrev && soc.closureRate !== null && <Delta now={soc.closureRate} before={socPrev.closureRate} kind="rate" label={cmpLabel} />}
            foot={`تیکت ${faDigits(soc.tickets)} · IOC ${faDigits(soc.iocs)}`}
            href={a.href("/analytics/soc")}
          />
        ) : (
          <Kpi
            label="تسک‌های ایجادشده" icon="plus"
            value={fmtInt(cur.created)}
            delta={prev && <Delta now={cur.created} before={prev.created} label={cmpLabel} />}
            foot={`خالص صف: ${cur.net > 0 ? "+" : ""}${faDigits(cur.net)}`}
            href={a.href("/analytics/trends", { metric: "created" })}
          />
        )}
      </MetricGrid>

      <div className="an-row">
        <Panel title="هشدارها" meta="وضعیت اکنون" actions={<Link className="btn btn-ghost btn-sm an-no-print" href={a.href("/analytics/alerts")}>همه</Link>}>
          <AlertList alerts={m.alerts} limit={5} />
        </Panel>
        <Panel title="بینش‌های خودکار" meta={cmp ? `نسبت به ${cmp.label}` : "این دوره"} actions={<Link className="btn btn-ghost btn-sm an-no-print" href={a.href("/analytics/alerts")}>همه</Link>}>
          <InsightList insights={m.insights} limit={INSIGHTS.maxOnOverview} />
        </Panel>
      </div>

      <ChartPanel
        title="ورودی و خروجی کار"
        question="صف کار بزرگ می‌شود یا کوچک؟ اگر خط ایجادشده بالاتر از تکمیل‌شده بماند، صف رشد می‌کند."
        build={flow}
        height={280}
        table={flowTable}
        fileName="ورودی-خروجی-کار"
        testId="chart-flow"
        footer={<>
          <span>صف باز در پایان دوره: <b className="strong">{fmtInt(m.backlog.at(-1))}</b> (ابتدای دوره: {fmtInt(m.backlog[0])})</span>
          <span>خالص دوره: {cur.net > 0 ? "+" : ""}{faDigits(cur.net)} تسک</span>
        </>}
      />

      <Panel title="مقایسه تیم‌ها" meta="سرانه = جمع ÷ کارشناسان تیم در دوره · برای جزئیات روی تیم کلیک کنید">
        <DataTable
          columns={teamColumns}
          rows={m.teams}
          rowKey={(r) => r.key}
          onRowClick={(r) => router.push(a.href("/analytics/teams", { team: r.key }))}
          caption="مقایسه تیم‌ها"
          testId="team-table"
        />
      </Panel>

      <div className="an-row">
        <ChartPanel
          title="ترکیب پیچیدگی کار تکمیل‌شده"
          question="حجم کار از کار ساده آمده یا پیچیده؟"
          build={cxMix}
          height={60 + 44 * (m.teams.length + 1)}
          table={mixTable("cx", CX_FA)}
          fileName="ترکیب-پیچیدگی"
          empty={cur.completed === 0 ? <AnEmpty title="تسکی تکمیل نشده">در این بازه تسک تکمیل‌شده‌ای نیست.</AnEmpty> : null}
        />
        <ChartPanel
          title="توزیع کیفیت کار تأییدشده"
          question="کیفیت ثبت‌شده هنگام تأیید در تیم‌ها چگونه پخش شده است؟"
          build={qualityMix}
          height={60 + 44 * (m.teams.length + 1)}
          table={mixTable("quality", QUAL_KEYS.map((k) => QUAL_FA[k]))}
          fileName="توزیع-کیفیت"
          empty={cur.qualityN === 0 ? <AnEmpty title="کیفیتی ثبت نشده">کیفیت هنگام تأیید تسک ثبت می‌شود.</AnEmpty> : null}
          footer={<Key color="var(--viz-4)">تیره‌تر = کیفیت بالاتر</Key>}
        />
      </div>
    </>
  );
}
