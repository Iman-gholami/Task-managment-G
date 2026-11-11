"use client";

import { useI18n as useUiI18n } from "@/components/I18nProvider";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import useGreeting from "@/components/useGreeting";
import PeriodSelector from "@/components/PeriodSelector";
import Icon from "@/components/ui/Icon";
import { ManagerReturnedQueue } from "@/components/screens/dashboard/ReturnedShifts";
import { PageHeader, Panel } from "@/components/ui/layout";
import { Delta, Metric, MetricGrid } from "@/components/ui/Metric";
import { PeopleTable } from "@/components/screens/Team";
import TeamComparison from "@/components/screens/dashboard/TeamComparison";
import { AttentionList, allScope, countReason, useAttention } from "@/components/screens/dashboard/Attention";
import { fmtRange, plural } from "@/lib/format";
import { periodQuery, previousPeriod } from "@/lib/period";
import { dashboardMonth, dashboardRange } from "@/lib/i18n/presentation";

const total = (teams, key) => teams.reduce((s, t) => s + t[key], 0);

/** Department-wide view for the Security Manager: output, risk, what needs a decision, who is loaded. */
export default function SecurityDashboard() {
  const { t: __uiTr, locale, number } = useUiI18n();
  const { members, me } = useApp();
  const greeting = useGreeting(me.name);
  const [period, setPeriod] = useState("this");
  const query = periodQuery(period);
  const { data, loading, error, reload } = useFetch(`/api/performance?${query}`);
  // Same figures for the period before, so completed work and hours can be compared honestly.
  const prev = previousPeriod(period);
  const previousLabel = !prev || locale === "en" ? prev?.label : period === "quarter" ? "در مقایسه با فصل قبل" : period === "custom" ? "در مقایسه با دوره قبل" : `در مقایسه با ${dashboardMonth(new URLSearchParams(prev.query).get("from"), locale)}`;
  const before = useFetch(prev ? `/api/performance?${prev.query}` : null);
  const attention = useAttention(allScope);

  const teams = data?.teams ?? [];
  const prevTeams = before.data?.teams;
  const busy = loading && !data;
  const overdue = total(teams, "overdue");
  const overdueTeams = teams.filter((t) => t.overdue > 0).length;
  const blocked = countReason(attention, "blocked");
  const reviews = countReason(attention, "review");

  return (
    <div className="page">
      <PageHeader
        eyebrow={greeting}
        title={__uiTr("Security Department")}
        meta={[data ? dashboardRange(data.period.from, data.period.to, locale) : null, data ? locale === "fa" ? `${number(teams.length)} تیم` : plural(teams.length, "team") : null, locale === "fa" ? `${number(members.length)} نفر` : plural(members.length, "person", "people")]}
        actions={
          <>
            <PeriodSelector value={period} onChange={setPeriod} />
            <a className="btn btn-secondary" href={`/api/reports/team?${query}&format=xlsx`} download data-tooltip={__uiTr("Download the Team Monthly Report for this period (.xlsx)")}>
              <Icon name="download" />{"" + __uiTr("Export") + ""}</a>
          </>
        }
      />

      <MetricGrid label={__uiTr("Department summary")}>
        <Metric
          label={__uiTr("Work completed")} icon="checkCircle"
          hint={__uiTr("Tasks approved in this period, by completion date.")}
          value={total(teams, "completed")}
          loading={busy}
          foot={prevTeams ? <Delta now={total(teams, "completed")} before={total(prevTeams, "completed")} label={previousLabel} /> : __uiTr("Approved tasks")}
        />
        <Metric
          label={__uiTr("Task hours logged")} icon="clock"
          hint={__uiTr("Actual hours recorded on tasks completed in this period.")}
          value={Math.round(total(teams, "hours"))}
          unit={locale === "fa" ? "ساعت" : "h"}
          loading={busy}
          foot={prevTeams ? <Delta now={Math.round(total(teams, "hours"))} before={Math.round(total(prevTeams, "hours"))} label={previousLabel} goodWhen={null} /> : __uiTr("On completed tasks")}
        />
        <Metric
          label={__uiTr("Active tasks")} icon="tasks"
          value={total(teams, "active")}
          loading={busy}
          href="/tasks/team"
          foot={blocked ? <span className="overdue">{number(blocked)}{" " + __uiTr("blocked") + ""}</span> : __uiTr("None blocked")}
        />
        <Metric
          label={__uiTr("Overdue")} icon="flag"
          value={overdue}
          tone={overdue ? "alert" : undefined}
          loading={busy}
          foot={overdue ? locale === "fa" ? `در ${number(overdueTeams)} تیم` : `Across ${plural(overdueTeams, "team")}` : __uiTr("Nothing past its deadline")}
        />
        <Metric
          label={__uiTr("Awaiting review")} icon="review"
          value={reviews}
          href="/tasks/team?tab=review"
          foot={__uiTr(reviews ? "Waiting for approval" : "No reviews waiting")}
        />
      </MetricGrid>

      <ManagerReturnedQueue />
      <div className="stack-lg">
        <AttentionList items={attention} />
        <TeamComparison teams={teams} loading={busy} error={error} onRetry={reload} periodLabel={data ? `${dashboardRange(data.period.from, data.period.to, locale)} · ${locale === "fa" ? "روند ۶ ماه گذشته" : "trend: last 6 months"}` : null} />
        <Panel
          title={__uiTr("People")}
          meta={__uiTr("Alphabetical · not a ranking")}
          actions={<Link className="btn btn-ghost btn-sm" href="/analytics">{"" + __uiTr("Performance overview") + ""}<Icon name="arrowRight" /></Link>}
        >
          <PeopleTable list={members.filter((p) => p.role !== "security_manager")} />
        </Panel>
      </div>
    </div>
  );
}
