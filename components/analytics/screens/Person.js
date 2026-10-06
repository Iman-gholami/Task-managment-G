"use client";

import { useCallback, useMemo } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { Trail } from "@/components/analytics/blocks";
import { calendarOption, hbarOption, lineOption, stackedOption } from "@/components/analytics/chartOptions";
import { personModel, taskColumns } from "@/components/analytics/model";
import { AnEmpty, ChartPanel, DataTable, Delta, Kpi, Sparkline } from "@/components/analytics/ui";
import { MetricGrid } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/layout";
import { J_MONTHS, WEEKDAYS, addDays, diffDays, faDate, faDigits, toJalali, weekStart, weekdayIndex } from "@/lib/analytics/calendar";
import { fmtDays, fmtInt, fmtNum, fmtPct, isNum } from "@/lib/analytics/format";
import { ACTIVITIES_FA, CX_FA, GROUP_BY_NAME, QUAL_FA, QUAL_KEYS, ROLE_FA, SHIFT_FA, SHIFT_KEYS, groupFa } from "@/lib/analytics/labels";
import { METRICS, dailySeries } from "@/lib/analytics/metrics";

const COMPARE_KEYS = ["completed", "units", "hours", "hoursPerTask", "onTimeRate", "cycleMedian", "returnShare", "highQualityShare", "created"];
const SOC_KEYS = ["shifts", "closureRate", "routineRate", "iocs", "iocPerShift", "tickets", "ticketsPerShift"];

export default function Person({ id }) {
  const a = useAnalytics();
  const p = a.facts?.people.find((x) => x.id === id);
  return (
    <AnalyticsFrame
      title={p?.name ?? (a.facts ? "کارشناس" : "…")}
      crumbs={a.manager ? "پروفایل کارشناس" : "آمار من"}
      subtitle={p ? [groupFa(p.group), p.level, ROLE_FA[p.role], p.active ? null : "غیرفعال"].filter(Boolean).join(" · ") : null}
      exportKind="person"
      hideTeamFilter
    >
      <PersonBody id={id} />
    </AnalyticsFrame>
  );
}

