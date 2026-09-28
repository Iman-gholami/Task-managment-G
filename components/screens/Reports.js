"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { Complexity, EmptyState, Quality, Who } from "@/components/ui/indicators";
import { peopleItems } from "@/components/ui/menus";
import { P, ticketLog } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { REPORTS } from "@/lib/reports";


const TASK_ROWS = [
  ["Automate daily blocklist diff", "Python script, peer reviewed", "excellent", "Sep 14 09:00", "Sep 22 16:30", 16, 4],
  ["Tune Splunk rule: brute-force on OWA", "Reduced FP rate by 70%", "good", "Sep 10 10:15", "Sep 16 14:00", 11.5, 3],
  ["Phishing campaign IOC sweep", "Swept 1,200 mailboxes", "good", "Sep 08 08:30", "Sep 09 12:00", 5, 2],
  ["Onboard new L1 analyst", "Walkthrough of shift log", "excellent", "Sep 23 09:00", "Sep 25 11:00", 2, 1],
];

const SHIFT_MATRIX = [["sr", 19, 97.5, [100, 100, 95, 100, 100, 90, 100, 95], 142, 23, 4, 19], ["am", 20, 99.4, [100, 100, 100, 100, 100, 95, 100, 100], 131, 19, 2, 20], ["nk", 17, 86.0, [94, 88, 82, 88, 94, 76, 88, 82], 96, 12, 1, 15], ["rj", 18, 95.1, [100, 94, 94, 100, 94, 89, 94, 100], 117, 17, 3, 18]];

export default function Reports({ report }) {
  const cur = REPORTS.find((r) => r[0] === report) || REPORTS[0];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", height: "100%" }}>
      <nav style={{ borderRight: "1px solid var(--divider)", padding: "20px 12px" }} aria-label="Reports">
        {REPORTS.map(([k, n]) => <Link key={k} className={`nav-item ${k === cur[0] ? "active" : ""}`} href={`/reports/${k}`}><span>{n}</span></Link>)}
      </nav>
      <div className="page" style={{ minWidth: 0 }}>
        {cur[0] === "tickets" ? <TicketReport /> : cur[0] === "shift" ? <ShiftReport cur={cur} /> : <TaskReport cur={cur} />}
      </div>
    </div>
  );
}

function ExportButton({ file }) {
  const { toast } = useApp();
  return <button className="btn btn-primary" onClick={() => toast(`Exported · ${file}`)}><Icon name="xls" />Export to Excel</button>;
}

function Head({ title, sub, file }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1><p>{sub}</p></div>
      <div className="actions"><ExportButton file={file} /></div>
    </div>
  );
}

function TaskReport({ cur }) {
  return (
    <>
      <Head title={cur[1]} sub={cur[2]} file="Employee_Monthly_Sep2026.xlsx" />
      <div className="toolbar">
        <button className="chip active"><Icon name="cal" />Date range <b>Sep 1 – Sep 30</b></button>
        <button className="chip active">Employee <b>Sara Rahimi</b><span className="x"><Icon name="x" /></span></button>
        <button className="chip"><Icon name="plus" />Team</button><button className="chip"><Icon name="plus" />Task Status</button>
        <button className="chip"><Icon name="plus" />Complexity</button><button className="chip"><Icon name="plus" />Quality</button>
        <button className="btn btn-ghost btn-sm">Reset</button>
      </div>
      <div className="section-head" style={{ marginTop: 12 }}><h2>Tasks</h2><span className="meta">{TASK_ROWS.length} rows</span></div>
      <table className="dt">
        <thead><tr><th>Task Title</th><th>Work Description</th><th>Quality</th><th>Start Time</th><th>End Time</th><th className="r">Hours</th><th>Executor</th><th>Complexity</th></tr></thead>
        <tbody>
          {TASK_ROWS.map(([t, d, q, s, e, h, c]) => (
            <tr key={t}><td className="title">{t}</td><td>{d}</td><td><Quality q={q} /></td><td className="num">{s}</td><td className="num">{e}</td><td className="r num">{h.toFixed(1)}</td><td><Who id="sr" /></td><td><Complexity c={c} /></td></tr>
          ))}
        </tbody>
      </table>
      {cur[0] === "employee" && (
        <>
          <div className="section-head" style={{ marginTop: 28 }}><h2>Routine Activity</h2><span className="meta">SOC employees only</span></div>
          <div className="metrics" style={{ margin: 0 }}>
            {[["Shift logs", "19"], ["Routine completion", "97.5%"], ["MISP IOCs", "142"], ["Tickets", "23"], ["Traffic reports", "19"], ["Issues reported", "4"]].map(([l, v]) => <div key={l} className="metric"><div className="l">{l}</div><div className="v">{v}</div></div>)}
          </div>
        </>
      )}
    </>
  );
}

