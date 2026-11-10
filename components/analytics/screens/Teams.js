"use client";

import { useI18n as useExtraI18n } from "@/components/I18nProvider";

import useAnalyticsFormat from "@/components/analytics/useAnalyticsFormat";

import { useI18n as useAnalyticsI18n } from "@/components/I18nProvider";

import { useCallback, useMemo, useState } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { Key, Trail } from "@/components/analytics/blocks";
import { hbarOption, lineOption, stackedOption, stripOption } from "@/components/analytics/chartOptions";
import PersonDrawer from "@/components/analytics/PersonDrawer";
import { AnEmpty, ChartPanel, DataTable, Delta, Kpi, Sparkline } from "@/components/analytics/ui";
import { MetricGrid } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/layout";
import Segmented from "@/components/ui/Segmented";
import { faDigits } from "@/lib/analytics/calendar";
import { fmtInt, fmtNum, fmtPct, median } from "@/lib/analytics/format";
import { CX_FA, GROUP_BY_KEY, QUAL_FA, QUAL_KEYS, ROLE_FA } from "@/lib/analytics/labels";
import { bucketStats, experts, idsOf, levelRows, openStats, peopleRows, stats, teamRows } from "@/lib/analytics/metrics";
import { buckets } from "@/lib/analytics/periods";

export default function Teams() {
  const { filters } = useAnalytics();
  const { locale, t, team: teamText } = useAnalyticsI18n();
  const team = filters.team ? GROUP_BY_KEY[filters.team] : null;
  return (
    <AnalyticsFrame title={team ? `${locale === "fa" ? "تیم" : "Team"} ${teamText(team.name)}` : t("عملکرد تیم‌ها")} exportKind="teams">
      {team ? <TeamDetail team={team} /> : <TeamsOverview />}
    </AnalyticsFrame>
  );
}

const PC_METRICS = [
  { value: "completed", label: "تکمیل‌شده", kind: "avg", pc: true },
  { value: "units", label: "حجم وزن‌دار", kind: "avg", pc: true },
  { value: "hours", label: "ساعت", kind: "avg", pc: true },
  { value: "onTimeRate", label: "به‌موقع", kind: "rate" },
  { value: "cycleMedian", label: "زمان انجام", kind: "days" },
];

