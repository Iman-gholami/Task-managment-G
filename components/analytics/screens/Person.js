"use client";

import { useI18n as useExtraI18n } from "@/components/I18nProvider";

import useAnalyticsFormat from "@/components/analytics/useAnalyticsFormat";

import { useI18n as useAnalyticsI18n } from "@/components/I18nProvider";

import { useCallback, useMemo } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { Trail } from "@/components/analytics/blocks";
import { calendarOption, hbarOption, lineOption, stackedOption } from "@/components/analytics/chartOptions";
import { personModel, taskColumns } from "@/components/analytics/model";
import { AnEmpty, ChartPanel, DataTable, Delta, Kpi, Sparkline } from "@/components/analytics/ui";
import { MetricGrid } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/layout";
import { J_MONTHS, J_MONTHS_EN, WEEKDAYS, addDays, diffDays, localDate, toJalali, weekStart, weekdayIndex } from "@/lib/analytics/calendar";
import { fmtDays, fmtInt, fmtNum, fmtPct, isNum } from "@/lib/analytics/format";
import { ACTIVITIES_FA, ACTIVITIES_EN, CX_FA, GROUP_BY_NAME, QUAL_FA, QUAL_KEYS, SHIFT_FA, SHIFT_KEYS } from "@/lib/analytics/labels";
import { METRICS, dailySeries } from "@/lib/analytics/metrics";

const COMPARE_KEYS = ["completed", "units", "hours", "hoursPerTask", "onTimeRate", "cycleMedian", "returnShare", "highQualityShare", "created"];
const SOC_KEYS = ["shifts", "offDays", "leaveDays", "closureRate", "routineRate", "iocs", "iocPerShift", "tickets", "ticketsPerShift"];

export default function Person({ id }) {
  const a = useAnalytics();
  const { t, team, role, province } = useAnalyticsI18n();
  const p = a.facts?.people.find((x) => x.id === id);
  return (
    <AnalyticsFrame
      title={p?.name ?? (a.facts ? t("کارشناس") : "…")}
      crumbs={t(a.manager ? "پروفایل کارشناس" : "آمار من")}
      subtitle={p ? [p.province ? province(p.province) : t("استان تعیین‌نشده"), team(p.group), p.level, role(p.role), p.active ? null : t("غیرفعال")].filter(Boolean).join(" · ") : null}
      exportKind="person"
      exportId={id}
      hideTeamFilter
    >
      <PersonBody id={id} />
    </AnalyticsFrame>
  );
}

