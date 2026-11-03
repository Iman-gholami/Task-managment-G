"use client";

import { useI18n as useExtraI18n } from "@/components/I18nProvider";

import useAnalyticsFormat from "@/components/analytics/useAnalyticsFormat";

import { useI18n as useAnalyticsI18n } from "@/components/I18nProvider";

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
  const { t: __analyticsTr } = useAnalyticsI18n();
  return (
    <AnalyticsFrame title={__analyticsTr("داشبورد مدیریتی")}>
      <OverviewBody />
    </AnalyticsFrame>
  );
}

/** Model for the overview: one pass over the facts for the period, the comparison and the buckets. */
function useOverview() {
  const { view, range, cmp, gran, locale } = useAnalytics();
  return useMemo(() => {
    const b = buckets(range.from, range.end, gran, locale);
    const pb = cmp ? buckets(cmp.from, cmp.to, gran, locale) : [];
    const shiftIds = idsOf(view.people.filter((p) => p.shift));
    const alerts = buildAlerts(view, { range, cmp, locale });
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
      insights: buildInsights(view, { range, cmp, locale }),
      teams: teamRows(view, range, cmp).map((t) => ({ ...t, spark: bucketStats(view, idsOf(t.people), b).map((x) => x.completed) })),
    };
  }, [view, range, cmp, gran, locale]);
}

