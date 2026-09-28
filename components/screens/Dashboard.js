"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import TaskTable from "@/components/TaskTable";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { Avatar, Distribution, EmptyState, Spark } from "@/components/ui/indicators";
import { PeopleTable } from "@/components/screens/Team";
import { TableSkeleton } from "@/components/screens/Misc";
import { CX, TODAY, addDays, isOpen, longDate, weekday } from "@/lib/format";

export default function Dashboard() {
  const { role } = useApp();
  if (role === "soc") return <SocDashboard />;
  if (role === "security") return <SecurityDashboard />;
  return <AnalystDashboard />;
}

function CreateButton({ primary }) {
  const { setCreateOpen } = useApp();
  return <button className={`btn ${primary ? "btn-primary" : "btn-secondary"}`} onClick={() => setCreateOpen(true)}><Icon name="plus" />Create Task</button>;
}

const monthName = (iso) => longDate(iso).split(" ")[0];

function AnalystDashboard() {
  const { tasks, activities, tickets, me, stats, shiftDone } = useApp();
  const mine = tasks.filter((t) => t.a === me.id && isOpen(t)).sort((a, b) => (a.due > b.due ? 1 : -1));
  const overdue = mine.filter((t) => t.due < TODAY).length;
  const dueSoon = mine.filter((t) => t.due >= TODAY && t.due <= addDays(TODAY, 2)).length;
  const inReview = mine.filter((t) => t.status === "review").length;
  const done = activities.filter((a) => a.done).length;
  const remaining = activities.filter((a) => !a.done);
  const iocs = activities.find((a) => a.kind === "misp")?.iocs ?? 0;
  const month = monthName(stats.period.from);
  const shift = me.keepsShiftLog;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Hello, {me.name.split(" ")[0]}</h1><p>{weekday(TODAY)}, {longDate(TODAY)} · {me.team}</p></div>
        <div className="actions">
          <CreateButton primary={!shift} />
          {shift && <Link className="btn btn-primary" href="/shift">{done ? (shiftDone ? "View Shift Log" : "Continue Shift Log") : "Start Shift Log"}</Link>}
        </div>
      </div>

      <div className="metrics">
        <Link className="metric link" href="/tasks/my"><div className="l">Assigned to me</div><div className="v">{mine.length}</div></Link>
        <div className="metric"><div className="l">Due in 48h</div><div className="v">{dueSoon}</div></div>
        <div className={`metric ${overdue ? "alert" : ""}`}><div className="l">Overdue</div><div className="v">{overdue}</div></div>
        <div className="metric"><div className="l">Awaiting review</div><div className="v">{inReview}</div></div>
        <Link className="metric link" href="/performance/employees"><div className="l">Completed · {month}</div><div className="v">{stats.my.completed}</div></Link>
        {shift && <div className="metric"><div className="l">MISP IOCs · {month}</div><div className="v">{stats.my.iocs}</div></div>}
        {shift && <div className="metric"><div className="l">Tickets · {month}</div><div className="v">{stats.my.tickets}</div></div>}
      </div>

      <div className={shift ? "grid g-main" : ""}>
        <section>
          <div className="section-head"><h2>My work queue</h2><span className="meta">Sorted by deadline</span><div className="right"><Link className="btn btn-ghost btn-sm" href="/tasks/my">View all</Link></div></div>
          <TaskTable list={mine} cols={["title", "status", "prio", "due"]} compact />
        </section>
        {shift && (
          <aside>
            <div className="panel" style={{ padding: "16px 18px" }}>
              <div className="section-head" style={{ marginBottom: 12 }}>
                <h2>Today&apos;s Shift Log</h2>
                <span className={`badge ${shiftDone ? "success" : "primary"}`} style={{ marginLeft: "auto" }}>{shiftDone ? "Completed" : done ? "In progress" : "Not started"}</span>
              </div>
              {done === 0 && !shiftDone ? <p className="sec" style={{ margin: 0 }}>No shift activity has been recorded for today.</p> : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ font: "600 24px var(--font-sans)" }} className="num">{done}/{activities.length}</span><span className="sec">activities done</span></div>
                  <div className="progress" style={{ margin: "10px 0 14px" }}><span style={{ width: `${(done / activities.length) * 100}%` }} /></div>
                  <div style={{ fontSize: 13, display: "grid", gap: 8 }}>
                    <Row k="Remaining" v={remaining.length ? remaining.map((a) => a.title).join(", ") : "None"} />
                    <Row k="IOCs added" v={iocs} />
                    <Row k="Tickets" v={tickets.length} />
                  </div>
                </>
              )}
              <Link className="btn btn-secondary" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} href="/shift">Open Shift Log</Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="sec" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
    <span>{k}</span><span className="num" style={{ color: "var(--text)", textAlign: "right" }}>{v}</span>
  </div>
);

