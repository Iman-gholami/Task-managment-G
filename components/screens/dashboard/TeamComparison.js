"use client";

import { useI18n as useUiI18n } from "@/components/I18nProvider";

import { Panel } from "@/components/ui/layout";
import { Bars, CxLegend, Distribution } from "@/components/ui/charts";
import { ErrorState, TableSkeleton } from "@/components/ui/states";
import { lastMonths, TODAY } from "@/lib/format";
import { dashboardMonth } from "@/lib/i18n/presentation";

/**
 * Team comparison: output, load and risk per team for the selected period, plus completed work per
 * month for the last six months. All trend bars share one scale so teams compare directly.
 */
export default function TeamComparison({ teams, loading, error, onRetry, periodLabel }) {
  const { t: __uiTr, locale, team: teamText, number } = useUiI18n();
  const [year, month] = TODAY.split("-").map(Number);
  const months = locale === "fa" ? Array.from({ length: 6 }, (_, i) => {
    const iso = new Date(Date.UTC(year, month - 6 + i, 1)).toISOString().slice(0, 10);
    return `${dashboardMonth(iso, locale)} ${number(Number(iso.slice(0, 4)), { useGrouping: false })}`;
  }) : lastMonths(6);
  const n = (v) => (v ? number(v) : <span className="zero">{number(0)}</span>);
  const max = Math.max(1, ...teams.flatMap((t) => t.trend));
  return (
    <Panel
      title={__uiTr("Team comparison")}
      meta={periodLabel}
      footer={<><CxLegend /><span style={{ marginLeft: "auto" }}>{"" + __uiTr("Monthly bars use one scale across teams · hover for values") + ""}</span></>}
    >
      {loading ? <TableSkeleton rows={3} /> : error ? <ErrorState error={error} title={__uiTr("Couldn't load team figures")} onRetry={onRetry} compact /> : (
        <div className="table-wrap">
          <table className="dt hover">
            <thead>
              <tr>
                <th scope="col">{__uiTr("Team")}</th>
                <th scope="col" className="r">{__uiTr("People")}</th>
                <th scope="col" className="r">{"" + __uiTr("Completed") + ""}</th>
                <th scope="col" className="r">{__uiTr("Hours")}</th>
                <th scope="col" className="r">{"" + __uiTr("Active") + ""}</th>
                <th scope="col" className="r">{__uiTr("Overdue")}</th>
                <th scope="col" style={{ width: "22%" }}>{"" + __uiTr("Complexity of completed work") + ""}</th>
                <th scope="col">{"" + __uiTr("Completed per month") + ""}</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.team}>
                  <td className="title">{teamText(t.team)}</td>
                  <td className="r">{n(t.people)}</td>
                  <td className="r strong">{n(t.completed)}</td>
                  <td className="r">{n(t.hours)}</td>
                  <td className="r">{n(t.active)}</td>
                  <td className="r">{t.overdue ? <span className="overdue">{number(t.overdue)}</span> : <span className="zero">{number(0)}</span>}</td>
                  <td>{t.complexity.some(Boolean) ? <Distribution parts={t.complexity} /> : <span className="muted">{"" + __uiTr("No completed work") + ""}</span>}</td>
                  <td><Bars values={t.trend} labels={months} max={max} name={locale === "fa" ? `${teamText(t.team)}، تسک‌های تکمیل‌شده در هر ماه` : `${teamText(t.team)}, completed tasks per month`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
