"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import PeriodSelector from "@/components/PeriodSelector";
import ManagerPerformanceCharts from "@/components/screens/ManagerPerformanceCharts";
import Icon from "@/components/ui/Icon";
import { PageHeader, Panel } from "@/components/ui/layout";
import { Metric, MetricGrid } from "@/components/ui/Metric";
import { Bars, CxLegend, Distribution } from "@/components/ui/charts";
import { EmptyState, ErrorState, Loading } from "@/components/ui/states";
import { Avatar, Complexity, Quality, Who } from "@/components/ui/indicators";
import { QUAL, fmtRange, plural } from "@/lib/format";
import { periodQuery } from "@/lib/period";
import { ROLE_LABELS, isManager } from "@/lib/roles";

const dt = (s) => (s ? s.replace("T", " ").slice(0, 10) : "—");

function ExportLink({ report, query }) {
  return <a className="btn btn-secondary" href={`/api/reports/${report}?${query}&format=xlsx`} download data-tooltip="Download as an Excel workbook (.xlsx)"><Icon name="download" />Export to Excel</a>;
}

function usePeriod() {
  const [period, setPeriod] = useState("this");
  const [range, setRange] = useState({ from: "", to: "" });
  return { period, setPeriod, range, setRange, query: periodQuery(period, range) };
}