/** Items a manager should act on, computed from live data. */
function useAttention(scope) {
  const { tasks, members, me, peopleMap } = useApp();
  const inScope = (t) => scope(peopleMap[t.a] ?? { team: t.team });
  const items = [];
  members.filter((m) => m.shift === "missing").forEach((m) => items.push({ icon: "alert", tone: "danger", text: `${m.name} has not started today's Shift Log`, label: "History", href: `/shift/history?user=${m.id}` }));
  tasks.filter((t) => isOpen(t) && t.due !== "—" && t.due < TODAY && inScope(t)).forEach((t) => items.push({ icon: "flag", tone: "danger", text: `${t.id} is overdue · ${peopleMap[t.a]?.name}`, label: "Open", href: `/tasks/${t.id}` }));
  tasks.filter((t) => t.status === "review" && t.a !== me.id && inScope(t)).forEach((t) => items.push({ icon: "tasks", tone: "violet", text: `${t.id} awaiting your review · ${peopleMap[t.a]?.name}`, label: "Review", href: `/tasks/${t.id}` }));
  tasks.filter((t) => t.status === "blocked" && inScope(t)).forEach((t) => items.push({ icon: "alert", tone: "warning", text: `${t.id} is blocked · ${peopleMap[t.a]?.name}`, label: "Open", href: `/tasks/${t.id}` }));
  return items;
}

