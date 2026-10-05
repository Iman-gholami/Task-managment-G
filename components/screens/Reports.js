"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import PeriodSelector from "@/components/PeriodSelector";
import Icon from "@/components/ui/Icon";
import { PageHeader, Panel } from "@/components/ui/layout";
import { EmptyState, ErrorState, Loading } from "@/components/ui/states";
import { CX, QUAL, STATUS, fmtRange, plural } from "@/lib/format";
import { periodQuery } from "@/lib/period";
import { REPORTS } from "@/lib/reports";
import { inReportScope, isManager } from "@/lib/roles";
import WorkforceReport from "@/components/screens/WorkforceReport";

// Which filters each report offers.
const FILTERS = {
  employee: ["user"],
  team: ["team"],
  task: ["user", "team", "status", "cx", "quality"],
  shift: ["user"],
  tickets: ["user", "q"],
};
const TEAMS = ["SOC", "Design & Automation", "Threat Intelligence"];
const PAGE_SIZE = 100;

export default function Reports({ report }) {
  const key = (REPORTS.find((r) => r[0] === report) || REPORTS[0])[0];
  return (
    <div className="split">
      <ReportNav current={key} />
      {key === "workforce" ? <WorkforceReport /> : <SheetReport report={key} />}
    </div>
  );
}

function ReportNav({ current }) {
  const { me } = useApp();
  const reportsFor = isManager(me) ? REPORTS : REPORTS.filter(([k]) => k !== "team");
  return (
    <nav className="split-nav" aria-label="Reports">
      <div className="nav-label">Reports</div>
      {reportsFor.map(([k, n]) => (
        <Link key={k} className={`nav-item ${k === current ? "active" : ""}`} href={`/reports/${k}`} aria-current={k === current ? "page" : undefined}>
          <span className="label">{n}</span>
        </Link>
      ))}
    </nav>
  );
}