function PersonBody({ id }) {
  const a = useAnalytics();
  const { range, cmp, gran, setFilters } = a;
  // The profile ignores team/level filters (they would hide the person); task filters still apply.
  const m = useMemo(() => personModel(a.view.people.some((x) => x.id === id) ? a.view : a.facts, id, range, cmp, gran), [a.view, a.facts, id, range, cmp, gran]);

  const trend = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), partial: m.b.map((x) => x.partial), bars: true,
    series: [{ name: "تسک تکمیل‌شده", data: m.bs.map((x) => x.completed) }],
    prev: cmp ? { name: "دوره مقایسه", data: m.pbs.map((x) => x.completed), labels: m.pb.map((x) => x.label) } : null,
  }), [m, cmp]);
  const hours = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), partial: m.b.map((x) => x.partial), bars: true, kind: "count",
    series: [{ name: "ساعت ثبت‌شده", data: m.bs.map((x) => x.hours) }],
  }), [m]);
  const mix = useCallback((t) => stackedOption(t, {
    rows: [{ label: "پیچیدگی", parts: m.cur.cx }],
    parts: CX_FA.map((name, i) => ({ name, color: t.ramp[i] })),
  }), [m]);
  const quality = useCallback((t) => stackedOption(t, {
    rows: [{ label: "کیفیت", parts: m.cur.quality }],
    parts: QUAL_KEYS.map((k, i) => ({ name: QUAL_FA[k], color: t.ramp[3 - i] })),
  }), [m]);

  if (!m) {
    return <Panel><AnEmpty icon="user" title="این کارشناس در این دامنه نیست">ممکن است در تیم دیگری باشد یا به داده او دسترسی نداشته باشید.</AnEmpty></Panel>;
  }
  const { p, cur, prev, medians, open } = m;
  const group = GROUP_BY_NAME[p.group];
  const short = cmp?.short;
  const medFoot = (k, f) => (medians && isNum(medians[k]) ? `میانه تیم: ${f(medians[k])}` : null);

  const compareRows = [...COMPARE_KEYS, ...(p.shift ? SOC_KEYS : [])].map((k) => ({
    id: k, label: METRICS[k].label, kind: METRICS[k].kind, cur: cur[k], prev: prev?.[k] ?? null, med: medians?.[k] ?? null,
  }));
  const valueCol = (key, label) => ({ key, label, value: (r) => r[key], render: (r) => (isNum(r[key]) ? (r.kind === "rate" ? fmtPct(r[key]) : r.kind === "days" ? fmtDays(r[key]) : fmtNum(r[key])) : <span className="muted">—</span>) });

  return (
    <>
      {a.manager && (
        <Trail items={[
          { label: "کل واحد", href: a.href("/analytics/people", { team: "", level: "" }) },
          ...(group ? [{ label: group.fa, href: a.href("/analytics/teams", { team: group.key }) }] : []),
          ...(p.level ? [{ label: p.level, href: a.href("/analytics/teams", { team: "soc", level: p.level }) }] : []),
          { label: p.name },
        ]} />
      )}
      {a.filters.team && !a.view.people.some((x) => x.id === id) && (
        <div className="an-inline-error" style={{ background: "var(--info-soft)", color: "var(--info)" }}>فیلتر تیم روی این صفحه اعمال نمی‌شود. <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters({ team: "", level: "" })}>حذف فیلتر</button></div>
      )}

      <MetricGrid label={`شاخص‌های ${p.name}`}>
        <Kpi label="تسک‌های تکمیل‌شده" icon="checkCircle" value={fmtInt(cur.completed)} delta={prev && <Delta now={cur.completed} before={prev.completed} label={short} />} foot={medFoot("completed", fmtNum)} spark={<Sparkline values={m.bs.map((x) => x.completed)} />} />
        <Kpi label="حجم کار وزن‌دار" icon="bars" value={fmtInt(cur.units)} delta={prev && <Delta now={cur.units} before={prev.units} label={short} />} foot={medFoot("units", fmtNum)} />
        <Kpi label="ساعت ثبت‌شده" icon="clock" value={fmtNum(cur.hours, 0)} unit="ساعت" delta={prev && <Delta now={cur.hours} before={prev.hours} label={short} />} foot={medFoot("hours", (v) => fmtNum(v, 0))} />
        <Kpi label="تحویل به‌موقع" icon="cal" value={fmtPct(cur.onTimeRate)} delta={prev && cur.onTimeRate !== null && <Delta now={cur.onTimeRate} before={prev.onTimeRate} kind="rate" label={short} />} foot={cur.onTimeRate === null ? `${faDigits(cur.onTimeN)} تسک دارای ددلاین (کمتر از ۵)` : medFoot("onTimeRate", fmtPct)} />
        <Kpi label="میانه زمان انجام" icon="clock" value={fmtDays(cur.cycleMedian)} foot={medFoot("cycleMedian", fmtDays) ?? `${faDigits(cur.cycleN)} تسک با زمان شروع`} />
        <Kpi label="صف کار باز (اکنون)" icon="tasks" value={fmtInt(open.open)} tone={open.overdue ? "alert" : undefined} foot={`${faDigits(open.overdue)} معوق · ${faDigits(open.blocked)} مسدود · ${faDigits(open.review)} در بازبینی`} />
      </MetricGrid>

      <Panel title="مقایسه با دوره قبل و میانه تیم" meta={medians ? `میانه ${groupFa(p.group)}${a.facts.peers ? ` (${faDigits(a.facts.peers.count)} همکار، بی‌نام)` : ""}` : a.facts.peers?.hidden ? "میانه تیم وقتی کمتر از ۳ همکار فعال باشد نمایش داده نمی‌شود" : null}>
        <DataTable
          dense
          columns={[
            { key: "label", label: "شاخص", value: (r) => r.label },
            valueCol("cur", "این دوره"),
            ...(cmp ? [valueCol("prev", cmp.label)] : []),
            ...(medians ? [valueCol("med", "میانه تیم")] : []),
            ...(cmp ? [{ key: "d", label: "تغییر", sort: false, value: () => null, render: (r) => <Delta now={r.cur} before={r.prev} kind={r.kind === "rate" ? "rate" : "count"} /> }] : []),
          ]}
          rows={compareRows}
          caption="مقایسه با دوره قبل و میانه تیم"
        />
      </Panel>

      <div className="an-row">
        <ChartPanel title="روند تسک‌های تکمیل‌شده" question="حجم کار در طول دوره چگونه تغییر کرده است؟" build={trend} height={230}
          table={{ columns: [{ key: "b", label: "بازه", value: (r) => r.label }, { key: "c", label: "تکمیل‌شده", kind: "count", value: (r) => r.c }, { key: "u", label: "حجم وزن‌دار", kind: "count", value: (r) => r.u }, { key: "h", label: "ساعت", kind: "count", value: (r) => r.h }], rows: m.b.map((x, i) => ({ id: x.from, label: x.label, c: m.bs[i].completed, u: m.bs[i].units, h: m.bs[i].hours })) }}
          fileName={`روند-${p.name}`} />
        <ChartPanel title="روند ساعت ثبت‌شده" question="ساعت‌ها جدا از تعداد تسک (بدون محور دوگانه)؛ ساعت دستی وارد می‌شود." build={hours} height={230}
          table={{ columns: [{ key: "b", label: "بازه", value: (r) => r.label }, { key: "h", label: "ساعت", kind: "count", value: (r) => r.h }], rows: m.b.map((x, i) => ({ id: x.from, label: x.label, h: m.bs[i].hours })) }}
          fileName={`ساعت-${p.name}`} />
      </div>

      {cur.completed > 0 && (
        <div className="an-row">
          <ChartPanel title="ترکیب پیچیدگی" build={mix} height={110} fileName={`پیچیدگی-${p.name}`}
            table={{ columns: CX_FA.map((c, i) => ({ key: `c${i}`, label: c, kind: "count", value: (r) => r.cx[i] })), rows: [{ id: "cx", cx: cur.cx }] }} />
          <ChartPanel title="توزیع کیفیت" build={quality} height={110} fileName={`کیفیت-${p.name}`}
            empty={cur.qualityN ? null : <AnEmpty title="کیفیتی ثبت نشده" />}
            table={{ columns: QUAL_KEYS.map((k, i) => ({ key: k, label: QUAL_FA[k], kind: "count", value: (r) => r.q[i] })), rows: [{ id: "q", q: cur.quality }] }} />
        </div>
      )}

      {p.shift && <ShiftSection id={id} cur={cur} prev={prev} medians={medians} />}

      <div className="an-grid">
        <Panel title={`کار باز (${faDigits(m.openTasks.length)})`} meta="وضعیت اکنون">
          <DataTable dense columns={taskColumns({ demo: a.demo, today: a.today })} rows={m.openTasks} caption="کار باز" maxHeight={420}
            empty={<div className="notice neutral"><span className="glyph" aria-hidden="true">✓</span><span>تسک بازی نیست.</span></div>} />
        </Panel>
        <Panel title={`تکمیل‌شده در این دوره (${faDigits(m.doneTasks.length)})`}>
          <DataTable dense columns={taskColumns({ demo: a.demo, today: a.today, done: true })} rows={m.doneTasks} caption="تسک‌های تکمیل‌شده" maxHeight={420} />
        </Panel>
      </div>
    </>
  );
}