function OverviewBody() {
  const { t: __extraTr } = useExtraI18n();
  const { fmtInt, fmtPct, fmtNum } = useAnalyticsFormat();
  const { t: __analyticsTr, team: teamText } = useAnalyticsI18n();
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
      { name: __extraTr("تکمیل‌شده"), data: m.bs.map((x) => x.completed), color: t["cat-1"], area: true },
      { name: __extraTr("ایجادشده"), data: m.bs.map((x) => x.created), color: t["cat-2"] },
    ],
    prev: cmp ? { name: __extraTr("تکمیل‌شده در دوره مقایسه"), data: m.pbs.map((x) => x.completed), labels: m.pb.map((x) => x.label) } : null,
  }), [m, cmp]);

  const cxMix = useCallback((t) => stackedOption(t, {
    rows: [{ label: __extraTr("کل واحد"), parts: cur.cx }, ...m.teams.map((x) => ({ label: teamText(x.group), parts: x.cur.cx }))],
    parts: CX_FA.map((name, i) => ({ name: __extraTr(name), color: t.ramp[i] })),
  }), [m, cur]);
  const qualityMix = useCallback((t) => stackedOption(t, {
    rows: [{ label: __extraTr("کل واحد"), parts: cur.quality }, ...m.teams.map((x) => ({ label: teamText(x.group), parts: x.cur.quality }))],
    parts: QUAL_KEYS.map((k, i) => ({ name: __extraTr(QUAL_FA[k]), color: t.ramp[3 - i] })),
  }), [m, cur]);

  if (noData) {
    return (
      <Panel>
        <AnEmpty
          icon="perf"
          title={__analyticsTr("هنوز داده‌ای برای گزارش ثبت نشده است")}
          action={a.manager && <button type="button" className="btn btn-primary" onClick={() => a.setFilters({ demo: "1" })}>{"" + __analyticsTr("نمایش با داده نمایشی") + ""}</button>}
        >{"" + __analyticsTr("آمار از تسک‌ها، شیفت‌لاگ‌ها و تیکت‌های ثبت‌شده در سیستم ساخته می‌شود. برای آشنایی با داشبورد پیش از ثبت داده واقعی، داده نمایشی را روشن کنید.") + ""}</AnEmpty>
      </Panel>
    );
  }

  const teamColumns = [
    { key: "team", label: __analyticsTr("تیم"), value: (r) => teamText(r.group), render: (r) => <span className="an-person"><b>{teamText(r.group)}</b></span> },
    { key: "n", label: __analyticsTr("کارشناسان"), kind: "count", value: (r) => r.headcount },
    { key: "done", label: __extraTr("تکمیل‌شده"), kind: "count", value: (r) => r.cur.completed },
    { key: "chg", label: __extraTr("تغییر"), value: (r) => (r.prev ? r.cur.completed - r.prev.completed : null), render: (r) => (r.prev ? <Delta now={r.cur.completed} before={r.prev.completed} /> : "—") },
    { key: "pc", label: __analyticsTr("سرانه تکمیل‌شده"), kind: "avg", value: (r) => r.pc.completed },
    { key: "units", label: __extraTr("حجم وزن‌دار"), kind: "count", value: (r) => r.cur.units },
    { key: "hours", label: __extraTr("ساعت"), kind: "count", value: (r) => r.cur.hours },
    { key: "ot", label: __analyticsTr("تحویل به‌موقع"), kind: "rate", value: (r) => r.cur.onTimeRate },
    { key: "open", label: __extraTr("صف باز"), kind: "count", value: (r) => r.open.open },
    { key: "od", label: __extraTr("معوق"), kind: "count", value: (r) => r.open.overdue, render: (r) => (r.open.overdue ? <span className="overdue">{fmtInt(r.open.overdue)}</span> : <span className="zero">{fmtInt(0)}</span>) },
    { key: "trend", label: __extraTr("روند تکمیل‌شده"), sort: false, value: () => null, render: (r) => <Sparkline values={r.spark} width={84} height={24} /> },
  ];

  const flowTable = {
    columns: [
      { key: "b", label: __analyticsTr("بازه"), value: (r) => r.label },
      { key: "c", label: __extraTr("تکمیل‌شده"), kind: "count", value: (r) => r.completed },
      { key: "n", label: __extraTr("ایجادشده"), kind: "count", value: (r) => r.created },
      { key: "q", label: __extraTr("صف باز در پایان بازه"), kind: "count", value: (r) => r.backlog },
      ...(cmp ? [{ key: "p", label: __extraTr("تکمیل‌شده (مقایسه)"), kind: "count", value: (r) => r.prev }] : []),
    ],
    rows: m.b.map((x, i) => ({ id: x.from, label: x.label, completed: m.bs[i].completed, created: m.bs[i].created, backlog: m.backlog[i], prev: m.pbs[i]?.completed ?? null })),
  };
  const mixTable = (key, labels) => ({
    columns: [{ key: "l", label: __analyticsTr("تیم"), value: (r) => r.label }, ...labels.map((l, i) => ({ key: `v${i}`, label: __extraTr(l), kind: "count", value: (r) => r.parts[i] }))],
    rows: [{ id: "all", label: __extraTr("کل واحد"), parts: cur[key] }, ...m.teams.map((x) => ({ id: x.key, label: teamText(x.group), parts: x.cur[key] }))],
  });

  return (
    <>
      <StatusBanner status={m.status} />

      <MetricGrid label={__analyticsTr("شاخص‌های اصلی")}>
        <Kpi
          label={__analyticsTr("تسک‌های تکمیل‌شده")} icon="checkCircle" testId="kpi-completed"
          hint={__analyticsTr("تسک‌هایی که تاریخ تأییدشان در این دوره است")}
          value={fmtInt(cur.completed)}
          delta={prev && <Delta now={cur.completed} before={prev.completed} label={cmpLabel} />}
          spark={<Sparkline values={m.bs.map((x) => x.completed)} />}
          href={a.href("/analytics/trends", { metric: "completed" })}
        />
        <Kpi
          label={__analyticsTr("حجم کار وزن‌دار")} icon="bars"
          hint={__analyticsTr("جمع سطح پیچیدگی تسک‌های تکمیل‌شده: ساده ۱، متوسط ۲، پیچیده ۳، پیشرفته ۴")}
          value={fmtInt(cur.units)}
          delta={prev && <Delta now={cur.units} before={prev.units} label={cmpLabel} />}
          foot={cur.complexShare !== null ? a.locale === "fa" ? `${fmtPct(cur.complexShare)} پیچیده و پیشرفته` : `${fmtPct(cur.complexShare)} complex and advanced` : null}
          spark={<Sparkline values={m.bs.map((x) => x.units)} />}
          href={a.href("/analytics/trends", { metric: "units" })}
        />
        <Kpi
          label={__analyticsTr("ساعت ثبت‌شده")} icon="clock"
          hint={__analyticsTr("جمع ساعت تسک‌های تکمیل‌شده. ساعت دستی وارد می‌شود؛ آن را کنار تعداد تسک بخوانید.")}
          value={fmtNum(cur.hours, 0)} unit={__extraTr("ساعت")}
          delta={prev && <Delta now={cur.hours} before={prev.hours} label={cmpLabel} />}
          foot={cur.hoursPerTask !== null ? a.locale === "fa" ? `${fmtNum(cur.hoursPerTask)} ساعت به ازای هر تسک` : `${fmtNum(cur.hoursPerTask)} hours per task` : null}
          spark={<Sparkline values={m.bs.map((x) => x.hours)} />}
          href={a.href("/analytics/trends", { metric: "hours" })}
        />
        <Kpi
          label={__analyticsTr("تحویل به‌موقع")} icon="cal"
          hint={__analyticsTr("درصد تسک‌های تکمیل‌شده‌ای که تا ددلاین تأیید شده‌اند (فقط تسک‌های دارای ددلاین)")}
          value={cur.onTimeRate === null ? "—" : fmtPct(cur.onTimeRate)}
          delta={prev && cur.onTimeRate !== null && <Delta now={cur.onTimeRate} before={prev.onTimeRate} kind="rate" label={cmpLabel} />}
          foot={a.locale === "fa" ? `از ${fmtInt(cur.onTimeN)} تسک دارای ددلاین` : `Of ${fmtInt(cur.onTimeN)} tasks with deadlines`}
          href={a.href("/analytics/trends", { metric: "onTimeRate" })}
        />
        <Kpi
          label={__analyticsTr("صف کار باز (اکنون)")} icon="tasks" testId="kpi-open"
          hint={__analyticsTr("همه تسک‌های انجام‌نشده و لغونشده در همین لحظه، مستقل از بازه")}
          value={fmtInt(open.open)}
          tone={open.overdue ? "alert" : undefined}
          foot={a.locale === "fa" ? `${fmtInt(open.overdue)} معوق · ${fmtInt(open.blocked)} مسدود · ${fmtInt(open.review)} در بازبینی` : `${fmtInt(open.overdue)} overdue · ${fmtInt(open.blocked)} blocked · ${fmtInt(open.review)} in review`}
          href={a.href("/analytics/alerts")}
        />
        {soc ? (
          <Kpi
            label={__analyticsTr("بسته‌شدن شیفت‌لاگ SOC")} icon="shift"
            hint={__analyticsTr("شیفت‌لاگ‌های کامل‌شده از میان شیفت‌های گذشته در این دوره")}
            value={soc.closureRate === null ? "—" : fmtPct(soc.closureRate)}
            tone={soc.missed > 0 && soc.closureRate < 0.9 ? "alert" : undefined}
            delta={socPrev && soc.closureRate !== null && <Delta now={soc.closureRate} before={socPrev.closureRate} kind="rate" label={cmpLabel} />}
            foot={a.locale === "fa" ? `تیکت ${fmtInt(soc.tickets)} · IOC ${fmtInt(soc.iocs)}` : `Tickets ${fmtInt(soc.tickets)} · IOCs ${fmtInt(soc.iocs)}`}
            href={a.href("/analytics/soc")}
          />
        ) : (
          <Kpi
            label={__analyticsTr("تسک‌های ایجادشده")} icon="plus"
            value={fmtInt(cur.created)}
            delta={prev && <Delta now={cur.created} before={prev.created} label={cmpLabel} />}
            foot={`${a.locale === "fa" ? "خالص صف" : "Net queue"}: ${cur.net > 0 ? "+" : ""}${fmtInt(cur.net)}`}
            href={a.href("/analytics/trends", { metric: "created" })}
          />
        )}
      </MetricGrid>

      <div className="an-row">
        <Panel title={__analyticsTr("هشدارها")} meta={__analyticsTr("وضعیت اکنون")} actions={<Link className="btn btn-ghost btn-sm an-no-print" href={a.href("/analytics/alerts")}>{"" + __analyticsTr("همه") + ""}</Link>}>
          <AlertList alerts={m.alerts} limit={5} />
        </Panel>
        <Panel title={__analyticsTr("بینش‌های خودکار")} meta={cmp ? `${__analyticsTr("نسبت به")} ${cmp.label}` : __analyticsTr("این دوره")} actions={<Link className="btn btn-ghost btn-sm an-no-print" href={a.href("/analytics/alerts")}>{__analyticsTr("همه")}</Link>}>
          <InsightList insights={m.insights} limit={INSIGHTS.maxOnOverview} />
        </Panel>
      </div>

      <ChartPanel
        title={__analyticsTr("ورودی و خروجی کار")}
        question={__analyticsTr("صف کار بزرگ می‌شود یا کوچک؟ اگر خط ایجادشده بالاتر از تکمیل‌شده بماند، صف رشد می‌کند.")}
        build={flow}
        height={280}
        table={flowTable}
        fileName="work-flow"
        testId="chart-flow"
        footer={<>
          <span>{"" + __analyticsTr("صف باز در پایان دوره:") + " "}<b className="strong">{fmtInt(m.backlog.at(-1))}</b>{" " + __analyticsTr("(ابتدای دوره:") + " "}{fmtInt(m.backlog[0])})</span>
          <span>{__analyticsTr("خالص دوره:")} {cur.net > 0 ? "+" : ""}{fmtInt(cur.net)} {__analyticsTr("تسک")}</span>
        </>}
      />

      <Panel title={__analyticsTr("مقایسه تیم‌ها")} meta={__analyticsTr("سرانه = جمع ÷ کارشناسان تیم در دوره · برای جزئیات روی تیم کلیک کنید")}>
        <DataTable
          columns={teamColumns}
          rows={m.teams}
          rowKey={(r) => r.key}
          onRowClick={(r) => router.push(a.href("/analytics/teams", { team: r.key }))}
          caption={__analyticsTr("مقایسه تیم‌ها")}
          testId="team-table"
        />
      </Panel>

      <div className="an-row">
        <ChartPanel
          title={__analyticsTr("ترکیب پیچیدگی کار تکمیل‌شده")}
          question={__analyticsTr("حجم کار از کار ساده آمده یا پیچیده؟")}
          build={cxMix}
          height={60 + 44 * (m.teams.length + 1)}
          table={mixTable("cx", CX_FA)}
          fileName="complexity-mix"
          empty={cur.completed === 0 ? <AnEmpty title={__analyticsTr("تسکی تکمیل نشده")}>{"" + __analyticsTr("در این بازه تسک تکمیل‌شده‌ای نیست.") + ""}</AnEmpty> : null}
        />
        <ChartPanel
          title={__analyticsTr("توزیع کیفیت کار تأییدشده")}
          question={__analyticsTr("کیفیت ثبت‌شده هنگام تأیید در تیم‌ها چگونه پخش شده است؟")}
          build={qualityMix}
          height={60 + 44 * (m.teams.length + 1)}
          table={mixTable("quality", QUAL_KEYS.map((k) => QUAL_FA[k]))}
          fileName="quality-mix"
          empty={cur.qualityN === 0 ? <AnEmpty title={__analyticsTr("کیفیتی ثبت نشده")}>{"" + __analyticsTr("کیفیت هنگام تأیید تسک ثبت می‌شود.") + ""}</AnEmpty> : null}
          footer={<Key color="var(--viz-4)">{"" + __analyticsTr("تیره‌تر = کیفیت بالاتر") + ""}</Key>}
        />
      </div>
    </>
  );
}
