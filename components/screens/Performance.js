"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { PeriodSelector } from "@/components/screens/Dashboard";
import Icon from "@/components/ui/Icon";
import { Avatar, Complexity, Distribution, Quality, Spark, Status, Who } from "@/components/ui/indicators";
import { completedWork, people, ticketLog } from "@/lib/data";
import { fmtDate } from "@/lib/format";

function ExportButton() {
  const { toast } = useApp();
  return <button className="btn btn-primary" onClick={() => toast("Exported · Employee_Monthly_Sara_Rahimi_Sep2026.xlsx")}><Icon name="xls" />Export to Excel</button>;
}

export function EmployeePerformance() {
  const { openPopover } = useApp();
  const router = useRouter();
  const showTickets = (e) =>
    openPopover(e.currentTarget, {
      title: "Tickets created · Sep",
      items: [
        ...ticketLog.filter((r) => r[0] === "sr").map((r) => ({ value: r[2], label: <><span className="mono">{r[2]}</span><span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>{fmtDate(r[1])}</span></> })),
        { value: "__report", label: <>Open Ticket Report <Icon name="chev" /></> },
      ],
      onPick: () => router.push("/reports/tickets"),
    });

  const routine = [["Shift logs", "19 / 20", "1 incomplete (Sep 23)"], ["Routine completion", "97.5%", "156 of 160 activities"], ["MISP IOCs", "142", "7.5 per shift avg"], ["Tickets created", "23", "View ticket numbers"], ["Daily traffic reports", "19", "All attached as .docx"]];

  return (
    <div className="page narrow">
      <div className="page-head">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Avatar id="sr" size="lg" />
          <div><h1>Sara Rahimi</h1><p>Analyst · SOC Layer 1 · Reports to Leila Nouri</p></div>
        </div>
        <div className="actions"><PeriodSelector custom /><ExportButton /></div>
      </div>
      <p className="muted" style={{ margin: "-12px 0 20px", fontSize: 12 }}>Period: Sep 1 – Sep 28, 2026 · 20 working days</p>

      <div className="metrics">
        <div className="metric"><div className="l">Completed tasks</div><div className="v">11</div></div>
        <div className="metric"><div className="l">Task hours</div><div className="v">62.5</div></div>
        <div className="metric"><div className="l">Shift logs completed</div><div className="v">19<span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>/20</span></div></div>
        <div className="metric"><div className="l">MISP IOCs</div><div className="v">142</div></div>
        <div className="metric link" role="button" tabIndex={0} onClick={showTickets}><div className="l">Tickets created <Icon name="chev" /></div><div className="v">23</div></div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Routine Activity</h2><span className="badge">Shift Logs</span><span className="meta">Daily operational work — counted separately from tasks</span>
          <div className="right"><Link className="btn btn-ghost btn-sm" href="/shift/history">Daily logs <Icon name="chev" /></Link></div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: 0 }}>
          {routine.map(([l, v, s], i) => (
            <div key={l} style={{ padding: i ? "4px 18px" : "4px 18px 4px 0", borderLeft: i ? "1px solid var(--divider)" : 0 }}>
              <div className="muted" style={{ fontSize: 12 }}>{l}</div>
              <div style={{ font: "600 18px var(--font-sans)", margin: "4px 0" }} className="num">{v}</div>
              <div className="sec" style={{ fontSize: 12 }}>{s}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>IOCs per shift</div>
          <Spark values={[4, 7, 5, 9, 2, 6, 5, 3, 8, 6, 4, 5, 11, 9, 7, 8, 10, 6, 7]} width={960} height={36} />
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Task Performance</h2><span className="badge primary">Tasks</span><span className="meta">Project &amp; improvement work</span></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 18 }}>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Complexity of completed work</div>
            <Distribution parts={[4, 3, 3, 1]} />
            <div className="legend">{[["Simple", 4], ["Medium", 3], ["Complex", 3], ["Advanced", 1]].map(([c, n], i) => <span key={c}><i style={{ background: `var(--viz-${i + 1})` }} />{c} <b className="num" style={{ color: "var(--text)" }}>{n}</b></span>)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Quality of completed work</div>
            <div style={{ display: "flex", gap: 24, fontSize: 13 }}>{[["Excellent", 4], ["Good", 5], ["Acceptable", 2], ["Needs Improvement", 0]].map(([q, n]) => <span key={q} className="sec">{q} <b className="num" style={{ color: "var(--text)" }}>{n}</b></span>)}</div>
          </div>
        </div>
        <table className="dt">
          <thead><tr><th>Task</th><th>Description</th><th>Complexity</th><th>Quality</th><th>Start</th><th>End</th><th className="r">Hours</th><th>Status</th></tr></thead>
          <tbody>
            {completedWork.map(([t, d, c, q, s, e, h]) => (
              <tr key={t}>
                <td className="title">{t}</td><td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>{d}</td>
                <td><Complexity c={c} /></td><td><Quality q={q} /></td><td className="num">{s}</td><td className="num">{e}</td><td className="r num">{h.toFixed(1)}</td><td><Status s="done" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function PerformanceOverview() {
  const router = useRouter();
  const rows = [...people].filter((p) => p.role !== "Security Manager").sort((a, b) => a.name.localeCompare(b.name));
  const stats = { sr: [11, 62.5, 19, 142, 23], am: [9, 71, 20, 131, 19], nk: [6, 38, 17, 96, 12], rj: [8, 55, 18, 117, 17], ms: [14, 118], hb: [7, 64], ln: [5, 40] };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Performance Overview</h1><p>September 2026 · all teams</p></div>
        <div className="actions"><PeriodSelector /><ExportButton /></div>
      </div>
      <div className="metrics">
        <div className="metric"><div className="l">Tasks completed</div><div className="v">102</div></div>
        <div className="metric"><div className="l">Task hours</div><div className="v">1,284</div></div>
        <div className="metric"><div className="l">Shift logs</div><div className="v">231</div></div>
        <div className="metric"><div className="l">MISP IOCs</div><div className="v">486</div></div>
        <div className="metric"><div className="l">Tickets</div><div className="v">71</div></div>
      </div>
      <div className="toolbar"><div className="search"><Icon name="search" /><input className="input" placeholder="Search employee" /></div><button className="chip active">Team is <b>All</b></button></div>
      <table className="dt">
        <thead><tr><th>Employee</th><th>Team</th><th className="r">Tasks done</th><th className="r">Hours</th><th>Complexity mix</th><th className="r">Shift logs</th><th className="r">IOCs</th><th className="r">Tickets</th><th /></tr></thead>
        <tbody>
          {rows.map((p, i) => {
            const s = stats[p.id] || [0, 0];
            const na = <span className="muted">n/a</span>;
            return (
              <tr key={p.id} onClick={() => router.push("/performance/employees")}>
                <td className="title"><Who id={p.id} /></td><td>{p.team}</td>
                <td className="r num">{s[0]}</td><td className="r num">{s[1]}</td>
                <td style={{ width: 180 }}><Distribution parts={[4 - (i % 3), 3, 2 + (i % 2), 1]} /></td>
                <td className="r num">{s[2] ?? na}</td><td className="r num">{s[3] ?? na}</td><td className="r num">{s[4] ?? na}</td>
                <td className="r"><Icon name="chev" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Sorted alphabetically. Metrics describe output, not rank; there is no leaderboard view.</p>
    </div>
  );
}
