"use client";

import { useI18n as useExtraI18n } from "@/components/I18nProvider";

import useAnalyticsFormat from "@/components/analytics/useAnalyticsFormat";

import { useI18n as useAnalyticsI18n } from "@/components/I18nProvider";

import { useCallback, useEffect, useMemo, useState } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { InsightList, StatusBanner } from "@/components/analytics/blocks";
import Chart from "@/components/analytics/Chart";
import { lineOption } from "@/components/analytics/chartOptions";
import { DataTable, Delta, Kpi } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { MetricGrid } from "@/components/ui/Metric";
import { buildAlerts, LEVELS, overallStatus } from "@/lib/analytics/alerts";
import { faDate, faDigits, faRange } from "@/lib/analytics/calendar";
import { fmtInt, fmtNum, fmtPct } from "@/lib/analytics/format";
import { buildInsights } from "@/lib/analytics/insights";
import { GROUP_BY_KEY, ROLE_FA, groupFa } from "@/lib/analytics/labels";
import { bucketStats, idsOf, openStats, peopleRows, stats, teamRows } from "@/lib/analytics/metrics";
import { buckets } from "@/lib/analytics/periods";

const SCOPE_FA = { department: "کل واحد امنیت", soc: "تیم SOC" };

/** Next steps derived from the alerts (rule-based; the manager edits or adds in the notes). */
function suggestedActions(alerts) {
  const n = (x) => faDigits(x);
  const names = (a) => a.items.slice(0, 3).map((i) => i.label).join("، ");
  return alerts.map((a) => {
    if (a.id === "overdue-high") return `پیگیری ${n(a.count)} تسک معوق با اولویت بالا: ددلاین واقع‌بینانه یا بازتوزیع.`;
    if (a.id === "overdue-old") return `بازبینی ${n(a.count)} تسک با تأخیر طولانی: ادامه، بازتوزیع یا لغو.`;
    if (a.id === "missed-logs") return `پیگیری ${n(a.count)} شیفت‌لاگ کامل‌نشده با تحلیلگران مربوط.`;
    if (a.id === "blocked-long") return `رفع مانع ${n(a.count)} تسک مسدود (تصمیم یا منبع لازم دارند).`;
    if (a.id === "review-waiting") return `انجام بازبینی ${n(a.count)} تسک منتظر تأیید.`;
    if (a.id.startsWith("growth-")) return `${a.title}: اولویت‌بندی ورودی کار یا تعویق تسک‌های کم‌اهمیت.`;
    if (a.id.startsWith("load-")) return `بازتوزیع بخشی از کار باز ${names(a)}.`;
    if (a.id === "overdue") return `پیگیری ${n(a.count)} تسک معوق دیگر.`;
    if (a.id === "idle") return `واگذاری کار جدید به ${n(a.count)} کارشناس با ظرفیت آزاد.`;
    if (a.id === "ioc-drop") return "بررسی علت کاهش IOC ثبت‌شده در شیفت‌ها.";
    return null;
  }).filter(Boolean).slice(0, 6);
}

export default function Report() {
  const { t: __analyticsTr } = useAnalyticsI18n();
  return (
    <AnalyticsFrame title={__analyticsTr("گزارش مدیریتی")} className="an-report-page">
      <ReportBody />
    </AnalyticsFrame>
  );
}

