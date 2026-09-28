"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import { PeriodSelector, periodQuery } from "@/components/screens/Dashboard";
import { TableSkeleton } from "@/components/screens/Misc";
import Icon from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/indicators";
import { CX, QUAL, STATUS } from "@/lib/format";
import { REPORTS } from "@/lib/reports";
import { isManager } from "@/lib/roles";

// Which filters each report offers.
const FILTERS = {
  employee: ["user"],
  team: ["team"],
  task: ["user", "team", "status", "cx", "quality"],
  shift: ["user"],
  tickets: ["user", "q"],
};
const TEAMS = ["SOC", "Design & Automation", "Threat Intelligence"];

export default function Reports({ report }) {
  const { me, members } = useApp();
  const params = useSearchParams();
  const manager = isManager(me);
  const cur = REPORTS.find((r) => r[0] === report) || REPORTS[0];
  const key = cur[0];
  const [period, setPeriod] = useState("this");
  const [range, setRange] = useState({ from: "", to: "" });
  const [f, setF] = useState({ user: params.get("user") ?? (key === "employee" ? me.id : ""), team: "", status: "", cx: "", quality: "", q: "" });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const show = (k) => FILTERS[key].includes(k) && (k !== "user" || manager);
  const reportsFor = manager ? REPORTS : REPORTS.filter(([k]) => k !== "team");

  const qs = [periodQuery(period, range), ...Object.entries(f).filter(([k, v]) => v && FILTERS[key].includes(k)).map(([k, v]) => `${k}=${encodeURIComponent(v)}`)].join("&");
  const { data, loading, error, reload } = useFetch(`/api/reports/${key}?${qs}`);
  const people = key === "shift" || key === "tickets" ? members.filter((m) => m.shift !== null) : members.filter((m) => m.role !== "security_manager");
  const filtered = Object.entries(f).some(([k, v]) => v && FILTERS[key].includes(k) && !(k === "user" && key === "employee"));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", height: "100%" }}>
      <nav style={{ borderRight: "1px solid var(--divider)", padding: "20px 12px" }} aria-label="Reports">
        {reportsFor.map(([k, n]) => <Link key={k} className={`nav-item ${k === key ? "active" : ""}`} href={`/reports/${k}`}><span>{n}</span></Link>)}
      </nav>
      <div className="page" style={{ minWidth: 0 }}>
        <div className="page-head">
          <div><h1>{cur[1]}</h1><p>{cur[2]}</p></div>
          <div className="actions">
            <a className="btn btn-primary" href={`/api/reports/${key}?${qs}&format=xlsx`} download data-testid="export"><Icon name="xls" />Export to Excel</a>
          </div>
        </div>
        <div className="toolbar" style={{ gap: 8 }}>
          <PeriodSelector value={period} onChange={setPeriod} custom range={range} onRange={setRange} />
          {show("user") && (
            <select className="input" style={{ width: 180, height: 28 }} value={f.user} onChange={set("user")} aria-label="Employee">
              {key !== "employee" && <option value="">All employees</option>}
              {people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          {show("team") && <select className="input" style={{ width: 170, height: 28 }} value={f.team} onChange={set("team")} aria-label="Team"><option value="">All teams</option>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>}
          {show("status") && <select className="input" style={{ width: 140, height: 28 }} value={f.status} onChange={set("status")} aria-label="Task status"><option value="">Any status</option>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
          {show("cx") && <select className="input" style={{ width: 140, height: 28 }} value={f.cx} onChange={set("cx")} aria-label="Complexity"><option value="">Any complexity</option>{CX.slice(1).map((c, i) => <option key={c} value={i + 1}>{c}</option>)}</select>}
          {show("quality") && <select className="input" style={{ width: 170, height: 28 }} value={f.quality} onChange={set("quality")} aria-label="Quality"><option value="">Any quality</option>{Object.entries(QUAL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
          {show("q") && <div className="search"><Icon name="search" /><input className="input" placeholder="Search ticket number or description" value={f.q} onChange={set("q")} /></div>}
          {filtered && <button className="btn btn-ghost btn-sm" onClick={() => setF((x) => ({ ...x, team: "", status: "", cx: "", quality: "", q: "", user: key === "employee" ? x.user : "" }))}>Reset</button>}
        </div>
        {data && <p className="muted" style={{ fontSize: 12, margin: "4px 0 12px" }}>Period {data.period.from} – {data.period.to}</p>}

        {loading && !data ? <TableSkeleton rows={8} /> : error ? (
          <EmptyState danger icon={<Icon name="alert" />} title="Couldn't load the report" action={<button className="btn btn-secondary btn-sm" onClick={reload}>Retry</button>}>{error}</EmptyState>
        ) : data?.sheets.map((s) => (
          <section key={s.name} className="section">
            <div className="section-head"><h2>{s.name}</h2><span className="meta">{s.rows.length} rows</span></div>
            {s.rows.length === 0 ? <EmptyState icon={<Icon name="report" />} title="Nothing to report">No activity was found for the selected period.</EmptyState> : (
              <div className="table-wrap">
                <table className="dt">
                  <thead><tr>{s.columns.map((c) => <th key={c.key} className={c.num ? "r" : ""} title={c.header}>{c.short ?? c.header}</th>)}</tr></thead>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr key={i} style={{ cursor: "default" }}>
                        {s.columns.map((c, j) => (
                          <td key={c.key} className={`${c.num ? "r num" : ""} ${j === 0 ? "title" : ""} ${c.key === "no" || c.key === "ref" ? "mono" : ""}`} style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r[c.key] === "" || r[c.key] == null ? <span className="muted">—</span> : String(r[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.summary && <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 13 }} className="sec">{s.summary.map(([k, v]) => <span key={k}>{k} <b className="num" style={{ color: "var(--text)" }}>{v}</b></span>)}</div>}
          </section>
        ))}
      </div>
    </div>
  );
}
