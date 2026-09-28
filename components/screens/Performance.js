"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import { PeriodSelector, periodQuery } from "@/components/screens/Dashboard";
import { TableSkeleton } from "@/components/screens/Misc";
import Icon from "@/components/ui/Icon";
import { Avatar, Complexity, Distribution, EmptyState, Quality, Spark, Status, Who } from "@/components/ui/indicators";
import { CX, QUAL } from "@/lib/format";
import { ROLE_LABELS, isManager } from "@/lib/roles";

const dt = (s) => (s ? s.replace("T", " ").slice(0, 10) : "—");

function ExportLink({ report, query }) {
  return <a className="btn btn-primary" href={`/api/reports/${report}?${query}&format=xlsx`} download><Icon name="xls" />Export to Excel</a>;
}

function usePeriod() {
  const [period, setPeriod] = useState("this");
  const [range, setRange] = useState({ from: "", to: "" });
  return { period, setPeriod, range, setRange, query: periodQuery(period, range) };
}

export function EmployeePerformance() {
  const { me, members, openPopover } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const manager = isManager(me);
  const userId = (manager && params.get("user")) || me.id;
  const p = usePeriod();
  const { data, loading, error, reload } = useFetch(`/api/performance?user=${userId}&${p.query}`);
  const tickets = useFetch(data?.routine ? `/api/reports/tickets?user=${userId}&${p.query}` : null);
  const u = data?.user;

  const showTickets = (e) =>
    openPopover(e.currentTarget, {
      title: `Tickets · ${data.period.from} – ${data.period.to}`,
      width: 340,
      items: [
        ...(tickets.data?.sheets[0].rows ?? []).slice(0, 12).map((r) => ({ value: `${r.no}-${r.date}`, label: <><span className="mono">{r.no}</span><span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>{r.date}</span></> })),
        { value: "__report", label: <>Open Ticket Report <Icon name="chev" /></> },
      ],
      onPick: () => router.push(`/reports/tickets${manager ? `?user=${userId}` : ""}`),
    });

  return (
    <div className="page narrow">
      <div className="page-head">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {u && <Avatar id={u.id} size="lg" />}
          <div><h1>{u?.name ?? "Performance"}</h1><p>{u ? `${ROLE_LABELS[u.role]} · ${u.team}` : " "}</p></div>
        </div>
        <div className="actions">
          {manager && (
            <select className="input" style={{ width: 190 }} value={userId} onChange={(e) => router.replace(`/performance/employees?user=${e.target.value}`)} aria-label="Employee">
              {members.filter((m) => m.role !== "security_manager").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          <PeriodSelector value={p.period} onChange={p.setPeriod} custom range={p.range} onRange={p.setRange} />
          <ExportLink report="employee" query={`user=${userId}&${p.query}`} />
        </div>
      </div>
      {data && <p className="muted" style={{ margin: "-12px 0 20px", fontSize: 12 }}>Period: {data.period.from} – {data.period.to}</p>}

      {loading && !data ? <TableSkeleton rows={8} /> : error ? (
        <EmptyState danger icon={<Icon name="alert" />} title="Couldn't load performance" action={<button className="btn btn-secondary btn-sm" onClick={reload}>Retry</button>}>{error}</EmptyState>
      ) : data && (
        <>
          <div className="metrics">
            <div className="metric"><div className="l">Completed tasks</div><div className="v">{data.completedTasks}</div></div>
            <div className="metric"><div className="l">Task hours</div><div className="v">{data.taskHours}</div></div>
            {data.routine && (
              <>
                <div className="metric"><div className="l">Shift logs completed</div><div className="v">{data.routine.completed}<span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>/{data.routine.logs}</span></div></div>
                <div className="metric"><div className="l">MISP IOCs</div><div className="v">{data.routine.iocs}</div></div>
                <div className="metric link" role="button" tabIndex={0} onClick={showTickets} data-testid="tickets-metric"><div className="l">Tickets created <Icon name="chev" /></div><div className="v">{data.routine.tickets}</div></div>
              </>
            )}
          </div>

          {data.routine && (
            <section className="section">
              <div className="section-head">
                <h2>Routine Activity</h2><span className="badge">Shift Logs</span><span className="meta">Daily operational work — counted separately from tasks</span>
                <div className="right"><Link className="btn btn-ghost btn-sm" href={`/shift/history${manager ? `?user=${userId}` : ""}`}>Daily logs <Icon name="chev" /></Link></div>
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: 0 }}>
                {[
                  ["Shift logs", `${data.routine.completed} / ${data.routine.logs}`, `${data.routine.logs - data.routine.completed} incomplete`],
                  ["Routine completion", `${data.routine.completion}%`, `${data.routine.activitiesDone} of ${data.routine.activitiesTotal} activities`],
                  ["MISP IOCs", data.routine.iocs, data.routine.logs ? `${(data.routine.iocs / data.routine.logs).toFixed(1)} per shift avg` : "—"],
                  ["Tickets created", data.routine.tickets, "Registered in shift logs"],
                  ["Daily traffic reports", data.routine.reports, `${data.routine.issues} issues reported`],
                ].map(([l, v, s], i) => (
                  <div key={l} style={{ padding: i ? "4px 18px" : "4px 18px 4px 0", borderLeft: i ? "1px solid var(--divider)" : 0 }}>
                    <div className="muted" style={{ fontSize: 12 }}>{l}</div>
                    <div style={{ font: "600 18px var(--font-sans)", margin: "4px 0" }} className="num">{v}</div>
                    <div className="sec" style={{ fontSize: 12 }}>{s}</div>
                  </div>
                ))}
              </div>
              {data.routine.iocSeries.length > 1 && (
                <div style={{ marginTop: 18 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>IOCs per shift</div>
                  <Spark values={data.routine.iocSeries} width={960} height={36} />
                </div>
              )}
            </section>
          )}

          <section className="section">
            <div className="section-head"><h2>Task Performance</h2><span className="badge primary">Tasks</span><span className="meta">Project &amp; improvement work, by completion date</span></div>
            {data.completedTasks === 0 ? <EmptyState icon={<Icon name="report" />} title="No completed tasks">No activity was found for the selected period.</EmptyState> : (
              <>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 18 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Complexity of completed work</div>
                    <Distribution parts={data.complexity} />
                    <div className="legend">{CX.slice(1).map((c, i) => <span key={c}><i style={{ background: `var(--viz-${i + 1})` }} />{c} <b className="num" style={{ color: "var(--text)" }}>{data.complexity[i]}</b></span>)}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Quality of completed work</div>
                    <div style={{ display: "flex", gap: 24, fontSize: 13, flexWrap: "wrap" }}>{Object.values(QUAL).map((q, i) => <span key={q} className="sec">{q} <b className="num" style={{ color: "var(--text)" }}>{data.quality[i]}</b></span>)}</div>
                  </div>
                </div>
                <table className="dt">
                  <thead><tr><th>Task</th><th>Description</th><th>Complexity</th><th>Quality</th><th>Start</th><th>End</th><th className="r">Hours</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.tasks.map((t) => (
                      <tr key={t.id} onClick={() => router.push(`/tasks/${t.id}`)}>
                        <td className="title">{t.title}</td><td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>{t.description || <span className="muted">—</span>}</td>
                        <td><Complexity c={t.cx} /></td><td><Quality q={t.quality} /></td><td className="num">{dt(t.started_at)}</td><td className="num">{dt(t.completed_at)}</td><td className="r num">{t.hours.toFixed(1)}</td><td><Status s="done" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
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
  const rows = (data?.rows ?? []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const total = (f) => (data?.rows ?? []).reduce((s, r) => s + (f(r) || 0), 0);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Performance Overview</h1><p>{data ? `${data.period.from} – ${data.period.to} · all teams` : " "}</p></div>
        <div className="actions"><PeriodSelector value={p.period} onChange={p.setPeriod} custom range={p.range} onRange={p.setRange} /><ExportLink report="team" query={p.query} /></div>
      </div>
      {loading && !data ? <TableSkeleton rows={8} /> : error ? (
        <EmptyState danger icon={<Icon name="alert" />} title="Couldn't load performance" action={<button className="btn btn-secondary btn-sm" onClick={reload}>Retry</button>}>{error}</EmptyState>
      ) : (
        <>
          <div className="metrics">
            <div className="metric"><div className="l">Tasks completed</div><div className="v">{total((r) => r.completedTasks)}</div></div>
            <div className="metric"><div className="l">Task hours</div><div className="v">{Math.round(total((r) => r.taskHours))}</div></div>
            <div className="metric"><div className="l">Shift logs</div><div className="v">{total((r) => r.routine?.logs)}</div></div>
            <div className="metric"><div className="l">MISP IOCs</div><div className="v">{total((r) => r.routine?.iocs)}</div></div>
            <div className="metric"><div className="l">Tickets</div><div className="v">{total((r) => r.routine?.tickets)}</div></div>
          </div>
          <div className="toolbar"><div className="search"><Icon name="search" /><input className="input" placeholder="Search employee" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          <table className="dt">
            <thead><tr><th>Employee</th><th>Team</th><th className="r">Tasks done</th><th className="r">Hours</th><th>Complexity mix</th><th className="r">Shift logs</th><th className="r">Routine %</th><th className="r">IOCs</th><th className="r">Tickets</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const na = <span className="muted">n/a</span>;
                return (
                  <tr key={r.id} onClick={() => router.push(`/performance/employees?user=${r.id}`)}>
                    <td className="title"><Who id={r.id} /></td><td>{r.team}</td>
                    <td className="r num">{r.completedTasks}</td><td className="r num">{r.taskHours}</td>
                    <td style={{ width: 180 }}>{r.complexity.some(Boolean) ? <Distribution parts={r.complexity} /> : <span className="muted">—</span>}</td>
                    <td className="r num">{r.routine ? r.routine.logs : na}</td><td className="r num">{r.routine ? `${r.routine.completion}%` : na}</td>
                    <td className="r num">{r.routine ? r.routine.iocs : na}</td><td className="r num">{r.routine ? r.routine.tickets : na}</td>
                    <td className="r"><Icon name="chev" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Sorted alphabetically. Metrics describe output, not rank; there is no leaderboard view.</p>
        </>
      )}
    </div>
  );
}
