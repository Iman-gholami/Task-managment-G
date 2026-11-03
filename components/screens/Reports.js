"use client";

import { useI18n as useSharedI18n } from "@/components/I18nProvider";

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
import { taskWhen } from "@/lib/task-date";
import { dashboardRange } from "@/lib/i18n/presentation";
import { reportCell, reportHeader } from "@/lib/i18n/report-copy";
import { periodQuery } from "@/lib/period";
import { REPORTS } from "@/lib/reports";
import { canViewManagementAnalytics } from "@/lib/roles";

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
  const { t: __sharedTr, locale, team: teamText, number } = useSharedI18n();
  const { me, members } = useApp();
  const params = useSearchParams();
  const manager = canViewManagementAnalytics(me);
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
  const activeFilters = Object.entries(f).filter(([k, v]) => v && FILTERS[key].includes(k) && !(k === "user" && key === "employee")).length;
  const reset = () => setF((x) => ({ ...x, team: "", status: "", cx: "", quality: "", q: "", user: key === "employee" ? x.user : "" }));
  const sel = (k, v) => `input ${v ? "is-set" : ""}`;

  return (
    <div className="split">
      <nav className="split-nav" aria-label={__sharedTr("Reports")}>
        <div className="nav-label">{__sharedTr("Reports")}</div>
        {reportsFor.map(([k, n]) => (
          <Link key={k} className={`nav-item ${k === key ? "active" : ""}`} href={`/reports/${k}`} aria-current={k === key ? "page" : undefined}>
            <span className="label">{__sharedTr(n)}</span>
          </Link>
        ))}
      </nav>
      <div className="page">
        <PageHeader
          title={__sharedTr(cur[1])}
          meta={[__sharedTr(cur[2]), data ? dashboardRange(data.period.from, data.period.to, locale) : null]}
          actions={
            <a className="btn btn-primary" href={`/api/reports/${key}?${qs}&format=xlsx&lang=${locale}`} download data-testid="export" data-tooltip={__sharedTr("Same filters and period as the preview below")}>
              <Icon name="download" />{"" + __sharedTr("Export to Excel") + ""}</a>
          }
        />
        <div className="toolbar" role="search" aria-label={__sharedTr("Report filters")}>
          <PeriodSelector value={period} onChange={setPeriod} custom range={range} onRange={setRange} />
          {show("user") && (
            <select className={sel("user", f.user && key !== "employee")} style={{ width: 190 }} value={f.user} onChange={set("user")} aria-label={__sharedTr("Employee")}>
              {key !== "employee" && <option value="">{"" + __sharedTr("All employees") + ""}</option>}
              {people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          {show("team") && <select className={sel("team", f.team)} style={{ width: 180 }} value={f.team} onChange={set("team")} aria-label={__sharedTr("Team")}><option value="">{"" + __sharedTr("All teams") + ""}</option>{TEAMS.map((t) => <option key={t} value={t}>{teamText(t)}</option>)}</select>}
          {show("status") && <select className={sel("status", f.status)} style={{ width: 150 }} value={f.status} onChange={set("status")} aria-label={__sharedTr("Task status")}><option value="">{"" + __sharedTr("Any status") + ""}</option>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{__sharedTr(l)}</option>)}</select>}
          {show("cx") && <select className={sel("cx", f.cx)} style={{ width: 160 }} value={f.cx} onChange={set("cx")} aria-label={__sharedTr("Complexity")}><option value="">{"" + __sharedTr("Any complexity") + ""}</option>{CX.slice(1).map((c, i) => <option key={c} value={i + 1}>{__sharedTr(c)}</option>)}</select>}
          {show("quality") && <select className={sel("quality", f.quality)} style={{ width: 180 }} value={f.quality} onChange={set("quality")} aria-label={__sharedTr("Quality")}><option value="">{"" + __sharedTr("Any quality") + ""}</option>{Object.entries(QUAL).map(([k, l]) => <option key={k} value={k}>{__sharedTr(l)}</option>)}</select>}
          {show("q") && <div className="search"><Icon name="search" /><input type="search" className="input" placeholder={__sharedTr("Ticket number or description")} aria-label={__sharedTr("Search tickets")} value={f.q} onChange={set("q")} /></div>}
          {activeFilters > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={reset}><Icon name="x" />{"" + __sharedTr("Reset filters (") + ""}{number(activeFilters)})</button>}
        </div>

        {loading && !data ? <div className="panel"><Loading label={__sharedTr("Loading report")} rows={8} /></div> : error ? (
          <div className="panel"><ErrorState error={error} title={__sharedTr("Couldn't load the report")} onRetry={reload} /></div>
        ) : (
          <div className="stack-lg">
            {data?.sheets.map((s) => <Sheet key={s.name} sheet={s} filtered={activeFilters > 0} onReset={reset} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/** One report sheet: the same columns as the Excel export, paginated above 100 rows. */
function Sheet({ sheet: s, filtered, onReset }) {
  const { t: __sharedTr, locale, number } = useSharedI18n();
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(s.rows.length / PAGE_SIZE));
  const at = Math.min(page, pages - 1);
  const rows = s.rows.slice(at * PAGE_SIZE, (at + 1) * PAGE_SIZE);
  const summary = s.summary && <div className="legend">{s.summary.map(([k, v]) => <span key={k}>{__sharedTr(k)} <b>{typeof v === "number" ? number(v) : v}</b></span>)}</div>;

  return (
    <Panel title={__sharedTr(s.name)} meta={locale === "fa" ? `${number(s.rows.length)} ردیف` : plural(s.rows.length, "row")} footer={s.rows.length > 0 && summary}>
      {s.rows.length === 0 ? (
        <EmptyState compact icon="report" title={__sharedTr("Nothing to report")} action={filtered ? <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>{"" + __sharedTr("Reset filters") + ""}</button> : null}>
          {__sharedTr(filtered ? "No rows match these filters in this period." : "No activity was recorded in this period. Try a longer period.")}
        </EmptyState>
      ) : (
        <>
          <div className="table-wrap scroll-y">
            <table className="dt hover">
              <thead><tr>{s.columns.map((c) => <th key={c.key} scope="col" className={c.num ? "r" : ""} data-tooltip={c.short ? reportHeader(c.header, locale) : undefined}>{c.short ?? reportHeader(c.header, locale)}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {s.columns.map((c, j) => {
                      const raw = r[c.key];
                      const v = reportCell(s.name, c.key, raw, locale);
                      const empty = v === "" || v == null;
                      return (
                        <td key={c.key} className={`${c.num ? "r" : ""} ${j === 0 ? "title" : ""} ${c.key === "no" || c.key === "ref" ? "mono" : ""} truncate`} style={{ maxWidth: 320 }} title={!empty && String(v).length > 40 ? String(v) : undefined}>
                          {empty ? <span className="muted">—</span> : typeof v === "number" ? number(v) : String(v)}
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
              <span>{number(at * PAGE_SIZE + 1)}–{number(Math.min(s.rows.length, (at + 1) * PAGE_SIZE))}{" " + __sharedTr("of") + " "}{number(s.rows.length)}</span>
              <span className="pager">
                <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label={__sharedTr("Previous page")} data-tooltip={__sharedTr("Previous page")} disabled={at === 0} onClick={() => setPage(at - 1)}><Icon name="left" /></button>
                <span className="num">{"" + __sharedTr("Page") + " "}{number(at + 1)}{" " + __sharedTr("of") + " "}{number(pages)}</span>
                <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label={__sharedTr("Next page")} data-tooltip={__sharedTr("Next page")} disabled={at >= pages - 1} onClick={() => setPage(at + 1)}><Icon name="chev" /></button>
              </span>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