function TeamsOverview() {
  const { t: __extraTr } = useExtraI18n();
  const { fmtInt, fmtNum, fmtPct } = useAnalyticsFormat();
  const { t: __analyticsTr, team: teamText } = useAnalyticsI18n();
  const a = useAnalytics();
  const { view, range, cmp, gran } = a;
  const [metric, setMetric] = useState("completed");
  const [person, setPerson] = useState(null);
  const m = useMemo(() => {
    const b = buckets(range.from, range.end, gran, a.locale);
    const rows = teamRows(view, range, cmp).map((t) => {
      const series = bucketStats(view, idsOf(t.people), b);
      return { ...t, series, spark: series.map((x) => x.completed) };
    });
    const all = stats(view, null, range);
    const n = rows.reduce((s, t) => s + t.headcount, 0);
    const load = experts(view).filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, group: p.group, value: openStats(view, [p.id]).open }));
    return { b, rows, all, n, load };
  }, [view, range, cmp, gran, a.locale]);
  const def = PC_METRICS.find((x) => x.value === metric);
  const valueOf = (t) => (def.pc ? t.pc[metric] : t.cur[metric]);
  const deptValue = def.pc ? (m.n ? m.all[metric] / m.n : null) : m.all[metric];

  const pcBuild = useCallback((t) => hbarOption(t, {
    rows: m.rows.map((r) => ({ label: teamText(r.group), value: valueOf(r), id: r.key, note: def.pc ? `${fmtInt(r.headcount)} ${a.locale === "fa" ? "کارشناس" : "analysts"}` : "" })),
    kind: def.kind, median: deptValue,
  }), [m, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const trendBuild = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), partial: m.b.map((x) => x.partial), kind: "avg",
    series: m.rows.map((r, i) => ({ name: teamText(r.group), data: r.series.map((x) => (r.headcount ? x.completed / r.headcount : null)), color: t.cat[i] })),
  }), [m]);
  const groups = m.rows.map((r) => teamText(r.group));
  const loadBuild = useCallback((t) => stripOption(t, {
    groups,
    points: m.load.map((p) => ({ ...p, groupIndex: m.rows.findIndex((r) => r.group === p.group) })).filter((p) => p.groupIndex >= 0),
    median: median(m.load.map((p) => p.value)),
  }), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const mixRows = (key) => m.rows.map((r) => ({ label: teamText(r.group), parts: r.cur[key] }));
  const cxBuild = useCallback((t) => stackedOption(t, { rows: mixRows("cx"), parts: CX_FA.map((name, i) => ({ name: __analyticsTr(name), color: t.ramp[i] })) }), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const qBuild = useCallback((t) => stackedOption(t, { rows: mixRows("quality"), parts: QUAL_KEYS.map((k, i) => ({ name: __analyticsTr(QUAL_FA[k]), color: t.ramp[3 - i] })) }), [m]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m.rows.length) return <Panel><AnEmpty title={__analyticsTr("تیمی در این دامنه نیست")}>{"" + __analyticsTr("با این فیلترها کارشناسی پیدا نشد.") + ""}</AnEmpty></Panel>;

  const tableColumns = [
    { key: "team", label: __analyticsTr("تیم"), value: (r) => teamText(r.group), render: (r) => <b>{teamText(r.group)}</b> },
    { key: "n", label: __analyticsTr("کارشناسان"), kind: "count", value: (r) => r.headcount },
    { key: "c", label: __extraTr("تکمیل‌شده"), kind: "count", value: (r) => r.cur.completed },
    { key: "pc", label: __analyticsTr("سرانه تکمیل‌شده"), kind: "avg", value: (r) => r.pc.completed },
    { key: "u", label: __extraTr("حجم وزن‌دار"), kind: "count", value: (r) => r.cur.units },
    { key: "pcu", label: __extraTr("سرانه حجم"), kind: "avg", value: (r) => r.pc.units },
    { key: "h", label: __extraTr("ساعت"), kind: "count", value: (r) => r.cur.hours },
    { key: "cr", label: __extraTr("ایجادشده"), kind: "count", value: (r) => r.cur.created },
    { key: "ot", label: __analyticsTr("تحویل به‌موقع"), kind: "rate", value: (r) => r.cur.onTimeRate },
    { key: "cy", label: __analyticsTr("میانه زمان انجام"), kind: "days", value: (r) => r.cur.cycleMedian },
    { key: "rs", label: __extraTr("سهم برگشتی"), kind: "rate", value: (r) => r.cur.returnShare },
    { key: "hq", label: __extraTr("عالی و خوب"), kind: "rate", value: (r) => r.cur.highQualityShare },
    { key: "o", label: __extraTr("صف باز"), kind: "count", value: (r) => r.open.open },
    { key: "od", label: __extraTr("معوق"), kind: "count", value: (r) => r.open.overdue },
  ];

  return (
    <>
      <MetricGrid label={__analyticsTr("تیم‌ها")}>
        {m.rows.map((r, i) => (
          <Kpi
            key={r.key}
            label={<><Key color={`var(--cat-${i + 1})`} />{teamText(r.group)} · {fmtInt(r.headcount)}{" " + __analyticsTr("کارشناس") + ""}</>}
            value={fmtInt(r.cur.completed)} unit={__analyticsTr("تسک تکمیل‌شده")}
            delta={r.prev && <Delta now={r.cur.completed} before={r.prev.completed} label={cmp?.short} />}
            foot={`${__extraTr("سرانه")} ${fmtNum(r.pc.completed)} · ${__extraTr("به‌موقع")} ${fmtPct(r.cur.onTimeRate)} · ${__extraTr("صف باز")} ${fmtInt(r.open.open)}${r.open.overdue ? ` (${fmtInt(r.open.overdue)} ${__extraTr("معوق")})` : ""}`}
            spark={<Sparkline values={r.spark} />}
            href={a.href("/analytics/teams", { team: r.key })}
            testId={`team-card-${r.key}`}
          />
        ))}
      </MetricGrid>

      <div className="an-row">
        <ChartPanel
          title={__analyticsTr("مقایسه سرانه تیم‌ها")}
          question="با در نظر گرفتن اندازه تیم، هر تیم چقدر کار انجام داده است؟ خط عمودی: مقدار کل واحد."
          build={pcBuild}
          height={70 + 46 * m.rows.length}
          actions={<Segmented label={__analyticsTr("شاخص")} value={metric} onChange={setMetric} options={PC_METRICS.map(({ value, label }) => ({ value, label: __analyticsTr(label) }))} />}
          table={{ columns: [{ key: "t", label: __analyticsTr("تیم"), value: (r) => teamText(r.group) }, { key: "v", label: __analyticsTr(def.label), kind: def.kind, value: valueOf }], rows: m.rows }}
          fileName="team-per-capita"
        />
        <ChartPanel
          title={__analyticsTr("روند سرانه تسک‌های تکمیل‌شده")}
          question="کدام تیم روند متفاوتی دارد؟"
          build={trendBuild}
          height={250}
          table={{ columns: [{ key: "b", label: __analyticsTr("بازه"), value: (r) => r.label }, ...m.rows.map((r) => ({ key: r.key, label: teamText(r.group), kind: "avg", value: (x) => x[r.key] }))], rows: m.b.map((x, i) => ({ id: x.from, label: x.label, ...Object.fromEntries(m.rows.map((r) => [r.key, r.headcount ? r.series[i].completed / r.headcount : null])) })) }}
          fileName="team-per-capita-trend"
        />
      </div>

      <ChartPanel
        title={__analyticsTr("بار کار باز هر کارشناس")}
        question="کار باز متوازن پخش شده یا روی چند نفر جمع شده است؟ هر نقطه یک کارشناس است؛ روی نقطه کلیک کنید."
        build={loadBuild}
        height={80 + 56 * m.rows.length}
        onChartClick={(e) => e.data?.id && setPerson(e.data.id)}
        table={{ columns: [{ key: "n", label: __analyticsTr("کارشناس"), value: (r) => r.name }, { key: "t", label: __analyticsTr("تیم"), value: (r) => teamText(r.group) }, { key: "v", label: __extraTr("تسک باز"), kind: "count", value: (r) => r.value }], rows: m.load }}
        fileName="open-work-per-person"
        empty={m.load.length ? null : <AnEmpty title={__analyticsTr("کارشناس فعالی نیست")} />}
      />

      <div className="an-row">
        <ChartPanel title={__analyticsTr("ترکیب پیچیدگی")} question="نوع کار تیم‌ها چه فرقی دارد؟" build={cxBuild} height={60 + 46 * m.rows.length}
          table={{ columns: [{ key: "t", label: __analyticsTr("تیم"), value: (r) => r.label }, ...CX_FA.map((c, i) => ({ key: `c${i}`, label: __analyticsTr(c), kind: "count", value: (r) => r.parts[i] }))], rows: mixRows("cx") }} fileName="team-complexity-mix" />
        <ChartPanel title={__analyticsTr("توزیع کیفیت")} question="کیفیت ثبت‌شده هنگام تأیید در تیم‌ها چطور پخش شده است؟" build={qBuild} height={60 + 46 * m.rows.length}
          table={{ columns: [{ key: "t", label: __analyticsTr("تیم"), value: (r) => r.label }, ...QUAL_KEYS.map((k, i) => ({ key: k, label: __analyticsTr(QUAL_FA[k]), kind: "count", value: (r) => r.parts[i] }))], rows: mixRows("quality") }} fileName="team-quality" />
      </div>

      <Panel title={__analyticsTr("جدول کامل تیم‌ها")} meta={__analyticsTr("همه شاخص‌ها؛ برای مرتب‌سازی روی سرستون کلیک کنید")}>
        <DataTable columns={tableColumns} rows={m.rows} rowKey={(r) => r.key} rowHref={(r) => a.href("/analytics/teams", { team: r.key })} caption={__analyticsTr("جدول کامل تیم‌ها")} />
      </Panel>
      {person && <PersonDrawer id={person} onClose={() => setPerson(null)} />}
    </>
  );
}

function TeamDetail({ team }) {
  const { t: __extraTr } = useExtraI18n();
  const { fmtInt, fmtNum, fmtPct } = useAnalyticsFormat();
  const { t: __analyticsTr, team: teamText, role: roleText } = useAnalyticsI18n();
  const a = useAnalytics();
  const { view, range, cmp, gran, setFilters } = a;
  const [person, setPerson] = useState(null);
  const m = useMemo(() => {
    const b = buckets(range.from, range.end, gran, a.locale);
    const pb = cmp ? buckets(cmp.from, cmp.to, gran, a.locale) : [];
    const cur = stats(view, null, range);
    const people = peopleRows(view, range, cmp);
    const n = people.filter((r) => r.person.active || r.activeInPeriod).length;
    return {
      b, pb, cur, n, people,
      prev: cmp ? stats(view, null, cmp) : null,
      bs: bucketStats(view, null, b), pbs: bucketStats(view, null, pb),
      open: openStats(view, null),
      levels: team.key === "soc" ? levelRows(view, range, cmp) : [],
      shift: view.people.some((p) => p.shift),
    };
  }, [view, range, cmp, gran, team, a.locale]);
  const { cur, prev } = m;
  const trend = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), partial: m.b.map((x) => x.partial),
    series: [{ name: __extraTr("تکمیل‌شده"), data: m.bs.map((x) => x.completed), color: t["cat-1"], area: true }, { name: __extraTr("ایجادشده"), data: m.bs.map((x) => x.created), color: t["cat-2"] }],
    prev: cmp ? { name: __extraTr("تکمیل‌شده در دوره مقایسه"), data: m.pbs.map((x) => x.completed), labels: m.pb.map((x) => x.label) } : null,
  }), [m, cmp]);
  const levelBuild = useCallback((t) => hbarOption(t, { rows: m.levels.map((l) => ({ label: l.level, value: l.pc.completed, note: `${fmtInt(l.headcount)} ${a.locale === "fa" ? "کارشناس" : "analysts"} · ${fmtInt(l.cur.completed)} ${a.locale === "fa" ? "تسک" : "tasks"}` })), kind: "avg" }), [m]);
  const mixBuild = useCallback((t) => stackedOption(t, {
    rows: m.people.map((r) => ({ label: r.person.name, parts: r.cur.cx })), percent: false,
    parts: CX_FA.map((name, i) => ({ name: __analyticsTr(name), color: t.ramp[i] })),
  }), [m]);

  const columns = [
    { key: "name", label: __analyticsTr("کارشناس"), value: (r) => r.person.name, render: (r) => <span className="an-person">{r.person.name}<small>{[r.person.level, roleText(r.person.role), r.person.active ? null : __analyticsTr("غیرفعال")].filter(Boolean).join(" · ")}</small></span> },
    { key: "c", label: __extraTr("تکمیل‌شده"), kind: "count", value: (r) => r.cur.completed },
    { key: "d", label: __extraTr("تغییر"), value: (r) => (r.prev ? r.cur.completed - r.prev.completed : null), render: (r) => (r.prev ? <Delta now={r.cur.completed} before={r.prev.completed} /> : "—") },
    { key: "u", label: __extraTr("حجم وزن‌دار"), kind: "count", value: (r) => r.cur.units },
    { key: "h", label: __extraTr("ساعت"), kind: "count", value: (r) => r.cur.hours },
    { key: "ot", label: __extraTr("به‌موقع"), kind: "rate", value: (r) => r.cur.onTimeRate },
    { key: "o", label: __extraTr("صف باز"), kind: "count", value: (r) => r.open.open },
    { key: "od", label: __extraTr("معوق"), kind: "count", value: (r) => r.open.overdue },
    ...(m.shift ? [
      { key: "s", label: __analyticsTr("شیفت"), kind: "count", value: (r) => (r.person.shift ? r.cur.shifts : null) },
      { key: "rt", label: __extraTr("روتین"), kind: "rate", value: (r) => (r.person.shift ? r.cur.routineRate : null) },
      { key: "tk", label: __analyticsTr("تیکت"), kind: "count", value: (r) => (r.person.shift ? r.cur.tickets : null) },
    ] : []),
  ];

  return (
    <>
      <Trail items={[{ label: __extraTr("کل واحد"), onClick: () => setFilters({ team: "", level: "" }) }, ...(a.filters.level ? [{ label: teamText(team.name), onClick: () => setFilters({ level: "" }) }, { label: a.filters.level }] : [{ label: teamText(team.name) }])]} />
      <MetricGrid label={a.locale === "fa" ? `شاخص‌های ${teamText(team.name)}` : `${teamText(team.name)} metrics`}>
        <Kpi label={__analyticsTr("تسک‌های تکمیل‌شده")} icon="checkCircle" value={fmtInt(cur.completed)} delta={prev && <Delta now={cur.completed} before={prev.completed} label={cmp?.short} />} spark={<Sparkline values={m.bs.map((x) => x.completed)} />} />
        <Kpi label={__analyticsTr("سرانه تکمیل‌شده")} icon="team" value={fmtNum(m.n ? cur.completed / m.n : null)} foot={`${fmtInt(m.n)} ${a.locale === "fa" ? "کارشناس در دوره" : "analysts in the period"}`} />
        <Kpi label={__analyticsTr("حجم کار وزن‌دار")} icon="bars" value={fmtInt(cur.units)} delta={prev && <Delta now={cur.units} before={prev.units} label={cmp?.short} />} />
        <Kpi label={__analyticsTr("ساعت ثبت‌شده")} icon="clock" value={fmtNum(cur.hours, 0)} unit={__extraTr("ساعت")} delta={prev && <Delta now={cur.hours} before={prev.hours} label={cmp?.short} />} />
        <Kpi label={__analyticsTr("تحویل به‌موقع")} icon="cal" value={fmtPct(cur.onTimeRate)} delta={prev && cur.onTimeRate !== null && <Delta now={cur.onTimeRate} before={prev.onTimeRate} kind="rate" label={cmp?.short} />} foot={a.locale === "fa" ? `از ${fmtInt(cur.onTimeN)} تسک دارای ددلاین` : `Of ${fmtInt(cur.onTimeN)} tasks with deadlines`} />
        <Kpi label={__analyticsTr("صف کار باز (اکنون)")} icon="tasks" value={fmtInt(m.open.open)} tone={m.open.overdue ? "alert" : undefined} foot={a.locale === "fa" ? `${fmtInt(m.open.overdue)} معوق · ${fmtInt(m.open.blocked)} مسدود` : `${fmtInt(m.open.overdue)} overdue · ${fmtInt(m.open.blocked)} blocked`} />
      </MetricGrid>

      <div className={m.levels.length ? "an-row wide-first" : "an-grid"}>
        <ChartPanel title={__analyticsTr("ورودی و خروجی کار تیم")} question="صف کار این تیم رشد می‌کند یا کوچک می‌شود؟" build={trend} height={260}
          table={{ columns: [{ key: "b", label: __analyticsTr("بازه"), value: (r) => r.label }, { key: "c", label: __extraTr("تکمیل‌شده"), kind: "count", value: (r) => r.c }, { key: "n", label: __extraTr("ایجادشده"), kind: "count", value: (r) => r.n }], rows: m.b.map((x, i) => ({ id: x.from, label: x.label, c: m.bs[i].completed, n: m.bs[i].created })) }}
          fileName={`team-flow-${team.key}`} />
        {m.levels.length > 0 && (
          <ChartPanel title={__analyticsTr("سرانه تکمیل‌شده به تفکیک سطح")} question="حجم کار L1، L2 و L3 چه نسبتی دارد؟ (سطح‌ها کار متفاوتی دارند؛ برای مقایسه مستقیم نیست.)" build={levelBuild} height={200}
            table={{ columns: [{ key: "l", label: __analyticsTr("سطح"), value: (r) => r.level }, { key: "n", label: __analyticsTr("کارشناسان"), kind: "count", value: (r) => r.headcount }, { key: "c", label: __extraTr("تکمیل‌شده"), kind: "count", value: (r) => r.cur.completed }, { key: "pc", label: __extraTr("سرانه"), kind: "avg", value: (r) => r.pc.completed }, { key: "o", label: __extraTr("صف باز"), kind: "count", value: (r) => r.open.open }], rows: m.levels.map((l) => ({ ...l, id: l.level })) }}
            fileName={`team-levels-${team.key}`}
            footer={m.levels.map((l) => <button key={l.level} type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters({ level: l.level })}>{"" + __analyticsTr("فقط") + " "}{l.level}</button>)} />
        )}
      </div>

      <Panel title={__analyticsTr("اعضای تیم")} meta={__analyticsTr("الفبایی · برای خلاصه هر نفر روی ردیف کلیک کنید")}>
        <DataTable columns={columns} rows={m.people} rowKey={(r) => r.person.id} onRowClick={(r) => setPerson(r.person.id)} caption={a.locale === "fa" ? `اعضای ${teamText(team.name)}` : `${teamText(team.name)} members`} testId="member-table" />
      </Panel>

      <ChartPanel title={__analyticsTr("حجم و ترکیب کار هر کارشناس")} question="هر نفر چه مقدار و چه نوع کاری تکمیل کرده است؟" build={mixBuild} height={60 + 34 * Math.max(1, m.people.length)}
        table={{ columns: [{ key: "n", label: __analyticsTr("کارشناس"), value: (r) => r.person.name }, ...CX_FA.map((c, i) => ({ key: `c${i}`, label: __analyticsTr(c), kind: "count", value: (r) => r.cur.cx[i] }))], rows: m.people.map((r) => ({ ...r, id: r.person.id })) }}
        fileName={`member-work-mix-${team.key}`}
        empty={cur.completed ? null : <AnEmpty title={__analyticsTr("تسکی تکمیل نشده")}>{"" + __analyticsTr("در این بازه تسک تکمیل‌شده‌ای در این تیم نیست.") + ""}</AnEmpty>} />
      {person && <PersonDrawer id={person} onClose={() => setPerson(null)} />}
    </>
  );
}