/** SOC analysts: routine completion per day on a Jalali calendar, daily IOC and tickets, each activity, shift mix. */
function ShiftSection({ id, cur, prev, medians }) {
  const a = useAnalytics();
  const { range } = a;
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
      return w === 0 || j.jm !== prevJ.jm ? J_MONTHS[j.jm - 1] : "";
    });
    const cells = routine.map(([d, v], i) => ({ week: Math.floor(diffDays(start, d) / 7), day: weekdayIndex(d), date: d, value: shifts[i][1] ? v : null, label: `${WEEKDAYS[weekdayIndex(d)]} ${faDate(d)}` }));
    return { routine, iocs, tickets, shifts, weekLabels, cells };
  }, [facts, id, range]);

  const cal = useCallback((t) => calendarOption(t, { cells: m.cells, weekLabels: m.weekLabels, dayLabels: WEEKDAYS, kind: "rate", name: "انجام روتین" }), [m]);
  const daily = (key, name) => (t) => lineOption(t, { labels: m[key].map(([d]) => faDate(d, { year: false })), bars: true, series: [{ name, data: m[key].map(([, v]) => v) }] });
  const iocBuild = useCallback(daily("iocs", "IOC"), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticketBuild = useCallback(daily("tickets", "تیکت"), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const acts = useCallback((t) => hbarOption(t, { rows: ACTIVITIES_FA.map((label, i) => ({ label, value: cur.activityRates[i], note: `${faDigits(cur.activityN[i])} شیفت` })).filter((r) => r.value !== null), kind: "rate", max: 1, labelWidth: 260 }), [cur]);
  const types = SHIFT_KEYS.map((k) => cur.shiftTypes[k]);

  return (
    <>
      <div className="an-section-title"><h2>شیفت و روتین SOC</h2><span>{`${faDigits(cur.shifts)} شیفت · ${SHIFT_KEYS.map((k, i) => `${SHIFT_FA[k]} ${faDigits(types[i])}`).join("، ")}`}</span></div>
      <MetricGrid label="شاخص‌های شیفت">
        <Kpi label="بسته‌شدن شیفت‌لاگ" icon="shift" value={fmtPct(cur.closureRate)} tone={cur.missed ? "alert" : undefined} delta={prev && cur.closureRate !== null && <Delta now={cur.closureRate} before={prev.closureRate} kind="rate" label={a.cmp?.short} />} foot={cur.missed ? `${faDigits(cur.missed)} شیفت‌لاگ جامانده` : "همه شیفت‌لاگ‌ها کامل شده"} />
        <Kpi label="انجام روتین" icon="checkCircle" value={fmtPct(cur.routineRate)} delta={prev && cur.routineRate !== null && <Delta now={cur.routineRate} before={prev.routineRate} kind="rate" label={a.cmp?.short} />} foot={medians && isNum(medians.routineRate) ? `میانه تیم: ${fmtPct(medians.routineRate)}` : null} />
        <Kpi label="IOC ثبت‌شده" icon="shield" value={fmtInt(cur.iocs)} foot={`${fmtNum(cur.iocPerShift)} به ازای هر شیفت‌لاگ`} />
        <Kpi label="تیکت" icon="inbox" value={fmtInt(cur.tickets)} foot={`${fmtNum(cur.ticketsPerShift)} به ازای هر شیفت‌لاگ`} />
        <Kpi label="گزارش ترافیک" icon="report" value={fmtInt(cur.reports)} />
        <Kpi label="Issue گزارش‌شده" icon="flag" value={fmtInt(cur.issues)} />
      </MetricGrid>
      <ChartPanel title="انجام روتین در هر روز" question="کدام روزها روتین کامل انجام نشده است؟ خانه خالی یعنی شیفت نداشته." build={cal} height={7 * 20 + 70}
        table={{ columns: [{ key: "d", label: "روز", value: (r) => r.label }, { key: "v", label: "انجام روتین", kind: "rate", value: (r) => r.value }], rows: m.cells.filter((c) => c.value !== null).map((c) => ({ ...c, id: c.date })) }}
        fileName="انجام-روتین-روزانه" />
      <div className="an-row">
        <ChartPanel title="IOC روزانه" build={iocBuild} height={200} fileName="IOC-روزانه"
          table={{ columns: [{ key: "d", label: "روز", value: (r) => faDate(r[0]) }, { key: "v", label: "IOC", kind: "count", value: (r) => r[1] }], rows: m.iocs.filter((x, i) => m.shifts[i][1]) }} />
        <ChartPanel title="تیکت روزانه (تعداد)" build={ticketBuild} height={200} fileName="تیکت-روزانه"
          table={{ columns: [{ key: "d", label: "روز", value: (r) => faDate(r[0]) }, { key: "v", label: "تیکت", kind: "count", value: (r) => r[1] }], rows: m.tickets.filter((x, i) => m.shifts[i][1]) }} />
      </div>
      <ChartPanel title="درصد انجام هر فعالیت روتین" question="کدام فعالیت بیشتر جا می‌ماند؟" build={acts} height={300} fileName="فعالیت‌های-روتین"
        table={{ columns: [{ key: "l", label: "فعالیت", value: (r) => r.label }, { key: "v", label: "درصد انجام", kind: "rate", value: (r) => r.value }, { key: "n", label: "شیفت", kind: "count", value: (r) => r.n }], rows: ACTIVITIES_FA.map((label, i) => ({ id: i, label, value: cur.activityRates[i], n: cur.activityN[i] })) }} />
    </>
  );
}
