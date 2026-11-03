"use client";

import { useI18n as useSharedI18n } from "@/components/I18nProvider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import PeriodSelector from "@/components/PeriodSelector";
import ManagerPerformanceCharts from "@/components/screens/ManagerPerformanceCharts";
import EmployeePerformanceCharts from "@/components/screens/EmployeePerformanceCharts";
import Icon from "@/components/ui/Icon";
import { PageHeader, Panel } from "@/components/ui/layout";
import { Metric, MetricGrid } from "@/components/ui/Metric";
import { Bars, CxLegend, Distribution } from "@/components/ui/charts";
import { EmptyState, ErrorState, Loading } from "@/components/ui/states";
import { Avatar, Complexity, Quality, Who } from "@/components/ui/indicators";
import { QUAL, fmtRange, plural } from "@/lib/format";
import { taskWhen } from "@/lib/task-date";
import { dashboardRange } from "@/lib/i18n/presentation";
import { periodQuery } from "@/lib/period";
import { ROLE_LABELS, isManager } from "@/lib/roles";

function ExportLink({ report, query }) {
  const { t: __sharedTr, locale } = useSharedI18n();
  return <a className="btn btn-secondary" href={`/api/reports/${report}?${query}&format=xlsx&lang=${locale}`} download data-tooltip={__sharedTr("Download as an Excel workbook (.xlsx)")}><Icon name="download" />{"" + __sharedTr("Export to Excel") + ""}</a>;
}

function usePeriod() {
  const [period, setPeriod] = useState("this");
  const [range, setRange] = useState({ from: "", to: "" });
  return { period, setPeriod, range, setRange, query: periodQuery(period, range) };
}