function PersonBody({ id }) {
  const { t: __extraTr } = useExtraI18n();
  const { fmtPct, fmtDays, fmtNum, fmtInt } = useAnalyticsFormat();
  const { t: __analyticsTr, team: teamText } = useAnalyticsI18n();
  const a = useAnalytics();
  const { range, cmp, gran, setFilters } = a;
  // The profile ignores team/level filters (they would hide the person); task filters still apply.
  const m = useMemo(() => personModel(a.view.people.some((x) => x.id === id) ? a.view : a.facts, id, range, cmp, gran, a.locale), [a.view, a.facts, id, range, cmp, gran, a.locale]);

  const trend = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), partial: m.b.map((x) => x.partial), bars: true,
    series: [{ name: __analyticsTr("تسک تکمیل‌شده"), data: m.bs.map((x) => x.completed) }],
    prev: cmp ? { name: __extraTr("دوره مقایسه"), data: m.pbs.map((x) => x.completed), labels: m.pb.map((x) => x.label) } : null,
  }), [m, cmp]);
  const hours = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), partial: m.b.map((x) => x.partial), bars: true, kind: "count",
    series: [{ name: __analyticsTr("ساعت ثبت‌شده"), data: m.bs.map((x) => x.hours) }],
  }), [m]);
  const mix = useCallback((t) => stackedOption(t, {
    rows: [{ label: __extraTr("پیچیدگی"), parts: m.cur.cx }],
    parts: CX_FA.map((name, i) => ({ name: __analyticsTr(name), color: t.ramp[i] })),
  }), [m, a.locale]);
  const quality = useCallback((t) => stackedOption(t, {
    rows: [{ label: __extraTr("کیفیت"), parts: m.cur.quality }],
    parts: QUAL_KEYS.map((k, i) => ({ name: __analyticsTr(QUAL_FA[k]), color: t.ramp[3 - i] })),
  }), [m, a.locale]);

  if (!m) {
    return <Panel><AnEmpty icon="user" title={__analyticsTr("این کارشناس در این دامنه نیست")}>{"" + __analyticsTr("ممکن است در تیم دیگری باشد یا به داده او دسترسی نداشته باشید.") + ""}</AnEmpty></Panel>;
  }
  const { p, cur, prev, medians, open } = m;
  const group = GROUP_BY_NAME[p.group];
  const short = cmp?.short;
  const medFoot = (k, f) => (medians && isNum(medians[k]) ? `${a.locale === "fa" ? "میانه تیم" : "Team median"}: ${f(medians[k])}` : null);

  const compareRows = [...COMPARE_KEYS, ...(p.shift ? SOC_KEYS : [])].map((k) => ({
    id: k, label: __analyticsTr(METRICS[k].label), kind: METRICS[k].kind, cur: cur[k], prev: prev?.[k] ?? null, med: medians?.[k] ?? null,
  }));
  const valueCol = (key, label) => ({ key, label, value: (r) => r[key], render: (r) => (isNum(r[key]) ? (r.kind === "rate" ? fmtPct(r[key]) : r.kind === "days" ? fmtDays(r[key]) : fmtNum(r[key])) : <span className="muted">—</span>) });

  return (
    <>
      {a.manager && (
        <Trail items={[
          { label: __extraTr("کل واحد"), href: a.href("/analytics/people", { team: "", level: "" }) },
          ...(group ? [{ label: teamText(group.name), href: a.href("/analytics/teams", { team: group.key }) }] : []),
          ...(p.level ? [{ label: p.level, href: a.href("/analytics/teams", { team: "soc", level: p.level }) }] : []),
          { label: p.name },
        ]} />
      )}
      {a.filters.team && !a.view.people.some((x) => x.id === id) && (
        <div className="an-inline-error" style={{ background: "var(--info-soft)", color: "var(--info)" }}>{"" + __analyticsTr("فیلتر تیم روی این صفحه اعمال نمی‌شود.") + " "}<button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters({ team: "", level: "" })}>{"" + __analyticsTr("حذف فیلتر") + ""}</button></div>
      )}

      <MetricGrid label={a.locale === "fa" ? `شاخص‌های ${p.name}` : `${p.name}'s metrics`}>
        <Kpi label={__analyticsTr("تسک‌های تکمیل‌شده")} icon="checkCircle" value={fmtInt(cur.completed)} delta={prev && <Delta now={cur.completed} before={prev.completed} label={short} />} foot={medFoot("completed", fmtNum)} spark={<Sparkline values={m.bs.map((x) => x.completed)} />} />
        <Kpi label={__analyticsTr("حجم کار وزن‌دار")} icon="bars" value={fmtInt(cur.units)} delta={prev && <Delta now={cur.units} before={prev.units} label={short} />} foot={medFoot("units", fmtNum)} />
        <Kpi label={__analyticsTr("ساعت ثبت‌شده")} icon="clock" value={fmtNum(cur.hours, 0)} unit={__extraTr("ساعت")} delta={prev && <Delta now={cur.hours} before={prev.hours} label={short} />} foot={medFoot("hours", (v) => fmtNum(v, 0))} />
        <Kpi label={__analyticsTr("تحویل به‌موقع")} icon="cal" value={fmtPct(cur.onTimeRate)} delta={prev && cur.onTimeRate !== null && <Delta now={cur.onTimeRate} before={prev.onTimeRate} kind="rate" label={short} />} foot={cur.onTimeRate === null ? a.locale === "fa" ? `${fmtInt(cur.onTimeN)} تسک دارای ددلاین (کمتر از ۵)` : `${fmtInt(cur.onTimeN)} tasks with deadlines (fewer than 5)` : medFoot("onTimeRate", fmtPct)} />
        <Kpi label={__analyticsTr("میانه زمان انجام")} icon="clock" value={fmtDays(cur.cycleMedian)} foot={medFoot("cycleMedian", fmtDays) ?? (a.locale === "fa" ? `${fmtInt(cur.cycleN)} تسک با زمان شروع` : `${fmtInt(cur.cycleN)} tasks with start dates`)} />
        <Kpi label={__analyticsTr("صف کار باز (اکنون)")} icon="tasks" value={fmtInt(open.open)} tone={open.overdue ? "alert" : undefined} foot={a.locale === "fa" ? `${fmtInt(open.overdue)} معوق · ${fmtInt(open.blocked)} مسدود · ${fmtInt(open.review)} در بازبینی` : `${fmtInt(open.overdue)} overdue · ${fmtInt(open.blocked)} blocked · ${fmtInt(open.review)} in review`} />
      </MetricGrid>

      <Panel title={__analyticsTr("مقایسه با دوره قبل و میانه تیم")} meta={medians ? `${a.locale === "fa" ? "میانه" : "Median"} ${teamText(p.group)}${a.facts.peers ? a.locale === "fa" ? ` (${fmtInt(a.facts.peers.count)} همکار، بی‌نام)` : ` (${fmtInt(a.facts.peers.count)} anonymous peers)` : ""}` : a.facts.peers?.hidden ? (a.locale === "fa" ? "میانه تیم وقتی کمتر از ۳ همکار فعال باشد نمایش داده نمی‌شود" : "Team median is hidden when fewer than 3 peers are active") : null}>
        <DataTable
          dense
          columns={[
            { key: "label", label: __analyticsTr("شاخص"), value: (r) => r.label },
            valueCol("cur", __analyticsTr("این دوره")),
            ...(cmp ? [valueCol("prev", cmp.label)] : []),
            ...(medians ? [valueCol("med", a.locale === "fa" ? "میانه تیم" : "Team median")] : []),
            ...(cmp ? [{ key: "d", label: __extraTr("تغییر"), sort: false, value: () => null, render: (r) => <Delta now={r.cur} before={r.prev} kind={r.kind === "rate" ? "rate" : "count"} /> }] : []),
          ]}
          rows={compareRows}
          caption={__analyticsTr("مقایسه با دوره قبل و میانه تیم")}
        />
      </Panel>

      <div className="an-row">
        <ChartPanel title={__analyticsTr("روند تسک‌های تکمیل‌شده")} question="حجم کار در طول دوره چگونه تغییر کرده است؟" build={trend} height={230}
          table={{ columns: [{ key: "b", label: __analyticsTr("بازه"), value: (r) => r.label }, { key: "c", label: __extraTr("تکمیل‌شده"), kind: "count", value: (r) => r.c }, { key: "u", label: __extraTr("حجم وزن‌دار"), kind: "count", value: (r) => r.u }, { key: "h", label: __extraTr("ساعت"), kind: "count", value: (r) => r.h }], rows: m.b.map((x, i) => ({ id: x.from, label: x.label, c: m.bs[i].completed, u: m.bs[i].units, h: m.bs[i].hours })) }}
          fileName={`person-trend-${p.id}`} />
        <ChartPanel title={__analyticsTr("روند ساعت ثبت‌شده")} question="ساعت‌ها جدا از تعداد تسک (بدون محور دوگانه)؛ ساعت دستی وارد می‌شود." build={hours} height={230}
          table={{ columns: [{ key: "b", label: __analyticsTr("بازه"), value: (r) => r.label }, { key: "h", label: __extraTr("ساعت"), kind: "count", value: (r) => r.h }], rows: m.b.map((x, i) => ({ id: x.from, label: x.label, h: m.bs[i].hours })) }}
          fileName={`person-hours-${p.id}`} />
      </div>

      {cur.completed > 0 && (
        <div className="an-row">
          <ChartPanel title={__analyticsTr("ترکیب پیچیدگی")} build={mix} height={110} fileName={`person-complexity-${p.id}`}
            table={{ columns: CX_FA.map((c, i) => ({ key: `c${i}`, label: __analyticsTr(c), kind: "count", value: (r) => r.cx[i] })), rows: [{ id: "cx", cx: cur.cx }] }} />
          <ChartPanel title={__analyticsTr("توزیع کیفیت")} build={quality} height={110} fileName={`person-quality-${p.id}`}
            empty={cur.qualityN ? null : <AnEmpty title={__analyticsTr("کیفیتی ثبت نشده")} />}
            table={{ columns: QUAL_KEYS.map((k, i) => ({ key: k, label: __analyticsTr(QUAL_FA[k]), kind: "count", value: (r) => r.q[i] })), rows: [{ id: "q", q: cur.quality }] }} />
        </div>
      )}

      {p.shift && <ShiftSection id={id} cur={cur} prev={prev} medians={medians} />}

      <div className="an-grid">
        <Panel title={`${a.locale === "fa" ? "کار باز" : "Open work"} (${fmtInt(m.openTasks.length)})`} meta={__analyticsTr("وضعیت اکنون")}>
          <DataTable dense columns={taskColumns({ demo: a.demo, today: a.today, locale: a.locale })} rows={m.openTasks} caption={a.locale === "fa" ? "کار باز" : "Open work"} maxHeight={420}
            empty={<div className="notice neutral"><span className="glyph" aria-hidden="true">✓</span><span>{"" + __analyticsTr("تسک بازی نیست.") + ""}</span></div>} />
        </Panel>
        <Panel title={`${a.locale === "fa" ? "تکمیل‌شده در این دوره" : "Completed this period"} (${fmtInt(m.doneTasks.length)})`}>
          <DataTable dense columns={taskColumns({ demo: a.demo, today: a.today, done: true, locale: a.locale })} rows={m.doneTasks} caption={__analyticsTr("تسک‌های تکمیل‌شده")} maxHeight={420} />
        </Panel>
      </div>
    </>
  );
}

