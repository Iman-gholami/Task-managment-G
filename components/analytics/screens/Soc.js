"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { api, useApp } from "@/components/AppProvider";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { AlertCard } from "@/components/analytics/blocks";
import { hbarOption, heatmapOption, lineOption, stackedOption } from "@/components/analytics/chartOptions";
import PersonDrawer from "@/components/analytics/PersonDrawer";
import { AnEmpty, ChartPanel, DataTable, Delta, Kpi, Sparkline } from "@/components/analytics/ui";
import { MetricGrid } from "@/components/ui/Metric";
import Icon from "@/components/ui/Icon";
import { Panel } from "@/components/ui/layout";
import Segmented from "@/components/ui/Segmented";
import { buildAlerts } from "@/lib/analytics/alerts";
import { faDate, faDigits, faMonthLabel, jalaliMonthKey, jalaliMonthsInRange } from "@/lib/analytics/calendar";
import { fmtInt, fmtNum, fmtPct } from "@/lib/analytics/format";
import { ACTIVITIES_FA, QUAL_FA, QUAL_KEYS, SHIFT_FA, SHIFT_KEYS } from "@/lib/analytics/labels";
import { bucketStats, dailySeries, idsOf, stats } from "@/lib/analytics/metrics";
import { buckets } from "@/lib/analytics/periods";

// Short column labels for the heatmap; the full activity name is in the tooltip and the table.
const ACT_SHORT = ["Splunk", "فایل IP", "اسکنر و سنسور", "گزارش ترافیک", "Grafana", "سایت مرکز", "اخبار امنیتی", "MISP و IOC"];

const REVIEW_OPTIONS = QUAL_KEYS.map((value) => ({ value, label: QUAL_FA[value] }));