/** A report shown as its sheets: the same columns as its Excel export. */
function SheetReport({ report: key }) {
  const { me, members } = useApp();
  const params = useSearchParams();
  const manager = isManager(me);
  const cur = REPORTS.find((r) => r[0] === key);
  const [period, setPeriod] = useState("this");
  const [range, setRange] = useState({ from: "", to: "" });
  const [f, setF] = useState({ user: params.get("user") ?? (key === "employee" ? me.id : ""), team: "", status: "", cx: "", quality: "", q: "" });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const show = (k) => FILTERS[key].includes(k) && (k !== "user" || manager);

  const qs = [periodQuery(period, range), ...Object.entries(f).filter(([k, v]) => v && FILTERS[key].includes(k)).map(([k, v]) => `${k}=${encodeURIComponent(v)}`)].join("&");
  const { data, loading, error, reload } = useFetch(`/api/reports/${key}?${qs}`);
  const inScope = members.filter((m) => inReportScope(me, m));
  const people = key === "shift" || key === "tickets" ? inScope.filter((m) => m.shift !== null) : inScope.filter((m) => m.role !== "security_manager");
  const teams = me.role === "soc_manager" ? ["SOC"] : TEAMS;
  const activeFilters = Object.entries(f).filter(([k, v]) => v && FILTERS[key].includes(k) && !(k === "user" && key === "employee")).length;
  const reset = () => setF((x) => ({ ...x, team: "", status: "", cx: "", quality: "", q: "", user: key === "employee" ? x.user : "" }));
  const sel = (k, v) => `input ${v ? "is-set" : ""}`;

  return (
    <div className="page">
      <PageHeader
        title={cur[1]}
        meta={[cur[2], data ? fmtRange(data.period.from, data.period.to) : null]}
        actions={
          <a className="btn btn-primary" href={`/api/reports/${key}?${qs}&format=xlsx`} download data-testid="export" data-tooltip="Same filters and period as the preview below">
            <Icon name="download" />Export to Excel
          </a>
        }
      />
      <div className="toolbar" role="search" aria-label="Report filters">
        <PeriodSelector value={period} onChange={setPeriod} custom range={range} onRange={setRange} />
        {show("user") && (
          <select className={sel("user", f.user && key !== "employee")} style={{ width: 190 }} value={f.user} onChange={set("user")} aria-label="Employee">
            {key !== "employee" && <option value="">All employees</option>}
            {people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        {show("team") && <select className={sel("team", f.team)} style={{ width: 180 }} value={f.team} onChange={set("team")} aria-label="Team"><option value="">All teams</option>{teams.map((t) => <option key={t}>{t}</option>)}</select>}
        {show("status") && <select className={sel("status", f.status)} style={{ width: 150 }} value={f.status} onChange={set("status")} aria-label="Task status"><option value="">Any status</option>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
        {show("cx") && <select className={sel("cx", f.cx)} style={{ width: 160 }} value={f.cx} onChange={set("cx")} aria-label="Complexity"><option value="">Any complexity</option>{CX.slice(1).map((c, i) => <option key={c} value={i + 1}>{c}</option>)}</select>}
        {show("quality") && <select className={sel("quality", f.quality)} style={{ width: 180 }} value={f.quality} onChange={set("quality")} aria-label="Quality"><option value="">Any quality</option>{Object.entries(QUAL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
        {show("q") && <div className="search"><Icon name="search" /><input type="search" className="input" placeholder="Ticket number or description" aria-label="Search tickets" value={f.q} onChange={set("q")} /></div>}
        {activeFilters > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={reset}><Icon name="x" />Reset filters ({activeFilters})</button>}
      </div>

      {loading && !data ? <div className="panel"><Loading label="Loading report" rows={8} /></div> : error ? (
        <div className="panel"><ErrorState error={error} title="Couldn't load the report" onRetry={reload} /></div>
      ) : (
        <div className="stack-lg">
          {data?.sheets.map((s) => <Sheet key={s.name} sheet={s} filtered={activeFilters > 0} onReset={reset} />)}
        </div>
      )}
    </div>
  );
}

/** One report sheet: the same columns as the Excel export, paginated above 100 rows. */
function Sheet({ sheet: s, filtered, onReset }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(s.rows.length / PAGE_SIZE));
  const at = Math.min(page, pages - 1);
  const rows = s.rows.slice(at * PAGE_SIZE, (at + 1) * PAGE_SIZE);
  const summary = s.summary && <div className="legend">{s.summary.map(([k, v]) => <span key={k}>{k} <b>{v}</b></span>)}</div>;

  return (
    <Panel title={s.name} meta={plural(s.rows.length, "row")} footer={s.rows.length > 0 && summary}>
      {s.rows.length === 0 ? (
        <EmptyState compact icon="report" title="Nothing to report" action={filtered ? <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>Reset filters</button> : null}>
          {filtered ? "No rows match these filters in this period." : "No activity was recorded in this period. Try a longer period."}
        </EmptyState>
      ) : (
        <>
          <div className="table-wrap scroll-y">
            <table className="dt hover">
              <thead><tr>{s.columns.map((c) => <th key={c.key} scope="col" className={c.num ? "r" : ""} data-tooltip={c.short ? c.header : undefined}>{c.short ?? c.header}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {s.columns.map((c, j) => {
                      const v = r[c.key];
                      const empty = v === "" || v == null;
                      return (
                        <td key={c.key} className={`${c.num ? "r" : ""} ${j === 0 ? "title" : ""} ${c.key === "no" || c.key === "ref" ? "mono" : ""} truncate`} style={{ maxWidth: 320 }} title={!empty && String(v).length > 40 ? String(v) : undefined}>
                          {empty ? <span className="muted">—</span> : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="table-foot">
              <span>{at * PAGE_SIZE + 1}–{Math.min(s.rows.length, (at + 1) * PAGE_SIZE)} of {s.rows.length}</span>
              <span className="pager">
                <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label="Previous page" data-tooltip="Previous page" disabled={at === 0} onClick={() => setPage(at - 1)}><Icon name="left" /></button>
                <span className="num">Page {at + 1} of {pages}</span>
                <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label="Next page" data-tooltip="Next page" disabled={at >= pages - 1} onClick={() => setPage(at + 1)}><Icon name="chev" /></button>
              </span>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
