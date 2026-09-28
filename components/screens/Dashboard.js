"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import TaskTable from "@/components/TaskTable";
import Icon from "@/components/ui/Icon";
import { Avatar, Distribution, Spark } from "@/components/ui/indicators";
import { P, people } from "@/lib/data";
import { CX, TODAY, isOpen } from "@/lib/format";
import { PeopleTable } from "@/components/screens/Team";

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

function AnalystDashboard() {
  const { tasks, activities, tickets } = useApp();
  const mine = tasks.filter((t) => t.a === "sr" && isOpen(t)).sort((a, b) => (a.due > b.due ? 1 : -1));
  const overdue = mine.filter((t) => t.due < TODAY).length;
  const dueSoon = mine.filter((t) => t.due >= TODAY && t.due <= "2026-09-30").length;
  const inReview = mine.filter((t) => t.status === "review").length;
  const done = activities.filter((a) => a.done).length;
  const remaining = activities.filter((a) => !a.done);
  const iocs = activities.find((a) => a.kind === "misp").iocs;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Good morning, Sara</h1><p>Monday, Sep 28 · Day shift 07:00–15:00</p></div>
        <div className="actions"><CreateButton /><Link className="btn btn-primary" href="/shift">Continue Shift Log</Link></div>
      </div>

      <div className="metrics">
        <Link className="metric link" href="/tasks/my"><div className="l">Assigned to me</div><div className="v">{mine.length}</div></Link>
        <div className="metric"><div className="l">Due in 48h</div><div className="v">{dueSoon}</div></div>
        <div className={`metric ${overdue ? "alert" : ""}`}><div className="l">Overdue</div><div className="v">{overdue}</div></div>
        <div className="metric"><div className="l">Awaiting review</div><div className="v">{inReview}</div></div>
        <div className="metric"><div className="l">Completed · Sep</div><div className="v">11 <span className="d up">+3</span></div></div>
        <div className="metric"><div className="l">MISP IOCs · Sep</div><div className="v">142</div></div>
        <div className="metric"><div className="l">Tickets · Sep</div><div className="v">23</div></div>
      </div>

      <div className="grid g-main">
        <section>
          <div className="section-head"><h2>My work queue</h2><span className="meta">Sorted by deadline</span><div className="right"><Link className="btn btn-ghost btn-sm" href="/tasks/my">View all</Link></div></div>
          <TaskTable list={mine} cols={["title", "status", "prio", "due"]} compact />
        </section>
        <aside>
          <div className="panel" style={{ padding: "16px 18px" }}>
            <div className="section-head" style={{ marginBottom: 12 }}><h2>Today&apos;s Shift Log</h2><span className="badge primary" style={{ marginLeft: "auto" }}>In progress</span></div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ font: "600 24px var(--font-sans)" }} className="num">{done}/{activities.length}</span><span className="sec">activities done</span></div>
            <div className="progress" style={{ margin: "10px 0 14px" }}><span style={{ width: `${(done / activities.length) * 100}%` }} /></div>
            <div style={{ fontSize: 13, display: "grid", gap: 8 }}>
              <Row k="Remaining" v={remaining.length ? remaining.map((a) => a.title).join(", ") : "None"} />
              <Row k="IOCs added" v={iocs} />
              <Row k="Tickets" v={tickets.length} />
              <Row k="Last saved" v="09:42" />
            </div>
            <Link className="btn btn-secondary" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} href="/shift">Open Shift Log</Link>
          </div>
          <div style={{ marginTop: 24 }}>
            <div className="section-head"><h2>Recent activity</h2></div>
            {[["am", "requested changes on", "T-1033", "1h"], ["ln", "assigned you", "T-1042", "3h"], ["rj", "mentioned you in", "T-1038", "yesterday"]].map(([p, a, t, w]) => (
              <div key={t} className="activity" style={{ border: 0, margin: 0, padding: "6px 0" }}>
                <Avatar id={p} />
                <span><span style={{ color: "var(--text)" }}>{P[p].name}</span> {a} <Link className="mono" style={{ color: "var(--text-2)" }} href={`/tasks/${t}`}>{t}</Link></span>
                <span style={{ marginLeft: "auto" }}>{w}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="sec" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
    <span>{k}</span><span className="num" style={{ color: "var(--text)", textAlign: "right" }}>{v}</span>
  </div>
);

function SocDashboard() {
  const soc = people.filter((p) => p.team.startsWith("SOC ·") || p.assist);
  const attention = [
    ["alert", "danger", "Neda Karimi has not started today's Shift Log", "Remind"],
    ["flag", "danger", "T-1039 is 1 day overdue · Mina Sadeghi", "Open", "/tasks/T-1039"],
    ["tasks", "violet", "T-1041 awaiting review · Arash Moradi", "Review", "/tasks/T-1041"],
    ["tasks", "violet", "T-1044 awaiting review · Reza Jafari", "Review"],
    ["alert", "warning", "1 issue reported: Sensor S-04 stopped reporting", "View", "/shift"],
  ];
  const { toast } = useApp();
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>SOC overview</h1><p>Monday, Sep 28 · 4 analysts on shift</p></div>
        <div className="actions"><Link className="btn btn-secondary" href="/reports">Reports</Link><CreateButton primary /></div>
      </div>
      <div className="metrics">
        <div className="metric"><div className="l">Active team tasks</div><div className="v">24</div></div>
        <div className="metric alert"><div className="l">Overdue</div><div className="v">3</div></div>
        <div className="metric"><div className="l">Awaiting your review</div><div className="v">4</div></div>
        <div className="metric"><div className="l">Shift completion today</div><div className="v">78%</div></div>
        <div className="metric"><div className="l">MISP IOCs · Sep</div><div className="v">486 <Spark values={[12, 18, 15, 22, 19, 25, 21]} width={56} height={20} /></div></div>
        <div className="metric"><div className="l">Tickets · Sep</div><div className="v">71 <Spark values={[4, 3, 5, 2, 6, 4, 5]} width={56} height={20} /></div></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <section>
          <div className="section-head"><h2>Needs your attention</h2><span className="meta">{attention.length} items</span></div>
          <div className="panel" style={{ padding: "4px 14px" }}>
            {attention.map(([i, c, t, a, href]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, height: 44, borderBottom: "1px solid var(--divider)" }}>
                <span style={{ color: `var(--${c})` }}><Icon name={i} /></span>
                <span style={{ flex: 1 }}>{t}</span>
                {href ? <Link className="btn btn-ghost btn-sm" href={href}>{a}</Link> : <button className="btn btn-ghost btn-sm" onClick={() => toast(a === "Remind" ? "Reminder sent to Neda Karimi" : "Opening review…")}>{a}</button>}
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="section-head"><h2>Team workload</h2><span className="meta">Open work vs capacity</span></div>
          {soc.map((p) => (
            <div key={p.id} className="hbar">
              <span className="who"><Avatar id={p.id} />{p.name.split(" ")[0]}{p.assist && <span className="badge" title="Assisting from Design & Automation">assist</span>}</span>
              <div className="track"><span style={{ width: `${p.load}%`, background: p.load > 90 ? "var(--warning)" : "var(--primary)" }} /></div>
              <span className="num sec" style={{ textAlign: "right" }}>{p.load}%</span>
            </div>
          ))}
          <div className="section-head" style={{ marginTop: 28 }}><h2>Today&apos;s shift logs</h2></div>
          {soc.filter((p) => p.shift).map((p) => (
            <div key={p.id} className="hbar">
              <span className="who"><Avatar id={p.id} />{p.name.split(" ")[0]}</span>
              <div className="track"><span style={{ width: `${{ active: 75, completed: 100, missing: 0 }[p.shift]}%`, background: "var(--success)" }} /></div>
              <span style={{ textAlign: "right" }}>
                {p.shift === "missing" ? <span className="badge danger">Missing</span> : p.shift === "completed" ? <span className="badge success">Done</span> : <span className="num sec">6/8</span>}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function SecurityDashboard() {
  const teams = [["SOC", 64, 22, 3, [40, 48, 52, 58, 61, 64], [4, 3, 2, 1]], ["Design & Automation", 21, 9, 1, [14, 17, 19, 18, 22, 21], [2, 3, 3, 2]], ["Threat Intelligence", 17, 6, 0, [12, 13, 15, 14, 16, 17], [3, 4, 2, 1]]];
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Security Department</h1><p>September 2026 · 3 teams · 18 people</p></div>
        <div className="actions"><PeriodSelector /><Link className="btn btn-primary" href="/reports/team"><Icon name="xls" />Export</Link></div>
      </div>
      <div className="metrics">
        <div className="metric"><div className="l">Work completed</div><div className="v">102 <span className="d up">+12%</span></div></div>
        <div className="metric"><div className="l">Active tasks</div><div className="v">37</div></div>
        <div className="metric alert"><div className="l">Overdue</div><div className="v">4</div></div>
        <div className="metric"><div className="l">Task hours logged</div><div className="v">1,284</div></div>
        <div className="metric"><div className="l">Shift log compliance</div><div className="v">96%</div></div>
      </div>
      <section className="section">
        <div className="section-head"><h2>Team comparison</h2><span className="meta">Completed tasks · 6-month trend</span></div>
        <table className="dt">
          <thead><tr><th>Team</th><th className="r">Completed</th><th className="r">Active</th><th className="r">Overdue</th><th>Complexity mix</th><th>Trend</th></tr></thead>
          <tbody>
            {teams.map(([n, c, a, o, tr, mix]) => (
              <tr key={n}>
                <td className="title">{n}</td><td className="r num">{c}</td><td className="r num">{a}</td>
                <td className="r num">{o ? <span className="overdue">{o}</span> : <span className="muted">0</span>}</td>
                <td style={{ width: 220 }}><Distribution parts={mix} /></td>
                <td><Spark values={tr} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="legend">{CX.slice(1).map((c, i) => <span key={c}><i style={{ background: `var(--viz-${i + 1})` }} />{c}</span>)}</div>
      </section>
      <section className="section">
        <div className="section-head"><h2>Employee activity</h2><span className="meta">Alphabetical · not a ranking</span><div className="right"><Link className="btn btn-ghost btn-sm" href="/team">Directory</Link></div></div>
        <PeopleTable list={[...people].filter((p) => p.role !== "Security Manager").sort((a, b) => a.name.localeCompare(b.name))} />
      </section>
    </div>
  );
}

export function PeriodSelector({ custom }) {
  const { toast } = useApp();
  const opts = ["This Month", "Last Month", "Quarter"];
  return (
    <div className="seg" role="tablist" aria-label="Period">
      {opts.map((o, i) => <button key={o} className={i === 0 ? "on" : ""} role="tab" aria-selected={i === 0} onClick={() => i && toast(`${o}: demo data shows September only`)}>{o}</button>)}
      {custom && <button onClick={() => toast("Custom range picker")}><Icon name="cal" />Custom</button>}
    </div>
  );
}