/** SOC analysts: routine completion per day on a Jalali calendar, daily IOC and tickets, each activity, shift mix. */
function ShiftSection({ id, cur, prev, medians }) {
  const { t: __extraTr } = useExtraI18n();
  const { fmtInt, fmtPct, fmtNum } = useAnalyticsFormat();
  const { t: __analyticsTr } = useAnalyticsI18n();
  const a = useAnalytics();
  const { range } = a;
  const weekdays = a.locale === "fa" ? WEEKDAYS : ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const activityLabels = a.locale === "fa" ? ACTIVITIES_FA : ACTIVITIES_EN;
  const facts = a.view.people.some((x) => x.id === id) ? a.view : a.facts;
  const m = useMemo(() => {
    const routine = dailySeries(facts, [id], range.from, range.end, "routineRate");
    const iocs = dailySeries(facts, [id], range.from, range.end, "iocs");
    const tickets = dailySeries(facts, [id], range.from, range.end, "tickets");
    const shifts = dailySeries(facts, [id], range.from, range.end, "shifts");
    const start = weekStart(range.from);
    const weeks = Math.floor(diffDays(start, range.end) / 7) + 1;
    const weekLabels = Array.from({ length: weeks }, (_, w) => {
      const d = addDays(start, w * 7);
      const j = toJalali(d);
      const prevJ = w === 0 ? null : toJalali(addDays(d, -7));
      return w === 0 || j.jm !== prevJ.jm ? (a.locale === "fa" ? J_MONTHS : J_MONTHS_EN)[j.jm - 1] : "";
    });
    const cells = routine.map(([d, v], i) => ({ week: Math.floor(diffDays(start, d) / 7), day: weekdayIndex(d), date: d, value: shifts[i][1] ? v : null, label: `${weekdays[weekdayIndex(d)]} ${localDate(d, a.locale)}` }));
    return { routine, iocs, tickets, shifts, weekLabels, cells };
  }, [facts, id, range, a.locale]);

  const cal = useCallback((t) => calendarOption(t, { cells: m.cells, weekLabels: m.weekLabels, dayLabels: weekdays, kind: "rate", name: __analyticsTr("انجام روتین") }), [m, a.locale]);
  const daily = (key, name) => (t) => lineOption(t, { labels: m[key].map(([d]) => localDate(d, a.locale, { year: false })), bars: true, series: [{ name, data: m[key].map(([, v]) => v) }] });
  const iocBuild = useCallback(daily("iocs", "IOC"), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticketBuild = useCallback(daily("tickets", __analyticsTr("تیکت")), [m, a.locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const acts = useCallback((t) => hbarOption(t, { rows: activityLabels.map((label, i) => ({ label, value: cur.activityRates[i], note: `${fmtInt(cur.activityN[i])} ${a.locale === "fa" ? "شیفت" : "shifts"}` })).filter((r) => r.value !== null), kind: "rate", max: 1, labelWidth: 260 }), [cur, a.locale]);
  const types = SHIFT_KEYS.map((k) => cur.shiftTypes[k]);

  return (
    <>
      <div className="an-section-title"><h2>{__analyticsTr("شیفت و روتین SOC")}</h2><span>{`${fmtInt(cur.shifts)} ${a.locale === "fa" ? "شیفت" : "shifts"} · ${SHIFT_KEYS.map((k, i) => `${__analyticsTr(SHIFT_FA[k])} ${fmtInt(types[i])}`).join(a.locale === "fa" ? "، " : ", ")}`}</span></div>
      <MetricGrid label={__analyticsTr("شاخص‌های شیفت")}>
        <Kpi label={__analyticsTr("تعطیل شیفت")} icon="cal" value={fmtInt(cur.offDays)} />
        <Kpi label={__analyticsTr("مرخصی")} icon="cal" value={fmtInt(cur.leaveDays)} />
        <Kpi label={__analyticsTr("بسته‌شدن شیفت‌لاگ")} icon="shift" value={fmtPct(cur.closureRate)} tone={cur.missed ? "alert" : undefined} delta={prev && cur.closureRate !== null && <Delta now={cur.closureRate} before={prev.closureRate} kind="rate" label={a.cmp?.short} />} foot={cur.missed ? `${fmtInt(cur.missed)} ${a.locale === "fa" ? "شیفت‌لاگ جامانده" : "missed shift logs"}` : (a.locale === "fa" ? "همه شیفت‌لاگ‌ها کامل شده" : "All shift logs completed")} />
        <Kpi label={__analyticsTr("انجام روتین")} icon="checkCircle" value={fmtPct(cur.routineRate)} delta={prev && cur.routineRate !== null && <Delta now={cur.routineRate} before={prev.routineRate} kind="rate" label={a.cmp?.short} />} foot={medians && isNum(medians.routineRate) ? `${a.locale === "fa" ? "میانه تیم" : "Team median"}: ${fmtPct(medians.routineRate)}` : null} />
        <Kpi label={__analyticsTr("IOC ثبت‌شده")} icon="shield" value={fmtInt(cur.iocs)} foot={`${fmtNum(cur.iocPerShift)} ${a.locale === "fa" ? "به ازای هر شیفت‌لاگ" : "per shift log"}`} />
        <Kpi label={__analyticsTr("تیکت")} icon="inbox" value={fmtInt(cur.tickets)} foot={`${fmtNum(cur.ticketsPerShift)} ${a.locale === "fa" ? "به ازای هر شیفت‌لاگ" : "per shift log"}`} />
        <Kpi label={__analyticsTr("گزارش ترافیک")} icon="report" value={fmtInt(cur.reports)} />
        <Kpi label={__analyticsTr("Issue گزارش‌شده")} icon="flag" value={fmtInt(cur.issues)} />
      </MetricGrid>
      <ChartPanel title={__analyticsTr("انجام روتین در هر روز")} question="کدام روزها روتین کامل انجام نشده است؟ خانه خالی یعنی شیفت نداشته." build={cal} height={7 * 20 + 70}
        table={{ columns: [{ key: "d", label: __extraTr("روز"), value: (r) => r.label }, { key: "v", label: __analyticsTr("انجام روتین"), kind: "rate", value: (r) => r.value }], rows: m.cells.filter((c) => c.value !== null).map((c) => ({ ...c, id: c.date })) }}
        fileName="routine-daily" />
      <div className="an-row">
        <ChartPanel title={__analyticsTr("IOC روزانه")} build={iocBuild} height={200} fileName="ioc-daily"
          table={{ columns: [{ key: "d", label: __extraTr("روز"), value: (r) => localDate(r[0], a.locale) }, { key: "v", label: "IOC", kind: "count", value: (r) => r[1] }], rows: m.iocs.filter((x, i) => m.shifts[i][1]) }} />
        <ChartPanel title={__analyticsTr("تیکت روزانه (تعداد)")} build={ticketBuild} height={200} fileName="tickets-daily"
          table={{ columns: [{ key: "d", label: __extraTr("روز"), value: (r) => localDate(r[0], a.locale) }, { key: "v", label: __analyticsTr("تیکت"), kind: "count", value: (r) => r[1] }], rows: m.tickets.filter((x, i) => m.shifts[i][1]) }} />
      </div>
      <ChartPanel title={__analyticsTr("درصد انجام هر فعالیت روتین")} question="کدام فعالیت بیشتر جا می‌ماند؟" build={acts} height={300} fileName="routine-activities"
        table={{ columns: [{ key: "l", label: __extraTr("فعالیت"), value: (r) => r.label }, { key: "v", label: __extraTr("درصد انجام"), kind: "rate", value: (r) => r.value }, { key: "n", label: __analyticsTr("شیفت"), kind: "count", value: (r) => r.n }], rows: activityLabels.map((label, i) => ({ id: i, label, value: cur.activityRates[i], n: cur.activityN[i] })) }} />
    </>
  );
}
