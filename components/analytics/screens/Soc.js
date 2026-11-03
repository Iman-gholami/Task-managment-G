"use client";

import { useI18n as useExtraI18n } from "@/components/I18nProvider";

import useAnalyticsFormat from "@/components/analytics/useAnalyticsFormat";

import { useI18n as useAnalyticsI18n } from "@/components/I18nProvider";

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
import { faDigits, localDate, localMonth, jalaliMonthKey, jalaliMonthsInRange } from "@/lib/analytics/calendar";
import { fmtInt, fmtNum, fmtPct } from "@/lib/analytics/format";
import { ACTIVITIES_FA, ACTIVITIES_EN, QUAL_FA, QUAL_KEYS, SHIFT_FA, SHIFT_KEYS } from "@/lib/analytics/labels";
import { bucketStats, dailySeries, idsOf, stats } from "@/lib/analytics/metrics";
import { buckets } from "@/lib/analytics/periods";

// Short column labels for the heatmap; the full activity name is in the tooltip and the table.
const ACT_SHORT = ["Splunk", "فایل IP", "اسکنر و سنسور", "گزارش ترافیک", "Grafana", "سایت مرکز", "اخبار امنیتی", "MISP و IOC"];

const REVIEW_OPTIONS = QUAL_KEYS.map((value) => ({ value, label: QUAL_FA[value] }));