/** One employee's performance. The employee comes from the URL: /performance/employees/<id>. */
export function EmployeePerformance({ userId }) {
  const { t: __sharedTr, locale, role: roleText, team: teamText, number } = useSharedI18n();
  const { me, members, openPopover } = useApp();
  const router = useRouter();
  const manager = isManager(me);
  const p = usePeriod();
  const { data, loading, error, reload } = useFetch(`/api/performance?user=${userId}&${p.query}`);
  const tickets = useFetch(data?.routine ? `/api/reports/tickets?user=${userId}&${p.query}` : null);
  const u = data?.user;
  const r = data?.routine;

  const showTickets = (e) =>
    openPopover(e.currentTarget, {
      title: `${__sharedTr("Tickets")} · ${dashboardRange(data.period.from, data.period.to, locale)}`,
      width: 340,
      items: [
        ...(tickets.data?.sheets[0].rows ?? []).slice(0, 12).map((row) => ({ value: `${row.no}-${row.date}`, label: <span className="mono">{row.no}</span>, hint: row.date })),
        { value: "__report", label: <>{"" + __sharedTr("Open Ticket Report") + ""}</>, icon: <Icon name="arrowRight" /> },
      ],
      onPick: () => router.push(`/reports/tickets${manager ? `?user=${userId}` : ""}`),
    });

  return (
    <div className="page">
      <PageHeader
        leading={u && <Avatar id={u.id} size="lg" />}
        title={u?.name ?? __sharedTr("Performance")}
        meta={u ? [`${roleText(u.role)} · ${teamText(u.team)}`, dashboardRange(data.period.from, data.period.to, locale)] : null}
        actions={
          <>
            {manager && (
              <select className="input" style={{ width: 200 }} value={userId} onChange={(e) => router.push(`/performance/employees/${e.target.value}`)} aria-label={__sharedTr("Employee")}>
                {members.filter((m) => m.role !== "security_manager").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            <ExportLink report="employee" query={`user=${userId}&${p.query}`} />
          </>
        }
      />
      <div className="page-toolbar"><PeriodSelector value={p.period} onChange={p.setPeriod} custom range={p.range} onRange={p.setRange} /></div>

      {loading && !data ? <Loading label={__sharedTr("Loading performance")} rows={8} /> : error ? (
        <div className="panel"><ErrorState error={error} title={__sharedTr("Couldn't load performance")} onRetry={reload} /></div>
      ) : data && (
        <>
          <MetricGrid label={__sharedTr("Performance summary")}>
            <Metric label={__sharedTr("Completed tasks")} icon="checkCircle" value={data.completedTasks} foot={__sharedTr("Approved in this period")} />
            <Metric label={__sharedTr("Task hours")} icon="clock" value={data.taskHours} unit={locale === "fa" ? "ساعت" : "h"} foot={__sharedTr("On completed work")} />
            {r && (
              <>
                <Metric label={__sharedTr("Shift logs completed")} icon="shift" value={r.completed} unit={`/ ${number(r.logs)}`} foot={r.logs - r.completed ? `${number(r.logs - r.completed)} ${locale === "fa" ? "تکمیل‌نشده" : "not completed"}` : __sharedTr("Every log completed")} />
                <Metric label={__sharedTr("MISP IOCs")} icon="shield" value={r.iocs} foot={r.logs ? `${number(r.iocs / r.logs, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} ${locale === "fa" ? "میانگین در هر شیفت" : "per shift on average"}` : __sharedTr("No shifts logged")} />
                <Metric label={__sharedTr("Tickets created")} icon="inbox" value={r.tickets} onClick={showTickets} testId="tickets-metric" foot={__sharedTr("Show the list")} />
              </>
            )}
          </MetricGrid>

          <EmployeePerformanceCharts data={data} />

          <div className="stack-lg">
            {r && (
              <Panel
                title={__sharedTr("Routine activity")}
                meta={__sharedTr("Daily shift work — counted separately from tasks")}
                actions={userId === me.id && <Link className="btn btn-ghost btn-sm" href="/shift/history">{"" + __sharedTr("Daily logs") + ""}<Icon name="arrowRight" /></Link>}
              >
                <div className="stat-row">
                  {[
                    ["Routine completion", `${number(r.completion)}${locale === "fa" ? "٪" : "%"}`, locale === "fa" ? `${number(r.activitiesDone)} از ${number(r.activitiesTotal)} فعالیت` : `${r.activitiesDone} of ${r.activitiesTotal} activities`],
                    ["Shift logs", `${number(r.completed)} / ${number(r.logs)}`, __sharedTr("Completed / started")],
                    ["Daily traffic reports", number(r.reports), __sharedTr("Prepared in shift logs")],
                    ["Issues reported", number(r.issues), __sharedTr("From monitoring activities")],
                  ].map(([l, v, s]) => (
                    <div key={l} className="stat"><span className="l">{__sharedTr(l)}</span><span className="v num">{v}</span><span className="s">{s}</span></div>
                  ))}
                </div>
                {r.iocSeries.length > 1 && (
                  <div className="panel-body chart-block">
                    <div className="chart-title">{"" + __sharedTr("IOCs per shift log") + " "}<span className="muted">{"" + __sharedTr("· oldest to newest") + ""}</span></div>
                    <Bars size="lg" values={r.iocSeries} labels={r.iocSeries.map((_, i) => `${__sharedTr("Shift")} ${number(i + 1)}`)} name={__sharedTr("IOCs per shift log")} unit=" IOCs" />
                  </div>
                )}
              </Panel>
            )}

            <Panel title={__sharedTr("Task performance")} meta={__sharedTr("Project and improvement work, by completion date")}>
              {data.completedTasks === 0 ? (
                <EmptyState compact icon="report" title={__sharedTr("No completed tasks in this period")}>{"" + __sharedTr("Tasks count here once a manager approves them. Try a longer period.") + ""}</EmptyState>
              ) : (
                <>
                  <div className="panel-body split-2">
                    <div>
                      <div className="chart-title">{"" + __sharedTr("Complexity of completed work") + ""}</div>
                      <Distribution parts={data.complexity} />
                      <div style={{ marginTop: 10 }}><CxLegend counts={data.complexity} /></div>
                    </div>
                    <div>
                      <div className="chart-title">{"" + __sharedTr("Quality of completed work") + ""}</div>
                      <div className="legend">{Object.keys(QUAL).map((q, i) => <span key={q}><Quality q={q} /> <b>{data.quality[i]}</b></span>)}</div>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ borderTop: "1px solid var(--divider)" }}>
                    <table className="dt">
                      <thead><tr><th scope="col">{"" + __sharedTr("Task") + ""}</th><th scope="col">{"" + __sharedTr("Description") + ""}</th><th scope="col">{"" + __sharedTr("Complexity") + ""}</th><th scope="col">{"" + __sharedTr("Quality") + ""}</th><th scope="col">{"" + __sharedTr("Started") + ""}</th><th scope="col">{"" + __sharedTr("Completed") + ""}</th><th scope="col" className="r">{__sharedTr("Hours")}</th></tr></thead>
                      <tbody>
                        {data.tasks.map((t) => (
                          <tr key={t.id} className="is-link" onClick={(e) => !e.target.closest("a") && router.push(`/tasks/${t.id}`)}>
                            <td className="title"><Link href={`/tasks/${t.id}`}>{t.title}</Link></td>
                            <td className="truncate" style={{ maxWidth: 280 }} title={t.description || undefined}>{t.description || <span className="muted">—</span>}</td>
                            <td><Complexity c={t.cx} /></td><td><Quality q={t.quality} /></td>
                            <td>{taskWhen(t.started_at, locale)}</td><td>{taskWhen(t.completed_at, locale)}</td><td className="r">{number(t.hours, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

export function PerformanceOverview() {
  const { t: __sharedTr, locale, team: teamText, number } = useSharedI18n();
  const router = useRouter();
  const p = usePeriod();
  const { data, loading, error, reload } = useFetch(`/api/performance?${p.query}`);
  const [q, setQ] = useState("");
  const all = data?.rows ?? [];
  const rows = all.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const total = (f) => all.reduce((s, r) => s + (f(r) || 0), 0);
  const busy = loading && !data;
  const na = <span className="na" data-tooltip={__sharedTr("Not a SOC analyst — no shift log")}>{"" + __sharedTr("n/a") + ""}</span>;

  return (
    <div className="page">
      <PageHeader
        title={__sharedTr("Performance overview")}
        meta={[data ? dashboardRange(data.period.from, data.period.to, locale) : null, __sharedTr("All teams")]}
        actions={<ExportLink report="team" query={p.query} />}
      />
      <div className="page-toolbar"><PeriodSelector value={p.period} onChange={p.setPeriod} custom range={p.range} onRange={p.setRange} /></div>
      {error ? <div className="panel"><ErrorState error={error} title={__sharedTr("Couldn't load performance")} onRetry={reload} /></div> : (
        <>
          <MetricGrid label={__sharedTr("Department totals")}>
            <Metric label={__sharedTr("Tasks completed")} icon="checkCircle" value={total((r) => r.completedTasks)} loading={busy} foot={__sharedTr("Approved in this period")} />
            <Metric label={__sharedTr("Task hours")} icon="clock" value={Math.round(total((r) => r.taskHours))} unit={locale === "fa" ? "ساعت" : "h"} loading={busy} foot={__sharedTr("On completed work")} />
            <Metric label={__sharedTr("Shift logs")} icon="shift" value={total((r) => r.routine?.logs)} loading={busy} foot={__sharedTr("Started by SOC analysts")} />
            <Metric label={__sharedTr("MISP IOCs")} icon="shield" value={total((r) => r.routine?.iocs)} loading={busy} foot={__sharedTr("Added in shift logs")} />
            <Metric label={__sharedTr("Tickets")} icon="inbox" value={total((r) => r.routine?.tickets)} loading={busy} foot={__sharedTr("Registered in shift logs")} />
          </MetricGrid>

          <ManagerPerformanceCharts data={data} loading={busy} />

          <div className="toolbar" role="search" aria-label={__sharedTr("Filter employees")}>
            <div className="search"><Icon name="search" /><input type="search" className="input" placeholder={__sharedTr("Search employee")} aria-label={__sharedTr("Search employee")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="end"><span className="result-count">{busy ? "" : rows.length === all.length ? locale === "fa" ? `${number(all.length)} نفر` : plural(all.length, "person", "people") : `${number(rows.length)} ${__sharedTr("of")} ${number(all.length)}`}</span></div>
          </div>
          <Panel footer={<><CxLegend /><span style={{ marginLeft: "auto" }}>{"" + __sharedTr("Alphabetical. Figures describe output, not rank — there is no leaderboard.") + ""}</span></>}>
            {busy ? <TableLoading /> : rows.length === 0 ? (
              <EmptyState compact icon="search" title={__sharedTr(all.length ? "No one matches" : "No people yet")}>{all.length ? locale === "fa" ? `فردی با «${q}» مطابقت ندارد.` : `Nobody matches “${q}”.` : __sharedTr("Add members on the Team page to see their figures here.")}</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="dt">
                  <thead>
                    <tr>
                      <th scope="col">{__sharedTr("Employee")}</th><th scope="col">{__sharedTr("Team")}</th><th scope="col" className="r">{"" + __sharedTr("Tasks done") + ""}</th><th scope="col" className="r">{__sharedTr("Hours")}</th>
                      <th scope="col" style={{ width: 170 }}>{"" + __sharedTr("Complexity mix") + ""}</th><th scope="col" className="r">{"" + __sharedTr("Shift logs") + ""}</th><th scope="col" className="r">{"" + __sharedTr("Routine") + ""}</th>
                      <th scope="col" className="r">{"" + __sharedTr("IOCs") + ""}</th><th scope="col" className="r">{"" + __sharedTr("Tickets") + ""}</th><th scope="col"><span className="sr-only">{__sharedTr("Open")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="is-link" onClick={(e) => !e.target.closest("a") && router.push(`/performance/employees/${r.id}`)}>
                        <td className="title"><Link href={`/performance/employees/${r.id}`}><Who id={r.id} /></Link></td>
                        <td>{teamText(r.team)}</td>
                        <td className="r">{r.completedTasks ? number(r.completedTasks) : <span className="zero">{number(0)}</span>}</td>
                        <td className="r">{r.taskHours ? number(r.taskHours) : <span className="zero">{number(0)}</span>}</td>
                        <td>{r.complexity.some(Boolean) ? <Distribution parts={r.complexity} /> : <span className="muted">—</span>}</td>
                        <td className="r">{r.routine ? number(r.routine.logs) : na}</td>
                        <td className="r">{r.routine ? `${number(r.routine.completion)}${locale === "fa" ? "٪" : "%"}` : na}</td>
                        <td className="r">{r.routine ? number(r.routine.iocs) : na}</td>
                        <td className="r">{r.routine ? number(r.routine.tickets) : na}</td>
                        <td className="r"><Icon name="chev" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

const TableLoading = () => <Loading label="Loading performance" rows={6} />;
