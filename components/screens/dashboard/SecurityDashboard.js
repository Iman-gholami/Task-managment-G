"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import useGreeting from "@/components/useGreeting";
import PeriodSelector from "@/components/PeriodSelector";
import Icon from "@/components/ui/Icon";
import { PageHeader, Panel } from "@/components/ui/layout";
import { Delta, Metric, MetricGrid } from "@/components/ui/Metric";
import { PeopleTable } from "@/components/screens/Team";
import TeamComparison from "@/components/screens/dashboard/TeamComparison";
import { AttentionList, allScope, countReason, useAttention } from "@/components/screens/dashboard/Attention";
import { fmtRange, plural } from "@/lib/format";
import { periodQuery, previousPeriod } from "@/lib/period";

const total = (teams, key) => teams.reduce((s, t) => s + t[key], 0);

/** Department-wide view for the Security Manager: output, risk, what needs a decision, who is loaded. */
export default function SecurityDashboard() {
  const { members, me } = useApp();
  const greeting = useGreeting(me.name);
  const [period, setPeriod] = useState("this");
  const query = periodQuery(period);
  const { data, loading, error, reload } = useFetch(`/api/performance?${query}`);
  // Same figures for the period before, so completed work and hours can be compared honestly.
  const prev = previousPeriod(period);
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
        title="Security Department"
        meta={[data ? fmtRange(data.period.from, data.period.to) : null, data ? plural(teams.length, "team") : null, plural(members.length, "person", "people")]}
        actions={
          <>
            <PeriodSelector value={period} onChange={setPeriod} />
            <a className="btn btn-secondary" href={`/api/reports/team?${query}&format=xlsx`} download data-tooltip="Download the Team Monthly Report for this period (.xlsx)">
              <Icon name="download" />Export
            </a>
          </>
        }
      />

      <MetricGrid label="Department summary">
        <Metric
          label="Work completed" icon="checkCircle"
          hint="Tasks approved in this period, by completion date."
          value={total(teams, "completed")}
          loading={busy}
          foot={prevTeams ? <Delta now={total(teams, "completed")} before={total(prevTeams, "completed")} label={prev.label} /> : "Approved tasks"}
        />
        <Metric
          label="Task hours logged" icon="clock"
          hint="Actual hours recorded on tasks completed in this period."
          value={Math.round(total(teams, "hours"))}
          unit="h"
          loading={busy}
          foot={prevTeams ? <Delta now={Math.round(total(teams, "hours"))} before={Math.round(total(prevTeams, "hours"))} label={prev.label} goodWhen={null} /> : "On completed tasks"}
        />
        <Metric
          label="Active tasks" icon="tasks"
          value={total(teams, "active")}
          loading={busy}
          href="/tasks/team"
          foot={blocked ? <span className="overdue">{blocked} blocked</span> : "None blocked"}
        />
        <Metric
          label="Overdue" icon="flag"
          value={overdue}
          tone={overdue ? "alert" : undefined}
          loading={busy}
          foot={overdue ? `Across ${plural(overdueTeams, "team")}` : "Nothing past its deadline"}
        />
        <Metric
          label="Awaiting review" icon="review"
          value={reviews}
          href="/tasks/team?tab=review"
          foot={reviews ? "Waiting for approval" : "No reviews waiting"}
        />
      </MetricGrid>

      <div className="stack-lg">
        <AttentionList items={attention} />
        <TeamComparison teams={teams} loading={busy} error={error} onRetry={reload} periodLabel={data ? `${fmtRange(data.period.from, data.period.to)} · trend: last 6 months` : null} />
        <Panel
          title="People"
          meta="Alphabetical · not a ranking"
          actions={<Link className="btn btn-ghost btn-sm" href="/performance/overview">Performance overview<Icon name="arrowRight" /></Link>}
        >
          <PeopleTable list={members.filter((p) => p.role !== "security_manager")} />
        </Panel>
      </div>
    </div>
  );
}