function ReportBody() {
  const { t: __extraTr } = useExtraI18n();
  const { fmtInt, fmtNum, fmtPct } = useAnalyticsFormat();
  const { t: __analyticsTr } = useAnalyticsI18n();
  const a = useAnalytics();
  const { view, range, cmp, gran, filters, params, setParam } = a;
  const full = params.get("full") === "1";
  const noteKey = `an.notes:${range.from}:${range.end}:${filters.team}:${a.demo ? "demo" : "real"}`;
  const [notes, setNotes] = useState("");
  useEffect(() => {
    try { setNotes(localStorage.getItem(noteKey) ?? ""); } catch { setNotes(""); }
  }, [noteKey]);
  const saveNotes = (v) => {
    setNotes(v);
    try { localStorage.setItem(noteKey, v); } catch {}
  };

  const m = useMemo(() => {
    const b = buckets(range.from, range.end, gran, a.locale);
    const pb = cmp ? buckets(cmp.from, cmp.to, gran, a.locale) : [];
    const alerts = buildAlerts(view, { range, cmp, locale: a.locale });
    const shiftIds = idsOf(view.people.filter((p) => p.shift));
    return {
      b, pb, alerts,
      status: overallStatus(alerts),
      insights: buildInsights(view, { range, cmp, locale: a.locale }),
      cur: stats(view, null, range), prev: cmp ? stats(view, null, cmp) : null,
      bs: bucketStats(view, null, b), pbs: bucketStats(view, null, pb),
      open: openStats(view, null),
      teams: teamRows(view, range, cmp),
      soc: shiftIds.length ? stats(view, shiftIds, range) : null,
      socPrev: shiftIds.length && cmp ? stats(view, shiftIds, cmp) : null,
      people: full ? peopleRows(view, range, cmp) : [],
    };
  }, [view, range, cmp, gran, full]);
  const flow = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label),
    series: [{ name: __extraTr("تکمیل‌شده"), data: m.bs.map((x) => x.completed), color: t["cat-1"] }, { name: __extraTr("ایجادشده"), data: m.bs.map((x) => x.created), color: t["cat-2"] }],
    prev: cmp ? { name: __extraTr("تکمیل‌شده در دوره مقایسه"), data: m.pbs.map((x) => x.completed), labels: m.pb.map((x) => x.label) } : null,
  }), [m, cmp]);
  const { cur, prev, open, soc, socPrev } = m;
  const short = cmp?.short;
  const actions = suggestedActions(m.alerts);
  const scope = filters.team ? `تیم ${GROUP_BY_KEY[filters.team].fa}` : SCOPE_FA[view.scope?.kind] ?? "";

  return (
    <>
      <div className="an-report-tools an-no-print">
        <label className="toggle-label"><input type="checkbox" className="switch" checked={full} onChange={(e) => setParam("full", e.target.checked ? "1" : "")} />{"" + __analyticsTr("گزارش کامل (همراه جدول کارشناسان و SOC)") + ""}</label>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => window.print()} data-testid="print-report"><Icon name="print" />{"" + __analyticsTr("چاپ یا ذخیره PDF") + ""}</button>
      </div>

      <article className="an-report" data-testid="report">
        <header className="an-report-head">
          <div>
            <span className="muted small">{"" + __analyticsTr("Sentinel Ops · واحد امنیت") + ""}</span>
            <h2>{"" + __analyticsTr("گزارش مدیریتی") + " "}{range.label}</h2>
            <p className="muted">{scope}{a.demo ? " · داده نمایشی (ساختگی)" : ""}</p>
          </div>
          <dl>
            <dt>{"" + __analyticsTr("بازه") + ""}</dt><dd>{faRange(range.from, range.end)}</dd>
            <dt>{"" + __analyticsTr("مقایسه با") + ""}</dt><dd>{cmp ? `${cmp.label} (${faRange(cmp.from, cmp.to)})` : "—"}</dd>
            <dt>{"" + __analyticsTr("تاریخ تهیه") + ""}</dt><dd>{faDate(a.today)}</dd>
            <dt>{"" + __analyticsTr("تهیه‌کننده") + ""}</dt><dd>{a.me.name}</dd>
          </dl>
        </header>

        <StatusBanner status={m.status} compact />

        <MetricGrid label={__analyticsTr("شاخص‌های اصلی")}>
          <Kpi label={__analyticsTr("تسک‌های تکمیل‌شده")} value={fmtInt(cur.completed)} delta={prev && <Delta now={cur.completed} before={prev.completed} label={short} />} />
          <Kpi label={__analyticsTr("حجم کار وزن‌دار")} value={fmtInt(cur.units)} delta={prev && <Delta now={cur.units} before={prev.units} label={short} />} />
          <Kpi label={__analyticsTr("ساعت ثبت‌شده")} value={fmtNum(cur.hours, 0)} unit={__extraTr("ساعت")} delta={prev && <Delta now={cur.hours} before={prev.hours} label={short} />} />
          <Kpi label={__analyticsTr("تحویل به‌موقع")} value={fmtPct(cur.onTimeRate)} delta={prev && cur.onTimeRate !== null && <Delta now={cur.onTimeRate} before={prev.onTimeRate} kind="rate" label={short} />} foot={`از ${faDigits(cur.onTimeN)} تسک دارای ددلاین`} />
          <Kpi label={__analyticsTr("صف کار باز (اکنون)")} value={fmtInt(open.open)} tone={open.overdue ? "alert" : undefined} foot={`${faDigits(open.overdue)} معوق · ${faDigits(open.blocked)} مسدود`} />
          {soc
            ? <Kpi label={__analyticsTr("بسته‌شدن شیفت‌لاگ SOC")} value={fmtPct(soc.closureRate)} delta={socPrev && soc.closureRate !== null && <Delta now={soc.closureRate} before={socPrev.closureRate} kind="rate" label={short} />} foot={`تیکت ${faDigits(soc.tickets)} · IOC ${faDigits(soc.iocs)}`} />
            : <Kpi label={__analyticsTr("تسک‌های ایجادشده")} value={fmtInt(cur.created)} delta={prev && <Delta now={cur.created} before={prev.created} label={short} />} />}
        </MetricGrid>

        <div className="an-row">
          <section>
            <h3>{"" + __analyticsTr("مهم‌ترین بینش‌ها") + ""}</h3>
            <InsightList insights={m.insights} limit={5} />
          </section>
          <section>
            <h3>{"" + __analyticsTr("موارد نیازمند اقدام") + ""}</h3>
            {m.alerts.filter((x) => x.level !== "info").length ? (
              <ul className="an-report-alerts">
                {m.alerts.filter((x) => x.level !== "info").slice(0, 6).map((x) => (
                  <li key={x.id} data-level={x.level}><b>{LEVELS[x.level].fa}</b><span>{x.title}{x.detail ? ` — ${x.detail}` : ""}</span></li>
                ))}
              </ul>
            ) : <p className="muted">{"" + __analyticsTr("موردی برای اقدام فوری نیست.") + ""}</p>}
          </section>
        </div>

        <section>
          <h3>{"" + __analyticsTr("ورودی و خروجی کار") + ""}</h3>
          <Chart build={flow} height={220} label={__analyticsTr("ورودی و خروجی کار")} />
        </section>

        <section>
          <h3>{"" + __analyticsTr("تیم‌ها") + ""}</h3>
          <DataTable dense columns={[
            { key: "t", label: __analyticsTr("تیم"), value: (r) => r.fa, sort: false },
            { key: "n", label: __analyticsTr("کارشناسان"), kind: "count", value: (r) => r.headcount, sort: false },
            { key: "c", label: __extraTr("تکمیل‌شده"), kind: "count", value: (r) => r.cur.completed, sort: false },
            { key: "d", label: __extraTr("تغییر"), value: () => null, sort: false, render: (r) => (r.prev ? <Delta now={r.cur.completed} before={r.prev.completed} /> : "—") },
            { key: "pc", label: __extraTr("سرانه"), kind: "avg", value: (r) => r.pc.completed, sort: false },
            { key: "h", label: __extraTr("ساعت"), kind: "count", value: (r) => r.cur.hours, sort: false },
            { key: "ot", label: __extraTr("به‌موقع"), kind: "rate", value: (r) => r.cur.onTimeRate, sort: false },
            { key: "o", label: __extraTr("صف باز"), kind: "count", value: (r) => r.open.open, sort: false },
            { key: "od", label: __extraTr("معوق"), kind: "count", value: (r) => r.open.overdue, sort: false },
          ]} rows={m.teams} rowKey={(r) => r.key} caption={__analyticsTr("تیم‌ها")} />
        </section>

        {full && (
          <section>
            <h3>{"" + __analyticsTr("کارشناسان") + ""}</h3>
            <DataTable dense columns={[
              { key: "n", label: __extraTr("نام"), value: (r) => r.person.name, render: (r) => <span className="an-person">{r.person.name}<small>{[groupFa(r.person.group), r.person.level, ROLE_FA[r.person.role]].filter(Boolean).join(" · ")}</small></span> },
              { key: "c", label: __extraTr("تکمیل‌شده"), kind: "count", value: (r) => r.cur.completed },
              { key: "u", label: __extraTr("حجم وزن‌دار"), kind: "count", value: (r) => r.cur.units },
              { key: "h", label: __extraTr("ساعت"), kind: "count", value: (r) => r.cur.hours },
              { key: "ot", label: __extraTr("به‌موقع"), kind: "rate", value: (r) => r.cur.onTimeRate },
              { key: "o", label: __extraTr("صف باز"), kind: "count", value: (r) => r.open.open },
              { key: "s", label: __analyticsTr("شیفت"), kind: "count", value: (r) => (r.person.shift ? r.cur.shifts : null) },
              { key: "tk", label: __analyticsTr("تیکت"), kind: "count", value: (r) => (r.person.shift ? r.cur.tickets : null) },
            ]} rows={m.people.map((r) => ({ ...r, id: r.person.id }))} caption={__analyticsTr("کارشناسان")} />
            <p className="muted small">{"" + __analyticsTr("الفبایی؛ آماری و بدون امتیاز یا رتبه.") + ""}</p>
          </section>
        )}

        <div className="an-row">
          <section>
            <h3>{"" + __analyticsTr("اقدام‌های پیشنهادی") + ""}</h3>
            {actions.length ? <ol className="an-actions-list">{actions.map((x) => <li key={x}>{x}</li>)}</ol> : <p className="muted">{"" + __analyticsTr("پیشنهادی از هشدارها به دست نیامد.") + ""}</p>}
          </section>
          <section>
            <h3>{"" + __analyticsTr("یادداشت مدیر") + ""}</h3>
            <textarea className="textarea an-notes an-no-print" value={notes} onChange={(e) => saveNotes(e.target.value)} placeholder={__analyticsTr("جمع‌بندی، تصمیم‌ها و پیگیری‌ها را اینجا بنویسید؛ در نسخه چاپی و PDF می‌آید. (فقط روی همین مرورگر ذخیره می‌شود.)")} aria-label={__analyticsTr("یادداشت مدیر")} data-testid="notes" />
            <p className="an-notes-print an-print-only">{notes || "—"}</p>
          </section>
        </div>
      </article>
    </>
  );
}
