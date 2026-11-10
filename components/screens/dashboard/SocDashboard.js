"use client";

import { useI18n as useUiI18n } from "@/components/I18nProvider";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import useGreeting from "@/components/useGreeting";
import Icon from "@/components/ui/Icon";
import { ManagerReturnedQueue } from "@/components/screens/dashboard/ReturnedShifts";
import { PageHeader, Panel } from "@/components/ui/layout";
import { Metric, MetricGrid } from "@/components/ui/Metric";
import { Bars } from "@/components/ui/charts";
import { EmptyState } from "@/components/ui/states";
import { Avatar } from "@/components/ui/indicators";
import { AttentionList, countReason, socScope, useAttention } from "@/components/screens/dashboard/Attention";
import { TODAY, isOpen, lastDays, longDate, monthName, plural, weekday } from "@/lib/format";
import { dashboardDay, dashboardMonth } from "@/lib/i18n/presentation";

const FULL_LOAD = 6; // open tasks that count as a full workload (see AppProvider → members.load)

/** SOC Manager: team risk and review queue on the left, who is loaded on the right. */
export default function SocDashboard() {
  const { t: __uiTr, locale, team: teamText, number } = useUiI18n();
  const { members, tasks, stats, peopleMap, me, setCreateOpen } = useApp();
  const greeting = useGreeting(me.name);
  const soc = members.filter((p) => p.team.startsWith("SOC ·") || p.assist?.startsWith("SOC"));
  const socTask = (t) => (peopleMap[t.a]?.team ?? t.team).startsWith("SOC");
  const attention = useAttention(socScope);
  const overdue = countReason(attention, "overdue");
  const reviews = countReason(attention, "review");
  const month = dashboardMonth(stats.period.from, locale);
  const days = locale === "fa" ? Array.from({ length: 7 }, (_, i) => dashboardDay(new Date(Date.parse(`${TODAY}T00:00:00Z`) - (6 - i) * 86400000).toISOString().slice(0, 10), locale)) : lastDays(7);
  const active = tasks.filter((t) => isOpen(t) && t.status !== "backlog" && socTask(t)).length;
  const assignedOpen = tasks.filter((t) => t.createdBy === me.id && t.a !== me.id && isOpen(t)).length;

  return (
    <div className="page">
      <PageHeader
        eyebrow={greeting}
        title={__uiTr("SOC overview")}
        meta={[dashboardDay(TODAY, locale), locale === "fa" ? `${number(soc.length)} نفر` : plural(soc.length, "person", "people")]}
        actions={
          <>
            <Link className="btn btn-secondary" href="/tasks/assigned">{__uiTr("Assigned by me")}</Link>
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" />{"" + __uiTr("Create task") + ""}<kbd>C</kbd></button>
          </>
        }
      />

      <MetricGrid label={__uiTr("SOC summary")}>
        <Metric label={__uiTr("Active team tasks")} icon="tasks" value={active} href="/tasks/team" foot={__uiTr("Excluding backlog")} />
        <Metric label={__uiTr("Assigned by me")} icon="user" value={assignedOpen} href="/tasks/assigned" foot={__uiTr("Still open")} />
        <Metric label={__uiTr("Overdue")} icon="flag" value={overdue} tone={overdue ? "alert" : undefined} foot={__uiTr(overdue ? "Past their deadline" : "Nothing past its deadline")} />
        <Metric label={__uiTr("Awaiting your review")} icon="review" value={reviews} href="/tasks/team?tab=review" foot={__uiTr(reviews ? "Approve or return" : "No reviews waiting")} />
        <Metric
          label={`MISP IOCs · ${month}`} icon="shield"
          value={stats.soc.iocs}
          aside={stats.soc.iocSeries.some(Boolean) && <Bars values={stats.soc.iocSeries} labels={days} name={locale === "fa" ? "شاخص‌های تهدید روزانه در ۷ روز گذشته" : "IOCs per day, last 7 days"} />}
          foot={__uiTr("Bars: last 7 days")}
        />
        <Metric
          label={`${__uiTr("Tickets")} · ${month}`} icon="inbox"
          value={stats.soc.tickets}
          aside={stats.soc.ticketSeries.some(Boolean) && <Bars values={stats.soc.ticketSeries} labels={days} name={locale === "fa" ? "تیکت‌های روزانه در ۷ روز گذشته" : "Tickets per day, last 7 days"} />}
          foot={__uiTr("Bars: last 7 days")}
        />
      </MetricGrid>

      <ManagerReturnedQueue />

      <div className="grid-2">
        <AttentionList items={attention} />
        <Panel title={__uiTr("Team workload")} meta={locale === "fa" ? `تسک باز هر نفر · ${number(FULL_LOAD)} = ظرفیت کامل` : `Open tasks per person · ${FULL_LOAD} = full`}>
          {soc.length === 0 ? (
            <EmptyState compact icon="team" title={__uiTr("No SOC members yet")} action={<Link className="btn btn-secondary btn-sm" href="/team">{"" + __uiTr("Go to Team") + ""}</Link>}>{"" + __uiTr("Add analysts to SOC · L1, L2 or L3 on the Team page.") + ""}</EmptyState>
          ) : (
            <div role="list">
              {soc.map((p) => (
                <div key={p.id} className="hbar" role="listitem">
                  <Link href={p.team.startsWith("SOC") ? `/analytics/people/${encodeURIComponent(p.id)}` : `/performance/employees/${p.id}`} className="who">
                    <Avatar id={p.id} />
                    <span>{p.name}</span>
                    {p.assist && <span className="badge" data-tooltip={`${__uiTr("Primary team")}: ${teamText(p.team)}`}>{"" + __uiTr("Assisting") + ""}</span>}
                  </Link>
                  <span className="track" role="img" aria-label={locale === "fa" ? `${number(p.open)} تسک باز از ${number(FULL_LOAD)}` : `${p.open} open of ${FULL_LOAD}`}>
                    <span className={p.load > 90 ? "full" : ""} style={{ width: `${p.load}%` }} />
                  </span>
                  <span className="num sec" style={{ textAlign: "right" }}>{number(p.open)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
