"use client";

import { useMemo } from "react";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { useI18n } from "@/components/I18nProvider";
import { DataTable } from "@/components/analytics/ui";
import { Panel } from "@/components/ui/layout";
import { expertCompletedPerCapita, peopleRows, teamRows } from "@/lib/analytics/metrics";

/** Everyone is visible immediately; column sorting is optional. */
export default function AutomaticComparison() {
  const a = useAnalytics(), { locale, team: teamText, province: provinceText } = useI18n(), fa = locale === "fa";
  const data = useMemo(() => ({ teams: teamRows(a.view, a.range, a.cmp), people: peopleRows(a.view, a.range, a.cmp) }), [a.view, a.range, a.cmp]);
  const teamColumns = [
    { key:"team", label:fa ? "تیم" : "Team", value:(r) => teamText(r.group) },
    { key:"people", label:fa ? "کارشناسان" : "People", kind:"count", value:(r) => r.headcount },
    { key:"done", label:fa ? "تسک تکمیل‌شده" : "Completed tasks", kind:"count", value:(r) => r.cur.completed },
    { key:"per", label:fa ? "سرانه کارشناسان" : "Completed per expert", kind:"avg", value:(r) => expertCompletedPerCapita(a.view,r.people,a.range) },
    { key:"hours", label:fa ? "ساعت" : "Hours", kind:"avg", value:(r) => r.cur.hours },
    { key:"open", label:fa ? "کار باز" : "Open work", kind:"count", value:(r) => r.open.open },
    { key:"analyzed", label:fa ? "تیکت تحلیل‌شده L2" : "L2 analyzed tickets", kind:"count", value:(r) => r.cur.analyzed },
    { key:"fp", label:"FP", kind:"count", value:(r) => r.cur.falsePositive },
    { key:"tp", label:"TP", kind:"count", value:(r) => r.cur.truePositive },
  ];
  const personColumns = [
    { key:"person", label:fa ? "کارشناس" : "Person", value:(r) => r.person.name, render:(r) => <span className="an-person">{r.person.name}<small>{[teamText(r.person.group), r.person.level, r.person.province ? provinceText(r.person.province) : null].filter(Boolean).join(" · ")}</small></span> },
    { key:"done", label:fa ? "تسک تکمیل‌شده" : "Completed tasks", kind:"count", value:(r) => r.cur.completed },
    { key:"hours", label:fa ? "ساعت" : "Hours", kind:"avg", value:(r) => r.cur.hours },
    { key:"open", label:fa ? "کار باز" : "Open work", kind:"count", value:(r) => r.open.open },
    { key:"shifts", label:fa ? "شیفت" : "Shifts", kind:"count", value:(r) => r.person.shift ? r.cur.shifts : null },
    { key:"analyzed", label:fa ? "تیکت تحلیل‌شده L2" : "L2 analyzed tickets", kind:"count", value:(r) => r.person.level === "L2" || r.cur.analyzed ? r.cur.analyzed : null },
    { key:"fp", label:"FP", kind:"count", value:(r) => r.person.level === "L2" || r.cur.analyzed ? r.cur.falsePositive : null },
    { key:"tp", label:"TP", kind:"count", value:(r) => r.person.level === "L2" || r.cur.analyzed ? r.cur.truePositive : null },
    { key:"rate", label:fa ? "نرخ FP" : "FP rate", kind:"rate", value:(r) => r.cur.fpRate },
  ];
  return <>
    <Panel title={fa ? "مقایسه تیم‌ها" : "Team comparison"} meta={fa ? "جمع تیم شامل کار مدیر است؛ سرانه فقط با کار و تعداد کارشناسان محاسبه می‌شود." : "Team totals include the manager; the per-expert figure uses experts' work and headcount only."}>
      <DataTable columns={teamColumns} rows={data.teams} rowKey={(r) => r.key} rowHref={(r) => a.href("/analytics/teams", { team:r.key })} caption={fa ? "مقایسه تیم‌ها" : "Team comparison"} testId="automatic-team-comparison" />
    </Panel>
    <Panel title={fa ? "مقایسه کارشناسان" : "People comparison"} meta={fa ? "همه کارشناسان به‌ترتیب الفبا؛ برای دیدن جزئیات نام را انتخاب کنید." : "All analysts, alphabetically; select a name for details."}>
      <div className="an-note" role="note">{fa ? "نوع کار و سطح افراد متفاوت است؛ تعداد تسک یا نرخ FP به‌تنهایی معیار کیفیت نیست. نرخ FP فقط از تیکت‌های تحلیل‌شده ثبت‌شده محاسبه می‌شود." : "Work and levels differ; task counts or FP rate alone do not measure quality. FP rate covers registered analyzed tickets only."}</div>
      <DataTable columns={personColumns} rows={data.people} rowKey={(r) => r.person.id} rowHref={(r) => a.href(`/analytics/people/${encodeURIComponent(r.person.id)}`)} maxHeight={480} caption={fa ? "مقایسه کارشناسان" : "People comparison"} testId="automatic-people-comparison" />
    </Panel>
  </>;
}