/** One employee's performance. The employee comes from the URL: /performance/employees/<id>. */
export function EmployeePerformance({ userId }) {
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
      title: `Tickets · ${fmtRange(data.period.from, data.period.to)}`,
      width: 340,
      items: [
        ...(tickets.data?.sheets[0].rows ?? []).slice(0, 12).map((row) => ({ value: `${row.no}-${row.date}`, label: <span className="mono">{row.no}</span>, hint: row.date })),
        { value: "__report", label: <>Open Ticket Report</>, icon: <Icon name="arrowRight" /> },
      ],
      onPick: () => router.push(`/reports/tickets${manager ? `?user=${userId}` : ""}`),
    });

  return (
    <div className="page">
      <PageHeader
        leading={u && <Avatar id={u.id} size="lg" />}
        title={u?.name ?? "Performance"}
        meta={u ? [`${ROLE_LABELS[u.role]} · ${u.team}`, fmtRange(data.period.from, data.period.to)] : null}
        actions={
          <>
            {manager && (
              <select className="input" style={{ width: 200 }} value={userId} onChange={(e) => router.push(`/performance/employees/${e.target.value}`)} aria-label="Employee">
                {members.filter((m) => m.role !== "security_manager").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            <ExportLink report="employee" query={`user=${userId}&${p.query}`} />
          </>
        }
      />
      <div className="page-toolbar"><PeriodSelector value={p.period} onChange={p.setPeriod} custom range={p.range} onRange={p.setRange} /></div>

      {loading && !data ? <Loading label="Loading performance" rows={8} /> : error ? (
        <div className="panel"><ErrorState error={error} title="Couldn't load performance" onRetry={reload} /></div>
      ) : data && (
        <>
          <MetricGrid label="Performance summary">
            <Metric label="Completed tasks" value={data.completedTasks} foot="Approved in this period" />
            <Metric label="Task hours" value={data.taskHours} unit="h" foot="On completed work" />
            {r && (
              <>
                <Metric label="Shift logs completed" value={r.completed} unit={`/ ${r.logs}`} foot={r.logs - r.completed ? `${r.logs - r.completed} not completed` : "Every log completed"} />
                <Metric label="MISP IOCs" value={r.iocs} foot={r.logs ? `${(r.iocs / r.logs).toFixed(1)} per shift on average` : "No shifts logged"} />
                <Metric label="Tickets created" value={r.tickets} onClick={showTickets} testId="tickets-metric" foot="Show the list" />
              </>
            )}
          </MetricGrid>

          <div className="stack-lg">
            {r && (
              <Panel
                title="Routine activity"
                meta="Daily shift work — counted separately from tasks"
                actions={userId === me.id && <Link className="btn btn-ghost btn-sm" href="/shift/history">Daily logs<Icon name="arrowRight" /></Link>}
              >
                <div className="stat-row">
                  {[
                    ["Routine completion", `${r.completion}%`, `${r.activitiesDone} of ${r.activitiesTotal} activities`],
                    ["Shift logs", `${r.completed} / ${r.logs}`, "Completed / started"],
                    ["Daily traffic reports", r.reports, "Prepared in shift logs"],
                    ["Issues reported", r.issues, "From monitoring activities"],
                  ].map(([l, v, s]) => (
                    <div key={l} className="stat"><span className="l">{l}</span><span className="v num">{v}</span><span className="s">{s}</span></div>
                  ))}
                </div>
                {r.iocSeries.length > 1 && (
                  <div className="panel-body chart-block">
                    <div className="chart-title">IOCs per shift log <span className="muted">· oldest to newest</span></div>
                    <Bars size="lg" values={r.iocSeries} labels={r.iocSeries.map((_, i) => `Shift ${i + 1}`)} name="IOCs per shift log" unit=" IOCs" />
                  </div>
                )}
              </Panel>
            )}

            <Panel title="Task performance" meta="Project and improvement work, by completion date">
              {data.completedTasks === 0 ? (
                <EmptyState compact icon="report" title="No completed tasks in this period">Tasks count here once a manager approves them. Try a longer period.</EmptyState>
              ) : (
                <>
                  <div className="panel-body split-2">
                    <div>
                      <div className="chart-title">Complexity of completed work</div>
                      <Distribution parts={data.complexity} />
                      <div style={{ marginTop: 10 }}><CxLegend counts={data.complexity} /></div>
                    </div>
                    <div>
                      <div className="chart-title">Quality of completed work</div>
                      <div className="legend">{Object.keys(QUAL).map((q, i) => <span key={q}><Quality q={q} /> <b>{data.quality[i]}</b></span>)}</div>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ borderTop: "1px solid var(--divider)" }}>
                    <table className="dt">
                      <thead><tr><th scope="col">Task</th><th scope="col">Description</th><th scope="col">Complexity</th><th scope="col">Quality</th><th scope="col">Started</th><th scope="col">Completed</th><th scope="col" className="r">Hours</th></tr></thead>
                      <tbody>
                        {data.tasks.map((t) => (
                          <tr key={t.id} className="is-link" onClick={(e) => !e.target.closest("a") && router.push(`/tasks/${t.id}`)}>
                            <td className="title"><Link href={`/tasks/${t.id}`}>{t.title}</Link></td>
                            <td className="truncate" style={{ maxWidth: 280 }} title={t.description || undefined}>{t.description || <span className="muted">—</span>}</td>
                            <td><Complexity c={t.cx} /></td><td><Quality q={t.quality} /></td>
                            <td>{dt(t.started_at)}</td><td>{dt(t.completed_at)}</td><td className="r">{t.hours.toFixed(1)}</td>
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
  const router = useRouter();
  const p = usePeriod();
  const { data, loading, error, reload } = useFetch(`/api/performance?${p.query}`);
  const [q, setQ] = useState("");
  const all = data?.rows ?? [];
  const rows = all.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const total = (f) => all.reduce((s, r) => s + (f(r) || 0), 0);
  const busy = loading && !data;
  const na = <span className="na" data-tooltip="Not a SOC analyst — no shift log">n/a</span>;

  return (
    <div className="page">
      <PageHeader
        title="Performance overview"
        meta={[data ? fmtRange(data.period.from, data.period.to) : null, "All teams"]}
        actions={<ExportLink report="team" query={p.query} />}
      />
      <div className="page-toolbar"><PeriodSelector value={p.period} onChange={p.setPeriod} custom range={p.range} onRange={p.setRange} /></div>
      {error ? <div className="panel"><ErrorState error={error} title="Couldn't load performance" onRetry={reload} /></div> : (
        <>
          <MetricGrid label="Department totals">
            <Metric label="Tasks completed" value={total((r) => r.completedTasks)} loading={busy} foot="Approved in this period" />
            <Metric label="Task hours" value={Math.round(total((r) => r.taskHours))} unit="h" loading={busy} foot="On completed work" />
            <Metric label="Shift logs" value={total((r) => r.routine?.logs)} loading={busy} foot="Started by SOC analysts" />
            <Metric label="MISP IOCs" value={total((r) => r.routine?.iocs)} loading={busy} foot="Added in shift logs" />
            <Metric label="Tickets" value={total((r) => r.routine?.tickets)} loading={busy} foot="Registered in shift logs" />
          </MetricGrid>

          <ManagerPerformanceCharts data={data} loading={busy} />

          <div className="toolbar" role="search" aria-label="Filter employees">
            <div className="search"><Icon name="search" /><input type="search" className="input" placeholder="Search employee" aria-label="Search employee" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="end"><span className="result-count">{busy ? "" : rows.length === all.length ? plural(all.length, "person", "people") : `${rows.length} of ${all.length}`}</span></div>
          </div>
          <Panel footer={<><CxLegend /><span style={{ marginLeft: "auto" }}>Alphabetical. Figures describe output, not rank — there is no leaderboard.</span></>}>
            {busy ? <TableLoading /> : rows.length === 0 ? (
              <EmptyState compact icon="search" title={all.length ? "No one matches" : "No people yet"}>{all.length ? `Nobody matches “${q}”.` : "Add members on the Team page to see their figures here."}</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="dt">
                  <thead>
                    <tr>
                      <th scope="col">Employee</th><th scope="col">Team</th><th scope="col" className="r">Tasks done</th><th scope="col" className="r">Hours</th>
                      <th scope="col" style={{ width: 170 }}>Complexity mix</th><th scope="col" className="r">Shift logs</th><th scope="col" className="r">Routine</th>
                      <th scope="col" className="r">IOCs</th><th scope="col" className="r">Tickets</th><th scope="col"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="is-link" onClick={(e) => !e.target.closest("a") && router.push(`/performance/employees/${r.id}`)}>
                        <td className="title"><Link href={`/performance/employees/${r.id}`}><Who id={r.id} /></Link></td>
                        <td>{r.team}</td>
                        <td className="r">{r.completedTasks || <span className="zero">0</span>}</td>
                        <td className="r">{r.taskHours || <span className="zero">0</span>}</td>
                        <td>{r.complexity.some(Boolean) ? <Distribution parts={r.complexity} /> : <span className="muted">—</span>}</td>
                        <td className="r">{r.routine ? r.routine.logs : na}</td>
                        <td className="r">{r.routine ? `${r.routine.completion}%` : na}</td>
                        <td className="r">{r.routine ? r.routine.iocs : na}</td>
                        <td className="r">{r.routine ? r.routine.tickets : na}</td>
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
