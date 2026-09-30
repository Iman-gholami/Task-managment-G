"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { PageHeader, Panel } from "@/components/ui/layout";
import { Metric, MetricGrid } from "@/components/ui/Metric";
import { Bars } from "@/components/ui/charts";
import { EmptyState } from "@/components/ui/states";
import { Avatar } from "@/components/ui/indicators";
import { AttentionList, countReason, socScope, useAttention } from "@/components/screens/dashboard/Attention";
import { TODAY, isOpen, lastDays, longDate, monthName, plural, weekday } from "@/lib/format";

const FULL_LOAD = 6; // open tasks that count as a full workload (see AppProvider → members.load)

/** SOC Manager: team risk and review queue on the left, who is loaded on the right. */
export default function SocDashboard() {
  const { members, tasks, stats, peopleMap, me, setCreateOpen } = useApp();
  const soc = members.filter((p) => p.team.startsWith("SOC ·") || p.assist?.startsWith("SOC"));
  const socTask = (t) => (peopleMap[t.a]?.team ?? t.team).startsWith("SOC");
  const attention = useAttention(socScope);
  const overdue = countReason(attention, "overdue");
  const reviews = countReason(attention, "review");
  const month = monthName(stats.period.from);
  const days = lastDays(7);
  const active = tasks.filter((t) => isOpen(t) && t.status !== "backlog" && socTask(t)).length;
  const assignedOpen = tasks.filter((t) => t.createdBy === me.id && t.a !== me.id && isOpen(t)).length;

  return (
    <div className="page">
      <PageHeader
        title="SOC overview"
        meta={[`${weekday(TODAY)}, ${longDate(TODAY)}`, plural(soc.length, "person", "people")]}
        actions={
          <>
            <Link className="btn btn-secondary" href="/tasks/assigned">Assigned by me</Link>
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" />Create task<kbd>C</kbd></button>
          </>
        }
      />

      <MetricGrid label="SOC summary">
        <Metric label="Active team tasks" value={active} href="/tasks/team" foot="Excluding backlog" />
        <Metric label="Assigned by me" value={assignedOpen} href="/tasks/assigned" foot="Still open" />
        <Metric label="Overdue" value={overdue} tone={overdue ? "alert" : undefined} foot={overdue ? "Past their deadline" : "Nothing past its deadline"} />
        <Metric label="Awaiting your review" value={reviews} href="/tasks/team?tab=review" foot={reviews ? "Approve or return" : "No reviews waiting"} />
        <Metric
          label={`MISP IOCs · ${month}`}
          value={stats.soc.iocs}
          aside={stats.soc.iocSeries.some(Boolean) && <Bars values={stats.soc.iocSeries} labels={days} name="IOCs per day, last 7 days" />}
          foot="Bars: last 7 days"
        />
        <Metric
          label={`Tickets · ${month}`}
          value={stats.soc.tickets}
          aside={stats.soc.ticketSeries.some(Boolean) && <Bars values={stats.soc.ticketSeries} labels={days} name="Tickets per day, last 7 days" />}
          foot="Bars: last 7 days"
        />
      </MetricGrid>

      <div className="grid-2">
        <AttentionList items={attention} />
        <Panel title="Team workload" meta={`Open tasks per person · ${FULL_LOAD} = full`}>
          {soc.length === 0 ? (
            <EmptyState compact icon="team" title="No SOC members yet" action={<Link className="btn btn-secondary btn-sm" href="/team">Go to Team</Link>}>
              Add analysts to SOC · L1, L2 or L3 on the Team page.
            </EmptyState>
          ) : (
            <div role="list">
              {soc.map((p) => (
                <div key={p.id} className="hbar" role="listitem">
                  <Link href={`/performance/employees/${p.id}`} className="who">
                    <Avatar id={p.id} />
                    <span>{p.name}</span>
                    {p.assist && <span className="badge" data-tooltip={`Primary team: ${p.team}`}>Assisting</span>}
                  </Link>
                  <span className="track" role="img" aria-label={`${p.open} open of ${FULL_LOAD}`}>
                    <span className={p.load > 90 ? "full" : ""} style={{ width: `${p.load}%` }} />
                  </span>
                  <span className="num sec" style={{ textAlign: "right" }}>{p.open}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
