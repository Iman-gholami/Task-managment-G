"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import TaskTable from "@/components/TaskTable";
import Icon from "@/components/ui/Icon";
import { PageHeader, Panel } from "@/components/ui/layout";
import { Metric, MetricGrid } from "@/components/ui/Metric";
import { Meter } from "@/components/ui/charts";
import { TODAY, addDays, isOpen, longDate, monthName, weekday } from "@/lib/format";

/** Analyst / engineer: my queue first; SOC analysts also get today's Shift Log status. */
export default function AnalystDashboard() {
  const { tasks, activities, tickets, me, stats, shiftDone, setCreateOpen } = useApp();
  const mine = tasks.filter((t) => t.a === me.id && isOpen(t)).sort((a, b) => (a.due > b.due ? 1 : -1));
  const overdue = mine.filter((t) => t.due < TODAY).length;
  const dueSoon = mine.filter((t) => t.due >= TODAY && t.due <= addDays(TODAY, 2)).length;
  const inReview = mine.filter((t) => t.status === "review").length;
  const done = activities.filter((a) => a.done).length;
  const remaining = activities.filter((a) => !a.done);
  const iocs = activities.find((a) => a.kind === "misp")?.iocs ?? 0;
  const month = monthName(stats.period.from);
  const shift = me.keepsShiftLog;
  const shiftLabel = done ? (shiftDone ? "View Shift Log" : "Continue Shift Log") : "Start Shift Log";

  return (
    <div className="page">
      <PageHeader
        title={`Hello, ${me.name.split(" ")[0]}`}
        meta={[`${weekday(TODAY)}, ${longDate(TODAY)}`, me.team]}
        actions={
          <>
            <button type="button" className={`btn ${shift ? "btn-secondary" : "btn-primary"}`} onClick={() => setCreateOpen(true)}><Icon name="plus" />Create task</button>
            {shift && <Link className="btn btn-primary" href="/shift">{shiftLabel}</Link>}
          </>
        }
      />

      <MetricGrid label="My summary">
        <Metric label="Assigned to me" icon="tasks" value={mine.length} href="/tasks/my" foot={inReview ? `${inReview} awaiting review` : "Open tasks"} />
        <Metric label="Due within 48h" icon="cal" value={dueSoon} foot={dueSoon ? "Due in the next 2 days" : "Nothing due soon"} />
        <Metric label="Overdue" icon="flag" value={overdue} tone={overdue ? "alert" : undefined} foot={overdue ? "Past their deadline" : "All on schedule"} />
        <Metric label={`Completed · ${month}`} icon="checkCircle" value={stats.my.completed} href={`/performance/employees/${me.id}`} foot="Approved this month" />
        {shift && <Metric label={`MISP IOCs · ${month}`} icon="shield" value={stats.my.iocs} foot="From your shift logs" />}
        {shift && <Metric label={`Tickets · ${month}`} icon="inbox" value={stats.my.tickets} foot="Registered in shift logs" />}
      </MetricGrid>

      <div className={shift ? "grid-main" : ""}>
        <Panel
          title="My work queue"
          meta="Open tasks · soonest deadline first"
          actions={<Link className="btn btn-ghost btn-sm" href="/tasks/my">All my tasks<Icon name="arrowRight" /></Link>}
        >
          <TaskTable
            list={mine}
            cols={["title", "status", "prio", "due"]}
            empty={{ title: "Your queue is empty", body: "Nothing is assigned to you right now. New assignments appear here and in notifications." }}
          />
        </Panel>
        {shift && (
          <Panel
            title="Today's Shift Log"
            actions={<span className={`badge dot ${shiftDone ? "success" : done ? "info" : ""}`}>{shiftDone ? "Completed" : done ? "In progress" : "Not started"}</span>}
            footer={<Link className="btn btn-secondary btn-block" href="/shift">{shiftLabel}</Link>}
          >
            <div className="panel-body shift-card">
              {done === 0 && !shiftDone ? (
                <p className="sec">Nothing has been recorded for today yet. Start with the first routine activity.</p>
              ) : (
                <>
                  <div className="shift-card-top">
                    <span className="big num">{done}<span className="muted">/{activities.length}</span></span>
                    <span className="sec">activities done</span>
                  </div>
                  <Meter value={done} max={activities.length} label="Shift Log progress" tone={shiftDone ? "ok" : undefined} />
                  <dl className="kv compact">
                    <dt>Next</dt>
                    <dd>{remaining.length ? <span className="truncate">{remaining[0].title}{remaining.length > 1 && <span className="muted"> +{remaining.length - 1} more</span>}</span> : "All done"}</dd>
                    <dt>IOCs added</dt><dd className="num">{iocs}</dd>
                    <dt>Tickets</dt><dd className="num">{tickets.length}</dd>
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
