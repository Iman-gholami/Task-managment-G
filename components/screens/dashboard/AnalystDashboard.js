"use client";

import { useI18n as useSharedI18n } from "@/components/I18nProvider";

import { useI18n as useUiI18n } from "@/components/I18nProvider";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import TaskTable from "@/components/TaskTable";
import Icon from "@/components/ui/Icon";
import { ReturnedShiftAlerts } from "@/components/screens/dashboard/ReturnedShifts";
import { PageHeader, Panel } from "@/components/ui/layout";
import { Metric, MetricGrid } from "@/components/ui/Metric";
import { Meter } from "@/components/ui/charts";
import { TODAY, addDays, isOpen, longDate, monthName, weekday } from "@/lib/format";
import { dashboardDay, dashboardMonth } from "@/lib/i18n/presentation";
import { isTaskOverdue, isTaskPendingSubmission } from "@/lib/task-deadline";
import { shiftActivityText } from "@/lib/i18n/shift-content";

/** Analyst / engineer: my queue first; SOC analysts also get today's Shift Log status. */
export default function AnalystDashboard() {
  const { t: __sharedTr } = useSharedI18n();
  const { t: __uiTr, locale, team: teamText, number } = useUiI18n();
  const { tasks, activities, tickets, me, stats, shiftDone, shiftChecklist, setCreateOpen } = useApp();
  const mine = tasks.filter((t) => t.a === me.id && isOpen(t)).sort((a, b) => (a.due > b.due ? 1 : -1));
  const overdue = mine.filter((t) => isTaskOverdue(t, TODAY)).length;
  const dueSoon = mine.filter((t) => isTaskPendingSubmission(t) && t.due >= TODAY && t.due <= addDays(TODAY, 2)).length;
  const inReview = mine.filter((t) => t.status === "review").length;
  const done = activities.filter((a) => a.done).length;
  const remaining = activities.filter((a) => !a.done);
  const iocs = activities.filter((a) => a.kind === "misp").reduce((sum, a) => sum + (a.iocs ?? 0), 0);
  const month = dashboardMonth(stats.period.from, locale);
  const shift = me.keepsShiftLog;
  const shiftLabel = done ? (shiftDone ? "View Shift Log" : "Continue Shift Log") : "Start Shift Log";

  return (
    <div className="page">
      <PageHeader
        title={locale === "fa" ? `سلام، ${me.name.split(" ")[0]}` : `Hello, ${me.name.split(" ")[0]}`}
        meta={[dashboardDay(TODAY, locale), teamText(me.team)]}
        actions={
          <>
            <button type="button" className={`btn ${shift ? "btn-secondary" : "btn-primary"}`} onClick={() => setCreateOpen(true)}><Icon name="plus" />{"" + __uiTr("Create task") + ""}</button>
            {shift && <Link className="btn btn-primary" href="/shift">{__uiTr(shiftLabel)}</Link>}
          </>
        }
      />

      <ReturnedShiftAlerts />

      <MetricGrid label={__uiTr("My summary")}>
        <Metric label={__uiTr("Assigned to me")} icon="tasks" value={mine.length} href="/tasks/my" foot={inReview ? `${number(inReview)} ${locale === "fa" ? "در انتظار بازبینی" : "awaiting review"}` : __uiTr("Open tasks")} />
        <Metric label={__uiTr("Due within 48h")} icon="cal" value={dueSoon} foot={__uiTr(dueSoon ? "Due in the next 2 days" : "Nothing due soon")} />
        <Metric label={__uiTr("Overdue")} icon="flag" value={overdue} tone={overdue ? "alert" : undefined} foot={__uiTr(overdue ? "Past their deadline" : "All on schedule")} />
        <Metric label={`${__uiTr("Completed")} · ${month}`} icon="checkCircle" value={stats.my.completed} href={`/analytics/people/${encodeURIComponent(me.id)}`} foot={__uiTr("Approved this month")} />
        {shift && <Metric label={`MISP IOCs · ${month}`} icon="shield" value={stats.my.iocs} foot={__uiTr("From your shift logs")} />}
        {shift && <Metric label={`${__uiTr("Tickets")} · ${month}`} icon="inbox" value={stats.my.tickets} foot={__uiTr("Registered in shift logs")} />}
      </MetricGrid>

      <div className={shift ? "grid-main" : ""}>
        <Panel
          title={__uiTr("My work queue")}
          meta={__uiTr("Open tasks · soonest deadline first")}
          actions={<Link className="btn btn-ghost btn-sm" href="/tasks/my">{"" + __uiTr("All my tasks") + ""}<Icon name="arrowRight" /></Link>}
        >
          <TaskTable
            list={mine}
            cols={["title", "status", "prio", "due"]}
            empty={{ title: __uiTr("Your queue is empty"), body: __uiTr("Nothing is assigned to you right now. New assignments appear here and in notifications.") }}
          />
        </Panel>
        {shift && (
          <Panel
            title={__uiTr("Today's Shift Log")}
            actions={<span className={`badge dot ${shiftDone ? "success" : done ? "info" : ""}`}>{shiftDone ? __uiTr("Completed") : done ? __sharedTr("In progress") : __sharedTr("Not started")}</span>}
            footer={<Link className="btn btn-secondary btn-block" href="/shift">{__uiTr(shiftLabel)}</Link>}
          >
            <div className="panel-body shift-card">
              {activities.length === 0 && !shiftDone ? (
                <p className="sec">{"" + __uiTr("No checklist is assigned to") + " "}{teamText(me.team)}{" " + __uiTr("for today's shift. You can still record tickets in the Shift Log.") + ""}</p>
              ) : done === 0 && !shiftDone ? (
                <p className="sec">{"" + __uiTr("Nothing has been recorded for today yet. Start with the first routine activity.") + ""}</p>
              ) : (
                <>
                  <div className="shift-card-top">
                    <span className="big num">{number(done)}<span className="muted">/{number(activities.length)}</span></span>
                    <span className="sec">{"" + __uiTr("activities done") + ""}</span>
                  </div>
                  <Meter value={done} max={activities.length} label={__uiTr("Shift Log progress")} tone={shiftDone ? "ok" : undefined} />
                  <dl className="kv compact">
                    <dt>{"" + __uiTr("Next") + ""}</dt>
                    <dd>{remaining.length ? <span className="truncate">{shiftActivityText(remaining[0], shiftChecklist, locale).title}{remaining.length > 1 && <span className="muted"> +{number(remaining.length - 1)}{" " + __uiTr("more") + ""}</span>}</span> : __uiTr("All done")}</dd>
                    <dt>{"" + __uiTr("IOCs added") + ""}</dt><dd className="num">{number(iocs)}</dd>
                    <dt>{"" + __uiTr("Tickets") + ""}</dt><dd className="num">{number(tickets.length)}</dd>
                  </dl>
                </>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
