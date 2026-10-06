"use client";

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
  const team = filters.team ? GROUP_BY_KEY[filters.team] : null;
  return (
    <AnalyticsFrame title={team ? `تیم ${team.fa}` : "عملکرد تیم‌ها"} exportKind="teams">
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
  const a = useAnalytics();
  const { view, range, cmp, gran } = a;
  const [metric, setMetric] = useState("completed");
  const [person, setPerson] = useState(null);
  const m = useMemo(() => {
    const b = buckets(range.from, range.end, gran);
    const rows = teamRows(view, range, cmp).map((t) => {
      const series = bucketStats(view, idsOf(t.people), b);
      return { ...t, series, spark: series.map((x) => x.completed) };
    });
    const all = stats(view, null, range);
    const n = rows.reduce((s, t) => s + t.headcount, 0);
    const load = experts(view).filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, group: p.group, value: openStats(view, [p.id]).open }));
    return { b, rows, all, n, load };
  }, [view, range, cmp, gran]);
  const def = PC_METRICS.find((x) => x.value === metric);
  const valueOf = (t) => (def.pc ? t.pc[metric] : t.cur[metric]);
  const deptValue = def.pc ? (m.n ? m.all[metric] / m.n : null) : m.all[metric];

  const pcBuild = useCallback((t) => hbarOption(t, {
    rows: m.rows.map((r) => ({ label: r.fa, value: valueOf(r), id: r.key, note: def.pc ? `${faDigits(r.headcount)} کارشناس` : "" })),
    kind: def.kind, median: deptValue,
  }), [m, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const trendBuild = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), partial: m.b.map((x) => x.partial), kind: "avg",
    series: m.rows.map((r, i) => ({ name: r.fa, data: r.series.map((x) => (r.headcount ? x.completed / r.headcount : null)), color: t.cat[i] })),
  }), [m]);
  const groups = m.rows.map((r) => r.fa);
  const loadBuild = useCallback((t) => stripOption(t, {
    groups,
    points: m.load.map((p) => ({ ...p, groupIndex: m.rows.findIndex((r) => r.group === p.group) })).filter((p) => p.groupIndex >= 0),
    median: median(m.load.map((p) => p.value)),
  }), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const mixRows = (key) => m.rows.map((r) => ({ label: r.fa, parts: r.cur[key] }));
  const cxBuild = useCallback((t) => stackedOption(t, { rows: mixRows("cx"), parts: CX_FA.map((name, i) => ({ name, color: t.ramp[i] })) }), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const qBuild = useCallback((t) => stackedOption(t, { rows: mixRows("quality"), parts: QUAL_KEYS.map((k, i) => ({ name: QUAL_FA[k], color: t.ramp[3 - i] })) }), [m]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m.rows.length) return <Panel><AnEmpty title="تیمی در این دامنه نیست">با این فیلترها کارشناسی پیدا نشد.</AnEmpty></Panel>;

  const tableColumns = [
    { key: "team", label: "تیم", value: (r) => r.fa, render: (r) => <b>{r.fa}</b> },
    { key: "n", label: "کارشناسان", kind: "count", value: (r) => r.headcount },
    { key: "c", label: "تکمیل‌شده", kind: "count", value: (r) => r.cur.completed },
    { key: "pc", label: "سرانه تکمیل‌شده", kind: "avg", value: (r) => r.pc.completed },
    { key: "u", label: "حجم وزن‌دار", kind: "count", value: (r) => r.cur.units },
    { key: "pcu", label: "سرانه حجم", kind: "avg", value: (r) => r.pc.units },
    { key: "h", label: "ساعت", kind: "count", value: (r) => r.cur.hours },
    { key: "cr", label: "ایجادشده", kind: "count", value: (r) => r.cur.created },
    { key: "ot", label: "تحویل به‌موقع", kind: "rate", value: (r) => r.cur.onTimeRate },
    { key: "cy", label: "میانه زمان انجام", kind: "days", value: (r) => r.cur.cycleMedian },
    { key: "rs", label: "سهم برگشتی", kind: "rate", value: (r) => r.cur.returnShare },
    { key: "hq", label: "عالی و خوب", kind: "rate", value: (r) => r.cur.highQualityShare },
    { key: "o", label: "صف باز", kind: "count", value: (r) => r.open.open },
    { key: "od", label: "معوق", kind: "count", value: (r) => r.open.overdue },
  ];

  return (
    <>
      <MetricGrid label="تیم‌ها">
        {m.rows.map((r, i) => (
          <Kpi
            key={r.key}
            label={<><Key color={`var(--cat-${i + 1})`} />{r.fa} · {faDigits(r.headcount)} کارشناس</>}
            value={fmtInt(r.cur.completed)} unit="تسک تکمیل‌شده"
            delta={r.prev && <Delta now={r.cur.completed} before={r.prev.completed} label={cmp?.short} />}
            foot={`سرانه ${fmtNum(r.pc.completed)} · به‌موقع ${fmtPct(r.cur.onTimeRate)} · صف باز ${faDigits(r.open.open)}${r.open.overdue ? ` (${faDigits(r.open.overdue)} معوق)` : ""}`}
            spark={<Sparkline values={r.spark} />}
            href={a.href("/analytics/teams", { team: r.key })}
            testId={`team-card-${r.key}`}
          />
        ))}
      </MetricGrid>

      <div className="an-row">
        <ChartPanel
          title="مقایسه سرانه تیم‌ها"
          question="با در نظر گرفتن اندازه تیم، هر تیم چقدر کار انجام داده است؟ خط عمودی: مقدار کل واحد."
          build={pcBuild}
          height={70 + 46 * m.rows.length}
          actions={<Segmented label="شاخص" value={metric} onChange={setMetric} options={PC_METRICS.map(({ value, label }) => ({ value, label }))} />}
          table={{ columns: [{ key: "t", label: "تیم", value: (r) => r.fa }, { key: "v", label: def.label, kind: def.kind, value: valueOf }], rows: m.rows }}
          fileName="سرانه-تیم‌ها"
        />
        <ChartPanel
          title="روند سرانه تسک‌های تکمیل‌شده"
          question="کدام تیم روند متفاوتی دارد؟"
          build={trendBuild}
          height={250}
          table={{ columns: [{ key: "b", label: "بازه", value: (r) => r.label }, ...m.rows.map((r) => ({ key: r.key, label: r.fa, kind: "avg", value: (x) => x[r.key] }))], rows: m.b.map((x, i) => ({ id: x.from, label: x.label, ...Object.fromEntries(m.rows.map((r) => [r.key, r.headcount ? r.series[i].completed / r.headcount : null])) })) }}
          fileName="روند-سرانه-تیم‌ها"
        />
      </div>

      <ChartPanel
        title="بار کار باز هر کارشناس"
        question="کار باز متوازن پخش شده یا روی چند نفر جمع شده است؟ هر نقطه یک کارشناس است؛ روی نقطه کلیک کنید."
        build={loadBuild}
        height={80 + 56 * m.rows.length}
        onChartClick={(e) => e.data?.id && setPerson(e.data.id)}
        table={{ columns: [{ key: "n", label: "کارشناس", value: (r) => r.name }, { key: "t", label: "تیم", value: (r) => GROUP_BY_KEY[m.rows.find((x) => x.group === r.group)?.key]?.fa }, { key: "v", label: "تسک باز", kind: "count", value: (r) => r.value }], rows: m.load }}
        fileName="بار-کار-باز"
        empty={m.load.length ? null : <AnEmpty title="کارشناس فعالی نیست" />}
      />

      <div className="an-row">
        <ChartPanel title="ترکیب پیچیدگی" question="نوع کار تیم‌ها چه فرقی دارد؟" build={cxBuild} height={60 + 46 * m.rows.length}
          table={{ columns: [{ key: "t", label: "تیم", value: (r) => r.label }, ...CX_FA.map((c, i) => ({ key: `c${i}`, label: c, kind: "count", value: (r) => r.parts[i] }))], rows: mixRows("cx") }} fileName="ترکیب-پیچیدگی-تیم‌ها" />
        <ChartPanel title="توزیع کیفیت" question="کیفیت ثبت‌شده هنگام تأیید در تیم‌ها چطور پخش شده است؟" build={qBuild} height={60 + 46 * m.rows.length}
          table={{ columns: [{ key: "t", label: "تیم", value: (r) => r.label }, ...QUAL_KEYS.map((k, i) => ({ key: k, label: QUAL_FA[k], kind: "count", value: (r) => r.parts[i] }))], rows: mixRows("quality") }} fileName="کیفیت-تیم‌ها" />
      </div>

      <Panel title="جدول کامل تیم‌ها" meta="همه شاخص‌ها؛ برای مرتب‌سازی روی سرستون کلیک کنید">
        <DataTable columns={tableColumns} rows={m.rows} rowKey={(r) => r.key} rowHref={(r) => a.href("/analytics/teams", { team: r.key })} caption="جدول کامل تیم‌ها" />
      </Panel>
      {person && <PersonDrawer id={person} onClose={() => setPerson(null)} />}
    </>
  );
}

function TeamDetail({ team }) {
  const a = useAnalytics();
  const { view, range, cmp, gran, setFilters } = a;
  const [person, setPerson] = useState(null);
  const m = useMemo(() => {
    const b = buckets(range.from, range.end, gran);
    const pb = cmp ? buckets(cmp.from, cmp.to, gran) : [];
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
  }, [view, range, cmp, gran, team]);
  const { cur, prev } = m;
  const trend = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), partial: m.b.map((x) => x.partial),
    series: [{ name: "تکمیل‌شده", data: m.bs.map((x) => x.completed), color: t["cat-1"], area: true }, { name: "ایجادشده", data: m.bs.map((x) => x.created), color: t["cat-2"] }],
    prev: cmp ? { name: "تکمیل‌شده در دوره مقایسه", data: m.pbs.map((x) => x.completed), labels: m.pb.map((x) => x.label) } : null,
  }), [m, cmp]);
  const levelBuild = useCallback((t) => hbarOption(t, { rows: m.levels.map((l) => ({ label: l.level, value: l.pc.completed, note: `${faDigits(l.headcount)} کارشناس · ${faDigits(l.cur.completed)} تسک` })), kind: "avg" }), [m]);
  const mixBuild = useCallback((t) => stackedOption(t, {
    rows: m.people.map((r) => ({ label: r.person.name, parts: r.cur.cx })), percent: false,
    parts: CX_FA.map((name, i) => ({ name, color: t.ramp[i] })),
  }), [m]);

  const columns = [
    { key: "name", label: "کارشناس", value: (r) => r.person.name, render: (r) => <span className="an-person">{r.person.name}<small>{[r.person.level, ROLE_FA[r.person.role], r.person.active ? null : "غیرفعال"].filter(Boolean).join(" · ")}</small></span> },
    { key: "c", label: "تکمیل‌شده", kind: "count", value: (r) => r.cur.completed },
    { key: "d", label: "تغییر", value: (r) => (r.prev ? r.cur.completed - r.prev.completed : null), render: (r) => (r.prev ? <Delta now={r.cur.completed} before={r.prev.completed} /> : "—") },
    { key: "u", label: "حجم وزن‌دار", kind: "count", value: (r) => r.cur.units },
    { key: "h", label: "ساعت", kind: "count", value: (r) => r.cur.hours },
    { key: "ot", label: "به‌موقع", kind: "rate", value: (r) => r.cur.onTimeRate },
    { key: "o", label: "صف باز", kind: "count", value: (r) => r.open.open },
    { key: "od", label: "معوق", kind: "count", value: (r) => r.open.overdue },
    ...(m.shift ? [
      { key: "s", label: "شیفت", kind: "count", value: (r) => (r.person.shift ? r.cur.shifts : null) },
      { key: "rt", label: "روتین", kind: "rate", value: (r) => (r.person.shift ? r.cur.routineRate : null) },
      { key: "tk", label: "تیکت", kind: "count", value: (r) => (r.person.shift ? r.cur.tickets : null) },
    ] : []),
  ];

  return (
    <>
      <Trail items={[{ label: "کل واحد", onClick: () => setFilters({ team: "", level: "" }) }, ...(a.filters.level ? [{ label: team.fa, onClick: () => setFilters({ level: "" }) }, { label: a.filters.level }] : [{ label: team.fa }])]} />
      <MetricGrid label={`شاخص‌های ${team.fa}`}>
        <Kpi label="تسک‌های تکمیل‌شده" icon="checkCircle" value={fmtInt(cur.completed)} delta={prev && <Delta now={cur.completed} before={prev.completed} label={cmp?.short} />} spark={<Sparkline values={m.bs.map((x) => x.completed)} />} />
        <Kpi label="سرانه تکمیل‌شده" icon="team" value={fmtNum(m.n ? cur.completed / m.n : null)} foot={`${faDigits(m.n)} کارشناس در دوره`} />
        <Kpi label="حجم کار وزن‌دار" icon="bars" value={fmtInt(cur.units)} delta={prev && <Delta now={cur.units} before={prev.units} label={cmp?.short} />} />
        <Kpi label="ساعت ثبت‌شده" icon="clock" value={fmtNum(cur.hours, 0)} unit="ساعت" delta={prev && <Delta now={cur.hours} before={prev.hours} label={cmp?.short} />} />
        <Kpi label="تحویل به‌موقع" icon="cal" value={fmtPct(cur.onTimeRate)} delta={prev && cur.onTimeRate !== null && <Delta now={cur.onTimeRate} before={prev.onTimeRate} kind="rate" label={cmp?.short} />} foot={`از ${faDigits(cur.onTimeN)} تسک دارای ددلاین`} />
        <Kpi label="صف کار باز (اکنون)" icon="tasks" value={fmtInt(m.open.open)} tone={m.open.overdue ? "alert" : undefined} foot={`${faDigits(m.open.overdue)} معوق · ${faDigits(m.open.blocked)} مسدود`} />
      </MetricGrid>

      <div className={m.levels.length ? "an-row wide-first" : "an-grid"}>
        <ChartPanel title="ورودی و خروجی کار تیم" question="صف کار این تیم رشد می‌کند یا کوچک می‌شود؟" build={trend} height={260}
          table={{ columns: [{ key: "b", label: "بازه", value: (r) => r.label }, { key: "c", label: "تکمیل‌شده", kind: "count", value: (r) => r.c }, { key: "n", label: "ایجادشده", kind: "count", value: (r) => r.n }], rows: m.b.map((x, i) => ({ id: x.from, label: x.label, c: m.bs[i].completed, n: m.bs[i].created })) }}
          fileName={`روند-${team.fa}`} />
        {m.levels.length > 0 && (
          <ChartPanel title="سرانه تکمیل‌شده به تفکیک سطح" question="حجم کار L1، L2 و L3 چه نسبتی دارد؟ (سطح‌ها کار متفاوتی دارند؛ برای مقایسه مستقیم نیست.)" build={levelBuild} height={200}
            table={{ columns: [{ key: "l", label: "سطح", value: (r) => r.level }, { key: "n", label: "کارشناسان", kind: "count", value: (r) => r.headcount }, { key: "c", label: "تکمیل‌شده", kind: "count", value: (r) => r.cur.completed }, { key: "pc", label: "سرانه", kind: "avg", value: (r) => r.pc.completed }, { key: "o", label: "صف باز", kind: "count", value: (r) => r.open.open }], rows: m.levels.map((l) => ({ ...l, id: l.level })) }}
            fileName={`سطح‌ها-${team.fa}`}
            footer={m.levels.map((l) => <button key={l.level} type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters({ level: l.level })}>فقط {l.level}</button>)} />
        )}
      </div>

      <Panel title="اعضای تیم" meta="الفبایی · برای خلاصه هر نفر روی ردیف کلیک کنید">
        <DataTable columns={columns} rows={m.people} rowKey={(r) => r.person.id} onRowClick={(r) => setPerson(r.person.id)} caption={`اعضای ${team.fa}`} testId="member-table" />
      </Panel>

      <ChartPanel title="حجم و ترکیب کار هر کارشناس" question="هر نفر چه مقدار و چه نوع کاری تکمیل کرده است؟" build={mixBuild} height={60 + 34 * Math.max(1, m.people.length)}
        table={{ columns: [{ key: "n", label: "کارشناس", value: (r) => r.person.name }, ...CX_FA.map((c, i) => ({ key: `c${i}`, label: c, kind: "count", value: (r) => r.cur.cx[i] }))], rows: m.people.map((r) => ({ ...r, id: r.person.id })) }}
        fileName={`ترکیب-کار-${team.fa}`}
        empty={cur.completed ? null : <AnEmpty title="تسکی تکمیل نشده">در این بازه تسک تکمیل‌شده‌ای در این تیم نیست.</AnEmpty>} />
      {person && <PersonDrawer id={person} onClose={() => setPerson(null)} />}
    </>
  );
}
