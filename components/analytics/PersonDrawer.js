"use client";

import { useI18n as useExtraI18n } from "@/components/I18nProvider";

import useAnalyticsFormat from "@/components/analytics/useAnalyticsFormat";

import { useI18n as useAnalyticsI18n } from "@/components/I18nProvider";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import Chart from "@/components/analytics/Chart";
import { lineOption } from "@/components/analytics/chartOptions";
import { personModel, StatusFa } from "@/components/analytics/model";
import { Delta, Drawer, Stat } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { localDate } from "@/lib/analytics/calendar";
import { fmtDays, fmtInt, fmtNum, fmtPct } from "@/lib/analytics/format";
import { ROLE_FA, groupFa } from "@/lib/analytics/labels";

const med = (m, k, f, locale) => (m && m[k] !== null && m[k] !== undefined ? `${locale === "fa" ? "میانه تیم" : "Team median"}: ${f(m[k])}` : null);

/** Quick look at one expert: key figures against the comparison period and the team median. */
export default function PersonDrawer({ id, onClose }) {
  const { t: __extraTr } = useExtraI18n();
  const { fmtInt, fmtNum, fmtPct, fmtDays } = useAnalyticsFormat();
  const { t: __analyticsTr, team: teamText, role: roleText } = useAnalyticsI18n();
  const a = useAnalytics();
  const m = useMemo(() => personModel(a.view, id, a.range, a.cmp, a.gran, a.locale), [a.view, id, a.range, a.cmp, a.gran, a.locale]);
  const build = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), bars: true,
    series: [{ name: __extraTr("تکمیل‌شده"), data: m.bs.map((x) => x.completed) }],
    prev: a.cmp ? { name: __extraTr("دوره مقایسه"), data: m.pbs.map((x) => x.completed), labels: m.pb.map((x) => x.label) } : null,
  }), [m, a.cmp]);
  if (!m) return null;
  const { p, cur, prev, medians, open } = m;
  const short = a.cmp?.short;
  return (
    <Drawer
      title={p.name}
      subtitle={[teamText(p.group), p.level, roleText(p.role), p.active ? null : __analyticsTr("غیرفعال")].filter(Boolean).join(" · ")}
      onClose={onClose}
      label={a.locale === "fa" ? `خلاصه ${p.name}` : `${p.name}'s summary`}
      width={500}
      footer={
        <>
          <Link className="btn btn-primary" href={a.href(`/analytics/people/${encodeURIComponent(p.id)}`)}>{"" + __analyticsTr("پروفایل کامل") + ""}<Icon name="left" /></Link>
          <a className="btn btn-secondary" href={a.exportUrl("person", { id: p.id })} download><Icon name="sheet" />Excel</a>
        </>
      }
    >
      <div className="an-stats">
        <Stat label={__analyticsTr("تسک تکمیل‌شده")} value={fmtInt(cur.completed)} sub={prev ? <Delta now={cur.completed} before={prev.completed} label={short} /> : med(medians, "completed", fmtNum, a.locale)} />
        <Stat label={__analyticsTr("حجم کار وزن‌دار")} value={fmtInt(cur.units)} sub={med(medians, "units", fmtNum, a.locale)} />
        <Stat label={__analyticsTr("ساعت ثبت‌شده")} value={fmtNum(cur.hours, 0)} sub={med(medians, "hours", (v) => fmtNum(v, 0), a.locale)} />
        <Stat label={__analyticsTr("تحویل به‌موقع")} value={fmtPct(cur.onTimeRate)} sub={cur.onTimeRate === null ? `${fmtInt(cur.onTimeN)} ${a.locale === "fa" ? "تسک دارای ددلاین" : "tasks with deadlines"}` : med(medians, "onTimeRate", fmtPct, a.locale)} />
        <Stat label={__analyticsTr("میانه زمان انجام")} value={fmtDays(cur.cycleMedian)} sub={med(medians, "cycleMedian", fmtDays, a.locale)} />
        <Stat label={__analyticsTr("صف باز (اکنون)")} value={fmtInt(open.open)} sub={a.locale === "fa" ? `${fmtInt(open.overdue)} معوق · ${fmtInt(open.blocked)} مسدود` : `${fmtInt(open.overdue)} overdue · ${fmtInt(open.blocked)} blocked`} />
        {p.shift && (
          <>
            <Stat label={__analyticsTr("شیفت")} value={fmtInt(cur.shifts)} sub={`${__extraTr("بسته‌شدن لاگ")} ${fmtPct(cur.closureRate)}`} />
            <Stat label={__analyticsTr("انجام روتین")} value={fmtPct(cur.routineRate)} sub={`IOC ${fmtInt(cur.iocs)} · ${__analyticsTr("تیکت")} ${fmtInt(cur.tickets)}`} />
          </>
        )}
      </div>
      <div>
        <p className="an-subhead">{"" + __analyticsTr("تسک‌های تکمیل‌شده در هر بازه") + ""}</p>
        <Chart build={build} height={170} label={a.locale === "fa" ? `روند تسک‌های تکمیل‌شده ${p.name}` : `${p.name}'s completed task trend`} />
      </div>
      {m.openTasks.length > 0 && (
        <div>
          <p className="an-subhead">{a.locale === "fa" ? "کار باز" : "Open work"} ({fmtInt(m.openTasks.length)})</p>
          <ul className="an-mini-list">
            {m.openTasks.slice(0, 6).map((t) => (
              <li key={t.id}>
                <span className="truncate">{t.title}</span>
                <StatusFa s={t.status} />
                {t.due && <span className={t.due < a.today ? "overdue" : "muted"}>{localDate(t.due, a.locale, { year: false })}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