const reviewTime = (at, locale) => {
  if (!at) return "";
  const d = new Date(at.includes("T") ? at : at.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return locale === "fa" ? faDigits(at) : at;
  const value = d.toLocaleString("en-GB", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return locale === "fa" ? faDigits(value) : value;
};

function ReviewEditor({ analytics, person, month, review, eligible }) {
  const { t: __analyticsTr, locale } = useAnalyticsI18n();
  const { toast } = useApp();
  const [rating, setRating] = useState(review?.rating ?? "");
  const [note, setNote] = useState(review?.note ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setRating(review?.rating ?? ""); setNote(review?.note ?? ""); }, [review?.rating, review?.note, month]);

  if (!eligible) return <span className="muted">{"" + __analyticsTr("شیفت‌لاگی با چک‌لیست ندارد") + ""}</span>;
  if (analytics.demo) return (
    <span>{review ? __analyticsTr(QUAL_FA[review.rating]) : "—"}{review?.note ? <small className="muted"> · {review.note}</small> : null}</span>
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
      <Segmented label={locale === "fa" ? `کیفیت شیفت‌لاگ ${person.name}` : `${person.name}'s shift log quality`} value={rating || REVIEW_OPTIONS[0].value} onChange={setRating} options={REVIEW_OPTIONS.map((o) => ({ ...o, label: __analyticsTr(o.label) }))} className={!rating ? "is-unset" : ""} />
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <input className="input input-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder={__analyticsTr("یادداشت اختیاری")} aria-label={locale === "fa" ? `یادداشت ارزیابی ${person.name}` : `${person.name}'s evaluation note`} />
        <button type="button" className="btn btn-primary btn-sm" disabled={!rating || saving} onClick={save}>{"" + __analyticsTr("ذخیره") + ""}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={saving || (!review && !rating && !note)} onClick={clear}>{"" + __analyticsTr("پاک کردن") + ""}</button>
      </div>
      {review && <small className="muted">{"" + __analyticsTr("ثبت‌شده توسط") + " "}{review.byName ?? "—"}{" " + __analyticsTr("در") + " "}{reviewTime(review.at, locale)}</small>}
    </div>
  );
}

function MonthlyShiftReviews({ analytics, analysts }) {
  const { t: __extraTr } = useExtraI18n();
  const { fmtPct } = useAnalyticsFormat();
  const { t: __analyticsTr } = useAnalyticsI18n();
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
    { key: "name", label: __extraTr("تحلیلگر"), value: (r) => r.person.name, render: (r) => <span className="an-person">{r.person.name}<small>{r.person.level}</small></span> },
    { key: "shift", label: __analyticsTr("شیفت"), kind: "count", value: (r) => r.cur.shifts },
    { key: "closure", label: __extraTr("بسته‌شدن لاگ"), value: (r) => r.cur.closureRate, render: (r) => <span>{fmtPct(r.cur.closureRate)} <small className="muted">(n={analytics.locale === "fa" ? faDigits(r.cur.past) : r.cur.past})</small></span> },
    { key: "routine", label: __analyticsTr("انجام روتین"), kind: "rate", value: (r) => r.cur.routineRate },
    { key: "missed", label: __extraTr("جامانده"), kind: "count", value: (r) => r.cur.missed },
    { key: "review", label: __extraTr("ارزیابی ماهانه"), sort: false, value: () => null, render: (r) => <ReviewEditor analytics={analytics} person={r.person} month={month} review={r.review} eligible={r.eligible} /> },
  ];

  return (
    <Panel
      title={__analyticsTr("ارزیابی ماهانه شیفت‌لاگ")}
      meta={__analyticsTr("یک ارزیابی کیفیت برای هر تحلیلگر در هر ماه شمسی؛ شیفت‌لاگ‌های روزانه امتیاز ندارند.")}
      actions={<select className="input input-sm" style={{ width: 180 }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label={__analyticsTr("ماه ارزیابی شیفت‌لاگ")}>{months.map((m) => <option key={m.month} value={m.month}>{localMonth(m.from, analytics.locale)}</option>)}</select>}
    >
      {analytics.demo && <div className="an-note" role="note"><Icon name="info" />{"" + __analyticsTr("داده نمایشی فقط‌خواندنی است؛ ارزیابی‌ها برای نمایش نحوه امتیازدهی ساخته شده‌اند.") + ""}</div>}
      {month === currentMonth && <div className="an-note" role="note"><Icon name="info" />{"" + __analyticsTr("ماه هنوز تمام نشده است؛ ثبت ارزیابی ماه جاری مجاز است.") + ""}</div>}
      {["L1", "L2", "L3"].map((level) => {
        const levelRows = rows.filter((r) => r.person.level === level).sort((a, b) => a.person.name.localeCompare(b.person.name, "fa"));
        return levelRows.length ? <div key={level} style={{ marginTop: 14 }}><div className="panel-head"><h3>SOC · {level}</h3></div><DataTable columns={columns} rows={levelRows} caption={`ارزیابی ماهانه SOC ${level}`} /></div> : null;
      })}
    </Panel>
  );
}

export default function Soc() {
  const { t: __analyticsTr } = useAnalyticsI18n();
  return (
    <AnalyticsFrame title={__analyticsTr("عملیات شیفت SOC")} subtitle={__analyticsTr("شیفت‌های عملیاتی SOC شامل کارشناسان طراحی و خودکارسازی")}>
      <SocBody />
    </AnalyticsFrame>
  );
}

function SocBody() {
  const { t: __extraTr } = useExtraI18n();
  const { fmtInt, fmtPct, fmtNum } = useAnalyticsFormat();
  const { t: __analyticsTr } = useAnalyticsI18n();
  const a = useAnalytics();
  const activities = a.locale === "fa" ? ACTIVITIES_FA : ACTIVITIES_EN;
  const activityShort = a.locale === "fa" ? ACT_SHORT : ["Splunk", "IP files", "Scanner and sensors", "Traffic report", "Grafana", "Center website", "Security news", "MISP and IOC"];
  const { view, range, cmp, gran } = a;
  const [person, setPerson] = useState(null);
  const m = useMemo(() => {
    const analysts = view.people.filter((p) => p.shift);
    const ids = idsOf(analysts);
    const b = buckets(range.from, range.end, gran, a.locale);
    const rows = analysts
      .map((p) => ({ id: p.id, person: p, cur: stats(view, [p.id], range), prev: cmp ? stats(view, [p.id], cmp) : null }))
      .filter((r) => r.person.active || r.cur.shifts)
      .sort((x, y) => x.person.name.localeCompare(y.person.name, "fa"));
    const shiftAlert = buildAlerts({ ...view, tasks: [] }, { locale: a.locale }).find((x) => x.id === "missed-logs") ?? null;
    return {
      ids, rows, b, shiftAlert,
      cur: stats(view, ids, range),
      prev: cmp ? stats(view, ids, cmp) : null,
      series: bucketStats(view, ids, b),
      iocs: dailySeries(view, ids, range.from, range.end, "iocs"),
      tickets: dailySeries(view, ids, range.from, range.end, "tickets"),
    };
  }, [view, range, cmp, gran, a.locale]);
  const { cur, prev } = m;
  const short = cmp?.short;

  const heat = useCallback((t) => heatmapOption(t, {
    xLabels: activityShort, xTip: activities, yLabels: m.rows.map((r) => r.person.name),
    data: m.rows.flatMap((r, y) => r.cur.activityRates.map((v, x) => [x, y, v])), kind: "rate", max: 1,
  }), [m, a.locale]);
  const types = useCallback((t) => stackedOption(t, {
    rows: m.rows.map((r) => ({ label: r.person.name, parts: SHIFT_KEYS.map((k) => r.cur.shiftTypes[k]) })), percent: false,
    parts: SHIFT_KEYS.map((k) => ({ name: __analyticsTr(SHIFT_FA[k]), color: t[`shift-${k}`] })),
  }), [m, a.locale]);
  const daily = (key, name) => (t) => lineOption(t, { labels: m[key].map(([d]) => localDate(d, a.locale, { year: false })), bars: true, series: [{ name, data: m[key].map(([, v]) => v) }] });
  const iocBuild = useCallback(daily("iocs", "IOC"), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticketBuild = useCallback(daily("tickets", __analyticsTr("تیکت")), [m, a.locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const acts = useCallback((t) => hbarOption(t, { rows: activities.map((label, i) => ({ label, value: cur.activityRates[i], note: `${fmtInt(cur.activityN[i])} ${a.locale === "fa" ? "شیفت" : "shifts"}` })).filter((r) => r.value !== null), kind: "rate", max: 1, labelWidth: 260 }), [cur, a.locale]);

  if (!m.ids.length) return <Panel><AnEmpty icon="shift" title={__analyticsTr("تحلیلگر SOC در این دامنه نیست")}>{"" + __analyticsTr("شیفت‌لاگ برای نیروی برنامه‌ریزی‌شده SOC ثبت می‌شود؛ مرخصی و تعطیل شیفت نیاز به شیفت‌لاگ ندارند.") + ""}</AnEmpty></Panel>;

  const typeCounts = SHIFT_KEYS.map((k) => cur.shiftTypes[k]);
  const columns = [
    { key: "n", label: __extraTr("تحلیلگر"), value: (r) => r.person.name, render: (r) => <span className="an-person">{r.person.name}<small>{r.person.level}</small></span> },
    { key: "s", label: __analyticsTr("شیفت"), kind: "count", value: (r) => r.cur.shifts },
    { key: "off", label: __analyticsTr("تعطیل شیفت"), kind: "count", value: (r) => r.cur.offDays },
    { key: "leave", label: __analyticsTr("مرخصی"), kind: "count", value: (r) => r.cur.leaveDays },
    ...SHIFT_KEYS.map((k) => ({ key: k, label: __analyticsTr(SHIFT_FA[k]), kind: "count", value: (r) => r.cur.shiftTypes[k] })),
    { key: "h", label: __extraTr("ساعت شیفت"), kind: "count", value: (r) => r.cur.shiftHours },
    { key: "c", label: __extraTr("بسته‌شدن لاگ"), kind: "rate", value: (r) => r.cur.closureRate },
    { key: "m", label: __extraTr("جامانده"), kind: "count", value: (r) => r.cur.missed },
    { key: "r", label: __extraTr("روتین"), kind: "rate", value: (r) => r.cur.routineRate },
    { key: "i", label: "IOC", kind: "count", value: (r) => r.cur.iocs },
    { key: "t", label: __analyticsTr("تیکت"), kind: "count", value: (r) => r.cur.tickets },
    { key: "rp", label: __analyticsTr("گزارش ترافیک"), kind: "count", value: (r) => r.cur.reports },
    { key: "is", label: "Issue", kind: "count", value: (r) => r.cur.issues },
  ];

  return (
    <>
      <MetricGrid label={__analyticsTr("شاخص‌های شیفت SOC")}>
        <Kpi label={__analyticsTr("شیفت‌ها")} icon="cal" value={fmtInt(cur.shifts)} foot={SHIFT_KEYS.map((k, i) => `${__analyticsTr(SHIFT_FA[k])} ${fmtInt(typeCounts[i])}`).join(" · ")} delta={prev && <Delta now={cur.shifts} before={prev.shifts} label={short} />} />
        <Kpi label={__analyticsTr("تعطیل شیفت")} icon="cal" value={fmtInt(cur.offDays)} foot={__analyticsTr("بدون شیفت‌لاگ؛ جزو شیفت کاری نیست")} />
        <Kpi label={__analyticsTr("مرخصی")} icon="cal" value={fmtInt(cur.leaveDays)} foot={__analyticsTr("بدون شیفت‌لاگ؛ جزو شیفت کاری نیست")} />
        <Kpi label={__analyticsTr("بسته‌شدن شیفت‌لاگ")} icon="shift" value={fmtPct(cur.closureRate)} tone={cur.missed ? "alert" : undefined} delta={prev && cur.closureRate !== null && <Delta now={cur.closureRate} before={prev.closureRate} kind="rate" label={short} />} foot={cur.missed ? `${fmtInt(cur.missed)} ${a.locale === "fa" ? "شیفت‌لاگ جامانده" : "missed shift logs"}` : (a.locale === "fa" ? "بدون شیفت‌لاگ جامانده" : "No missed shift logs")} />
        <Kpi label={__analyticsTr("انجام روتین")} icon="checkCircle" value={fmtPct(cur.routineRate)} delta={prev && cur.routineRate !== null && <Delta now={cur.routineRate} before={prev.routineRate} kind="rate" label={short} />} spark={<Sparkline values={m.series.map((x) => x.routineRate)} />} />
        <Kpi label={__analyticsTr("IOC ثبت‌شده")} icon="shield" value={fmtInt(cur.iocs)} delta={prev && <Delta now={cur.iocs} before={prev.iocs} label={short} />} foot={`${fmtNum(cur.iocPerShift)} ${a.locale === "fa" ? "به ازای هر شیفت‌لاگ" : "per shift log"}`} spark={<Sparkline values={m.series.map((x) => x.iocs)} />} />
        <Kpi label={__analyticsTr("تیکت (تعداد)")} icon="inbox" value={fmtInt(cur.tickets)} delta={prev && <Delta now={cur.tickets} before={prev.tickets} label={short} />} foot={`${fmtNum(cur.ticketsPerShift)} ${a.locale === "fa" ? "به ازای هر شیفت‌لاگ" : "per shift log"}`} spark={<Sparkline values={m.series.map((x) => x.tickets)} />} />
        <Kpi label={__analyticsTr("گزارش ترافیک و Issue")} icon="report" value={fmtInt(cur.reports)} unit={a.locale === "fa" ? "گزارش" : "reports"} foot={`${fmtInt(cur.issues)} ${a.locale === "fa" ? "Issue گزارش‌شده" : "issues reported"}`} />
      </MetricGrid>

      {m.shiftAlert && <Panel title={__analyticsTr("شیفت‌لاگ‌های کامل‌نشده")} meta={__analyticsTr("۳ روز گذشته")}><AlertCard alert={m.shiftAlert} open /></Panel>}

      <ChartPanel
        title={__analyticsTr("انجام هر فعالیت روتین به تفکیک تحلیلگر")}
        question="کدام فعالیت، نزد چه کسی، مدام جا می‌ماند؟ تیره‌تر یعنی درصد انجام بیشتر؛ خانه خالی یعنی آن فعالیت در شیفت‌های او نبوده."
        build={heat}
        height={90 + 30 * m.rows.length}
        onChartClick={(e) => m.rows[e.value?.[1]] && setPerson(m.rows[e.value[1]].id)}
        table={{ columns: [{ key: "n", label: __extraTr("تحلیلگر"), value: (r) => r.person.name }, ...activities.map((l, i) => ({ key: `a${i}`, label: l, kind: "rate", value: (r) => r.cur.activityRates[i] }))], rows: m.rows }}
        fileName="routine-by-analyst"
        testId="soc-heatmap"
      />

      <div className="an-row">
        <ChartPanel title={__analyticsTr("درصد انجام هر فعالیت (کل SOC)")} question="کدام فعالیت روتین بیشتر جا می‌ماند؟" build={acts} height={300}
          table={{ columns: [{ key: "l", label: __extraTr("فعالیت"), value: (r) => r.label }, { key: "v", label: __extraTr("درصد انجام"), kind: "rate", value: (r) => r.v }, { key: "n", label: __analyticsTr("شیفت"), kind: "count", value: (r) => r.n }], rows: activities.map((label, i) => ({ id: i, label, v: cur.activityRates[i], n: cur.activityN[i] })) }}
          fileName="activity-completion" />
        <ChartPanel title={__analyticsTr("توزیع نوع شیفت هر تحلیلگر")} question="شیفت‌های شب و تا ساعت ۲۰ منصفانه تقسیم شده‌اند؟" build={types} height={70 + 30 * m.rows.length}
          table={{ columns: [{ key: "n", label: __extraTr("تحلیلگر"), value: (r) => r.person.name }, ...SHIFT_KEYS.map((k) => ({ key: k, label: __analyticsTr(SHIFT_FA[k]), kind: "count", value: (r) => r.cur.shiftTypes[k] }))], rows: m.rows }}
          fileName="shift-types" />
      </div>

      <div className="an-row">
        <ChartPanel title={__analyticsTr("IOC ثبت‌شده در هر روز")} build={iocBuild} height={220} fileName="ioc-daily"
          table={{ columns: [{ key: "d", label: __extraTr("روز"), value: (r) => localDate(r[0], a.locale) }, { key: "v", label: "IOC", kind: "count", value: (r) => r[1] }], rows: m.iocs }} />
        <ChartPanel title={__analyticsTr("تیکت ثبت‌شده در هر روز (تعداد)")} build={ticketBuild} height={220} fileName="tickets-daily"
          table={{ columns: [{ key: "d", label: __extraTr("روز"), value: (r) => localDate(r[0], a.locale) }, { key: "v", label: __analyticsTr("تیکت"), kind: "count", value: (r) => r[1] }], rows: m.tickets }} />
      </div>

      <Panel title={__analyticsTr("تحلیلگران")} meta={__analyticsTr("الفبایی · برای خلاصه روی ردیف کلیک کنید")}>
        <DataTable columns={columns} rows={m.rows} onRowClick={(r) => setPerson(r.id)} caption="آمار شیفت تحلیلگران" testId="soc-table" />
      </Panel>
      <MonthlyShiftReviews analytics={a} analysts={m.rows.map((r) => r.person)} />
      {person && <PersonDrawer id={person} onClose={() => setPerson(null)} />}
    </>
  );
}