const reviewTime = (at) => {
  if (!at) return "";
  const d = new Date(at.includes("T") ? at : at.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return faDigits(at);
  return faDigits(d.toLocaleString("en-GB", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
};

function ReviewEditor({ analytics, person, month, review, eligible }) {
  const { toast } = useApp();
  const [rating, setRating] = useState(review?.rating ?? "");
  const [note, setNote] = useState(review?.note ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setRating(review?.rating ?? ""); setNote(review?.note ?? ""); }, [review?.rating, review?.note, month]);

  if (!eligible) return <span className="muted">شیفت‌لاگی با چک‌لیست ندارد</span>;
  if (analytics.demo) return (
    <span>{review ? QUAL_FA[review.rating] : "—"}{review?.note ? <small className="muted"> · {review.note}</small> : null}</span>
  );

  const save = async () => {
    if (!rating || saving) return;
    setSaving(true);
    try {
      await api("/api/shift/reviews", { method: "PUT", body: { userId: person.id, month, rating, note } });
      await analytics.reload();
      toast("ارزیابی ماهانه ذخیره شد");
    } catch (e) { toast(e.message, "error"); } finally { setSaving(false); }
  };
  const clear = async () => {
    if (!review) { setRating(""); setNote(""); return; }
    setSaving(true);
    try {
      await api("/api/shift/reviews", { method: "DELETE", body: { userId: person.id, month } });
      await analytics.reload();
      toast("ارزیابی ماهانه پاک شد");
    } catch (e) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  return (
    <div style={{ minWidth: 430 }}>
      <Segmented label={`کیفیت شیفت‌لاگ ${person.name}`} value={rating || REVIEW_OPTIONS[0].value} onChange={setRating} options={REVIEW_OPTIONS} className={!rating ? "is-unset" : ""} />
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <input className="input input-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت اختیاری" aria-label={`یادداشت ارزیابی ${person.name}`} />
        <button type="button" className="btn btn-primary btn-sm" disabled={!rating || saving} onClick={save}>ذخیره</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={saving || (!review && !rating && !note)} onClick={clear}>پاک کردن</button>
      </div>
      {review && <small className="muted">ثبت‌شده توسط {review.byName ?? "—"} در {reviewTime(review.at)}</small>}
    </div>
  );
}

function MonthlyShiftReviews({ analytics, analysts }) {
  const { view } = analytics;
  const months = useMemo(() => jalaliMonthsInRange(view.window.from, view.window.to).filter((m) => m.from <= analytics.today), [view.window.from, view.window.to, analytics.today]);
  const currentMonth = jalaliMonthKey(analytics.today);
  const [month, setMonth] = useState("");
  useEffect(() => {
    if (months.some((m) => m.month === month)) return;
    const previous = [...months].reverse().find((m) => m.month < currentMonth);
    setMonth(previous?.month ?? months.at(-1)?.month ?? "");
  }, [months, month, currentMonth]);
  const bounds = months.find((m) => m.month === month);
  if (!bounds) return null;
  const range = { from: bounds.from, to: bounds.to, end: bounds.to };
  const reviews = view.reviews ?? [];
  const rows = analysts.map((person) => {
    const cur = stats(view, [person.id], range);
    const eligible = view.shifts.some((s) => s.a === person.id && s.date >= bounds.from && s.date <= bounds.to && s.log && s.total > 0);
    return { id: person.id, person, cur, eligible, review: reviews.find((r) => r.a === person.id && r.month === month) ?? null };
  });
  const columns = [
    { key: "name", label: "تحلیلگر", value: (r) => r.person.name, render: (r) => <span className="an-person">{r.person.name}<small>{r.person.level}</small></span> },
    { key: "shift", label: "شیفت", kind: "count", value: (r) => r.cur.shifts },
    { key: "closure", label: "بسته‌شدن لاگ", value: (r) => r.cur.closureRate, render: (r) => <span>{fmtPct(r.cur.closureRate)} <small className="muted">(n={faDigits(r.cur.past)})</small></span> },
    { key: "routine", label: "انجام روتین", kind: "rate", value: (r) => r.cur.routineRate },
    { key: "missed", label: "جامانده", kind: "count", value: (r) => r.cur.missed },
    { key: "review", label: "ارزیابی ماهانه", sort: false, value: () => null, render: (r) => <ReviewEditor analytics={analytics} person={r.person} month={month} review={r.review} eligible={r.eligible} /> },
  ];

  return (
    <Panel
      title="ارزیابی ماهانه شیفت‌لاگ"
      meta="یک ارزیابی کیفیت برای هر تحلیلگر در هر ماه شمسی؛ شیفت‌لاگ‌های روزانه امتیاز ندارند."
      actions={<select className="input input-sm" style={{ width: 180 }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="ماه ارزیابی شیفت‌لاگ">{months.map((m) => <option key={m.month} value={m.month}>{faMonthLabel(m.from)}</option>)}</select>}
    >
      {analytics.demo && <div className="an-note" role="note"><Icon name="info" />داده نمایشی فقط‌خواندنی است؛ ارزیابی‌ها برای نمایش نحوه امتیازدهی ساخته شده‌اند.</div>}
      {month === currentMonth && <div className="an-note" role="note"><Icon name="info" />ماه هنوز تمام نشده است؛ ثبت ارزیابی ماه جاری مجاز است.</div>}
      {["L1", "L2", "L3"].map((level) => {
        const levelRows = rows.filter((r) => r.person.level === level).sort((a, b) => a.person.name.localeCompare(b.person.name, "fa"));
        return levelRows.length ? <div key={level} style={{ marginTop: 14 }}><div className="panel-head"><h3>SOC · {level}</h3></div><DataTable columns={columns} rows={levelRows} caption={`ارزیابی ماهانه SOC ${level}`} /></div> : null;
      })}
    </Panel>
  );
}

export default function Soc() {
  return (
    <AnalyticsFrame title="عملیات شیفت SOC" subtitle="شیفت‌های عملیاتی SOC شامل کارشناسان طراحی و خودکارسازی">
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

  if (!m.ids.length) return <Panel><AnEmpty icon="shift" title="تحلیلگر SOC در این دامنه نیست">شیفت‌لاگ برای نیروی برنامه‌ریزی‌شده SOC ثبت می‌شود؛ مرخصی و تعطیل شیفت نیاز به شیفت‌لاگ ندارند.</AnEmpty></Panel>;

  const typeCounts = SHIFT_KEYS.map((k) => cur.shiftTypes[k]);
  const columns = [
    { key: "n", label: "تحلیلگر", value: (r) => r.person.name, render: (r) => <span className="an-person">{r.person.name}<small>{r.person.level}</small></span> },
    { key: "s", label: "شیفت", kind: "count", value: (r) => r.cur.shifts },
    { key: "off", label: "تعطیل شیفت", kind: "count", value: (r) => r.cur.offDays },
    { key: "leave", label: "مرخصی", kind: "count", value: (r) => r.cur.leaveDays },
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
        <Kpi label="تعطیل شیفت" icon="cal" value={fmtInt(cur.offDays)} foot="بدون شیفت‌لاگ؛ جزو شیفت کاری نیست" />
        <Kpi label="مرخصی" icon="cal" value={fmtInt(cur.leaveDays)} foot="بدون شیفت‌لاگ؛ جزو شیفت کاری نیست" />
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
      <MonthlyShiftReviews analytics={a} analysts={m.rows.map((r) => r.person)} />
      {person && <PersonDrawer id={person} onClose={() => setPerson(null)} />}
    </>
  );
}