function ShiftReport({ cur }) {
  return (
    <>
      <Head title={cur[1]} sub={cur[2]} file="SOC_Shift_Activity_Sep2026.xlsx" />
      <div className="toolbar"><button className="chip active"><Icon name="cal" />Date range <b>Sep 1 – Sep 30</b></button><button className="chip"><Icon name="plus" />Analyst</button><button className="chip"><Icon name="plus" />Layer</button></div>
      <div className="table-wrap">
        <table className="dt">
          <thead><tr><th>Analyst</th><th className="r">Shift logs</th><th className="r">Completion</th>{Array.from({ length: 8 }, (_, i) => <th key={i} className="r" title={`Activity ${i + 1}`}>#{i + 1}</th>)}<th className="r">IOCs</th><th className="r">Tickets</th><th className="r">Issues</th><th className="r">Traffic reports</th></tr></thead>
          <tbody>
            {SHIFT_MATRIX.map(([id, logs, pct, acts, iocs, tix, issues, rep]) => (
              <tr key={id}>
                <td className="title"><Who id={id} /></td><td className="r num">{logs}</td>
                <td className="r num" style={pct < 90 ? { color: "var(--warning)" } : undefined}>{pct.toFixed(1)}%</td>
                {acts.map((v, i) => <td key={i} className="r num" style={v < 90 ? { color: "var(--warning)" } : { color: "var(--text-3)" }}>{v}</td>)}
                <td className="r num">{iocs}</td><td className="r num">{tix}</td><td className="r num">{issues}</td><td className="r num">{rep}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Activity columns show the done-rate (%) of each routine activity across the analyst&apos;s shifts. Values under 90% are highlighted.</p>
    </>
  );
}

function TicketReport() {
  const { openPopover } = useApp();
  const [q, setQ] = useState("");
  const [analyst, setAnalyst] = useState(null);
  const rows = useMemo(
    () => ticketLog.filter((r) => (!analyst || r[0] === analyst) && (r[2] + r[3] + r[4]).toLowerCase().includes(q.toLowerCase())),
    [q, analyst]
  );
  return (
    <>
      <Head title="Ticket Report" sub={`${rows.length} tickets · Sep 2026`} file="Ticket_Report_Sep2026.xlsx" />
      <div className="toolbar">
        <div className="search"><Icon name="search" /><input className="input" placeholder="Search ticket number or description" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {analyst
          ? <button className="chip active" onClick={() => setAnalyst(null)}>Analyst is <b>{P[analyst].name}</b><span className="x"><Icon name="x" /></span></button>
          : <button className="chip" onClick={(e) => openPopover(e.currentTarget, { title: "Analyst", items: peopleItems(), onPick: setAnalyst, width: 320 })}><Icon name="plus" />Analyst</button>}
        <button className="chip active"><Icon name="cal" />Date <b>Sep 2026</b></button>
        {(q || analyst) && <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setAnalyst(null); }}>Reset</button>}
      </div>
      {rows.length ? (
        <table className="dt">
          <thead><tr><th>Analyst</th><th className="sorted">Date ↓</th><th>Ticket Number</th><th>Related Reference</th><th>Description</th></tr></thead>
          <tbody>
            {rows.map(([a, d, n, r, ds]) => (
              <tr key={n}><td><Who id={a} /></td><td className="num">{fmtDate(d)}</td><td className="mono" style={{ color: "var(--text)" }}>{n}</td><td className="mono">{r}</td><td>{ds}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={<Icon name="report" />} title="No tickets found">No tickets were registered for these filters.</EmptyState>
      )}
    </>
  );
}