function AttentionList({ items }) {
  return (
    <>
      <div className="section-head"><h2>Needs your attention</h2><span className="meta">{items.length} items</span></div>
      {items.length === 0 ? (
        <div className="panel"><EmptyState icon={<Icon name="check" />} title="Nothing needs your attention right now." /></div>
      ) : (
        <div className="panel" style={{ padding: "4px 14px" }}>
          {items.map((it) => (
            <div key={it.text} style={{ display: "flex", alignItems: "center", gap: 12, height: 44, borderBottom: "1px solid var(--divider)" }}>
              <span style={{ color: `var(--${it.tone})` }}><Icon name={it.icon} /></span>
              <span style={{ flex: 1 }}>{it.text}</span>
              <Link className="btn btn-ghost btn-sm" href={it.href}>{it.label}</Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SocDashboard() {
  const { members, tasks, stats, peopleMap } = useApp();
  const soc = members.filter((p) => p.team.startsWith("SOC ·") || p.assist?.startsWith("SOC"));
  const socTask = (t) => (peopleMap[t.a]?.team ?? t.team).startsWith("SOC");
  const attention = useAttention((u) => u.team.startsWith("SOC"));
  const analysts = soc.filter((p) => p.shift);
  const month = monthName(stats.period.from);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>SOC overview</h1><p>{weekday(TODAY)}, {longDate(TODAY)} · {analysts.length} analysts</p></div>
        <div className="actions"><Link className="btn btn-secondary" href="/shift/team">Team Shift Logs</Link><CreateButton primary /></div>
      </div>
      <div className="metrics">
        <Link className="metric link" href="/tasks/team"><div className="l">Active team tasks</div><div className="v">{tasks.filter((t) => isOpen(t) && t.status !== "backlog" && socTask(t)).length}</div></Link>
        <div className={`metric ${attention.some((a) => a.icon === "flag") ? "alert" : ""}`}><div className="l">Overdue</div><div className="v">{attention.filter((a) => a.icon === "flag").length}</div></div>
        <div className="metric"><div className="l">Awaiting your review</div><div className="v">{attention.filter((a) => a.label === "Review").length}</div></div>
        <Link className="metric link" href="/shift/team"><div className="l">Shift completion today</div><div className="v">{stats.soc.shiftCompletion}%</div></Link>
        <div className="metric"><div className="l">MISP IOCs · {month}</div><div className="v">{stats.soc.iocs} <Spark values={stats.soc.iocSeries} width={56} height={20} /></div></div>
        <div className="metric"><div className="l">Tickets · {month}</div><div className="v">{stats.soc.tickets} <Spark values={stats.soc.ticketSeries} width={56} height={20} /></div></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <section><AttentionList items={attention} /></section>
        <section>
          <div className="section-head"><h2>Team workload</h2><span className="meta">Open tasks · 6 = full</span></div>
          {soc.map((p) => (
            <div key={p.id} className="hbar">
              <span className="who"><Avatar id={p.id} />{p.name.split(" ")[0]}{p.assist && <span className="badge" title={`Assisting from ${p.team}`}>assist</span>}</span>
              <div className="track"><span style={{ width: `${p.load}%`, background: p.load > 90 ? "var(--warning)" : "var(--primary)" }} /></div>
              <span className="num sec" style={{ textAlign: "right" }}>{p.open}</span>
            </div>
          ))}
          <div className="section-head" style={{ marginTop: 28 }}><h2>Today&apos;s shift logs</h2><div className="right"><Link className="btn btn-ghost btn-sm" href="/shift/team">Details</Link></div></div>
          {analysts.map((p) => (
            <div key={p.id} className="hbar">
              <span className="who"><Avatar id={p.id} />{p.name.split(" ")[0]}</span>
              <div className="track"><span style={{ width: `${{ active: 50, completed: 100, missing: 0 }[p.shift]}%`, background: "var(--success)" }} /></div>
              <span style={{ textAlign: "right" }}>
                {p.shift === "missing" ? <span className="badge danger">Missing</span> : p.shift === "completed" ? <span className="badge success">Done</span> : <span className="badge primary">Active</span>}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function SecurityDashboard() {
  const { members, stats } = useApp();
  const [period, setPeriod] = useState("this");
  const { data, loading } = useFetch(`/api/performance?period=${period}`);
  const attention = useAttention(() => true);
  const teams = data?.teams ?? [];
  const sum = (k) => teams.reduce((s, t) => s + t[k], 0);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Security Department</h1><p>{data ? `${data.period.from} – ${data.period.to}` : " "} · {teams.length || 3} teams · {members.length} people</p></div>
        <div className="actions"><PeriodSelector value={period} onChange={setPeriod} /><Link className="btn btn-primary" href="/reports/team"><Icon name="xls" />Reports</Link></div>
      </div>
      <div className="metrics">
        <div className="metric"><div className="l">Work completed</div><div className="v">{data ? sum("completed") : "—"}</div></div>
        <div className="metric"><div className="l">Active tasks</div><div className="v">{data ? sum("active") : "—"}</div></div>
        <div className={`metric ${sum("overdue") ? "alert" : ""}`}><div className="l">Overdue</div><div className="v">{data ? sum("overdue") : "—"}</div></div>
        <div className="metric"><div className="l">Task hours logged</div><div className="v">{data ? Math.round(sum("hours")) : "—"}</div></div>
        <div className="metric"><div className="l">Shift log compliance · month</div><div className="v">{stats.department.shiftCompliance}%</div></div>
      </div>
      <section className="section">
        <div className="section-head"><h2>Team comparison</h2><span className="meta">Completed tasks · 6-month trend</span></div>
        {loading && !data ? <TableSkeleton rows={3} /> : (
          <table className="dt">
            <thead><tr><th>Team</th><th className="r">People</th><th className="r">Completed</th><th className="r">Hours</th><th className="r">Active</th><th className="r">Overdue</th><th>Complexity mix</th><th>Trend</th></tr></thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.team}>
                  <td className="title">{t.team}</td><td className="r num">{t.people}</td><td className="r num">{t.completed}</td><td className="r num">{t.hours}</td><td className="r num">{t.active}</td>
                  <td className="r num">{t.overdue ? <span className="overdue">{t.overdue}</span> : <span className="muted">0</span>}</td>
                  <td style={{ width: 200 }}>{t.complexity.some(Boolean) ? <Distribution parts={t.complexity} /> : <span className="muted">—</span>}</td>
                  <td><Spark values={t.trend} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="legend">{CX.slice(1).map((c, i) => <span key={c}><i style={{ background: `var(--viz-${i + 1})` }} />{c}</span>)}</div>
      </section>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
        <section className="section"><AttentionList items={attention} /></section>
      </div>
      <section className="section">
        <div className="section-head"><h2>Employee activity</h2><span className="meta">Alphabetical · not a ranking</span><div className="right"><Link className="btn btn-ghost btn-sm" href="/performance/overview">Performance</Link></div></div>
        <PeopleTable list={members.filter((p) => p.role !== "security_manager")} />
      </section>
    </div>
  );
}

const PERIODS = [["this", "This Month"], ["last", "Last Month"], ["quarter", "Quarter"]];

/** Controlled period selector. With `custom`, adds a from/to range. */
export function PeriodSelector({ value = "this", onChange, custom, range, onRange }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div className="seg" role="tablist" aria-label="Period">
        {PERIODS.map(([k, l]) => <button key={k} className={value === k ? "on" : ""} role="tab" aria-selected={value === k} onClick={() => onChange?.(k)}>{l}</button>)}
        {custom && <button className={value === "custom" ? "on" : ""} role="tab" aria-selected={value === "custom"} onClick={() => onChange?.("custom")}><Icon name="cal" />Custom</button>}
      </div>
      {custom && value === "custom" && (
        <>
          <input type="date" className="input" style={{ width: 150, height: 28 }} value={range?.from ?? ""} onChange={(e) => onRange?.({ ...range, from: e.target.value })} aria-label="From" />
          <input type="date" className="input" style={{ width: 150, height: 28 }} value={range?.to ?? ""} onChange={(e) => onRange?.({ ...range, to: e.target.value })} aria-label="To" />
        </>
      )}
    </div>
  );
}

export const periodQuery = (period, range) => (period === "custom" && range?.from && range?.to ? `period=custom&from=${range.from}&to=${range.to}` : `period=${period === "custom" ? "this" : period}`);
