import "server-only";
import ExcelJS from "exceljs";
import { CX, QUAL, STATUS } from "@/lib/format";
import { REPORTS } from "@/lib/reports";
import { ROLE_LABELS } from "@/lib/roles";
import { getUser, listUsers } from "@/lib/server/repo";
import { employeeStats, isShiftAnalyst, overview, routineStats, taskReport, teamOf, teamStats, ticketReport } from "@/lib/server/stats";

const ACTIVITIES = [
  "Review Logged Incidents in Splunk Incident Review", "Upload Malicious IP and Domain Files to the Website", "Review Scanner and Sensor Dashboards",
  "Prepare Daily Traffic Report", "Monitor Website Status in Grafana", "Monitor Security Center Website", "Monitor Security News", "Add IOCs to MISP and Share Them via Bale",
];
const dt = (s) => (s ? String(s).replace("T", " ").slice(0, 16) : "");
const users = () => Object.fromEntries(listUsers().map((u) => [u.id, u]));

/**
 * Builds a report as { title, sheets: [{ name, columns: [{ header, key, width }], rows, summary? }] }.
 * The same structure feeds the on-screen preview and the Excel export.
 */
export function buildReport(key, f) {
  const U = users();
  // `f.scope(user)` limits whose data the report may contain (see inReportScope).
  const inScope = (id) => !f.scope || (!!U[id] && f.scope(U[id]));
  switch (key) {
    case "employee": {
      const u = getUser(f.userId);
      if (!u || !inScope(u.id)) return null;
      const s = employeeStats(u, f.period);
      const sheets = [{
        name: "Tasks",
        columns: [
          { header: "Task Title", key: "title", width: 40 }, { header: "Work Description", key: "description", width: 50 },
          { header: "Quality", key: "quality", width: 18 }, { header: "Start Time", key: "start", width: 18 }, { header: "End Time", key: "end", width: 18 },
          { header: "Hours", key: "hours", width: 8, num: true }, { header: "Executor", key: "executor", width: 20 }, { header: "Complexity", key: "complexity", width: 12 },
        ],
        rows: s.tasks.map((t) => ({ title: t.title, description: t.description, quality: QUAL[t.quality] ?? "", start: dt(t.started_at), end: dt(t.completed_at), hours: t.hours, executor: u.name, complexity: CX[t.cx] })),
        summary: [["Completed tasks", s.completedTasks], ["Task hours", s.taskHours], ...CX.slice(1).map((c, i) => [c, s.complexity[i]])],
      }];
      if (s.routine) {
        sheets.push({
          name: "Routine Activity",
          columns: [{ header: "Metric", key: "k", width: 30 }, { header: "Value", key: "v", width: 14, num: true }],
          rows: [
            ["Shift logs", s.routine.logs], ["Shift logs completed", s.routine.completed], ["Routine completion %", s.routine.completion],
            ["MISP IOC count", s.routine.iocs], ["Tickets created", s.routine.tickets], ["Daily traffic reports", s.routine.reports], ["Issues reported", s.routine.issues],
          ].map(([k, v]) => ({ k, v })),
        });
        sheets.push(ticketSheet(ticketReport({ ...f.period, userId: u.id }), U));
      }
      return { title: `Employee Monthly Report · ${u.name}`, sheets };
    }
    case "team": {
      const rows = overview(f.period).filter((r) => inScope(r.id) && (!f.team || teamOf(r.team) === f.team));
      const teams = new Set(Object.values(U).filter((u) => inScope(u.id)).map((u) => teamOf(u.team)));
      return {
        title: "Team Monthly Report",
        sheets: [
          {
            name: "Teams",
            columns: [{ header: "Team", key: "team", width: 24 }, { header: "People", key: "people", width: 8, num: true }, { header: "Completed tasks", key: "completed", width: 16, num: true }, { header: "Task hours", key: "hours", width: 12, num: true }, { header: "Active", key: "active", width: 8, num: true }, { header: "Overdue", key: "overdue", width: 9, num: true }, ...CX.slice(1).map((c, i) => ({ header: c, key: `cx${i}`, width: 10, num: true }))],
            rows: teamStats(f.period).filter((t) => teams.has(t.team) && (!f.team || t.team === f.team)).map((t) => ({ ...t, ...Object.fromEntries(t.complexity.map((n, i) => [`cx${i}`, n])) })),
          },
          {
            name: "Members",
            columns: [{ header: "Employee", key: "name", width: 24 }, { header: "Team", key: "team", width: 20 }, { header: "Role", key: "role", width: 16 }, { header: "Completed tasks", key: "completed", width: 16, num: true }, { header: "Task hours", key: "hours", width: 12, num: true }, { header: "Shift logs", key: "logs", width: 10, num: true }, { header: "IOCs", key: "iocs", width: 8, num: true }, { header: "Tickets", key: "tickets", width: 8, num: true }],
            rows: rows.map((r) => ({ name: r.name, team: r.team, role: ROLE_LABELS[r.role], completed: r.completedTasks, hours: r.taskHours, logs: r.routine?.logs ?? "", iocs: r.routine?.iocs ?? "", tickets: r.routine?.tickets ?? "" })),
          },
        ],
      };
    }
    case "task":
      return {
        title: "Task Report",
        sheets: [{
          name: "Tasks",
          columns: [
            { header: "ID", key: "id", width: 9 }, { header: "Task Title", key: "title", width: 40 }, { header: "Work Description", key: "description", width: 40 },
            { header: "Status", key: "status", width: 12 }, { header: "Quality", key: "quality", width: 16 }, { header: "Start Time", key: "start", width: 18 },
            { header: "End Time", key: "end", width: 18 }, { header: "Hours", key: "hours", width: 8, num: true }, { header: "Executor", key: "executor", width: 20 },
            { header: "Team", key: "team", width: 18 }, { header: "Complexity", key: "complexity", width: 12 },
          ],
          rows: taskReport({ ...f.period, userId: f.userId, team: f.team, status: f.status, cx: f.cx, quality: f.quality }).filter((t) => inScope(t.assignee)).map((t) => ({
            id: t.id, title: t.title, description: t.description, status: STATUS[t.status], quality: QUAL[t.quality] ?? "", start: dt(t.started_at), end: dt(t.completed_at), hours: t.hours, executor: t.executor, team: t.team, complexity: CX[t.cx],
          })),
        }],
      };
    case "shift": {
      const analysts = listUsers().filter((u) => u.active && isShiftAnalyst(u) && inScope(u.id) && (!f.userId || u.id === f.userId));
      return {
        title: "SOC Shift Activity Report",
        sheets: [{
          name: "Shift Activity",
          columns: [
            { header: "Analyst", key: "name", width: 22 }, { header: "Team", key: "team", width: 10 }, { header: "Shift logs", key: "logs", width: 10, num: true }, { header: "Completed", key: "completed", width: 10, num: true }, { header: "Completion %", key: "completion", width: 12, num: true },
            ...ACTIVITIES.map((a, i) => ({ header: `#${i + 1} ${a}`, key: `a${i}`, width: 14, num: true, short: `#${i + 1}` })),
            { header: "IOCs", key: "iocs", width: 8, num: true }, { header: "Tickets", key: "tickets", width: 8, num: true }, { header: "Issues", key: "issues", width: 8, num: true }, { header: "Traffic reports", key: "reports", width: 14, num: true },
          ],
          rows: analysts.map((u) => {
            const r = routineStats(u.id, f.period);
            return { name: u.name, team: u.team, ...r, ...Object.fromEntries(r.perActivity.map((v, i) => [`a${i}`, v])) };
          }),
        }],
      };
    }
    case "tickets":
      return { title: "Ticket Report", sheets: [ticketSheet(ticketReport({ ...f.period, userId: f.userId, q: f.q }).filter((t) => inScope(t.a)), U)] };
    default:
      return null;
  }
}

function ticketSheet(rows, U) {
  return {
    name: "Tickets",
    columns: [{ header: "Analyst", key: "analyst", width: 22 }, { header: "Date", key: "date", width: 12 }, { header: "Ticket Number", key: "no", width: 18 }, { header: "Related Reference", key: "ref", width: 22 }, { header: "Description", key: "desc", width: 50 }],
    rows: rows.map((t) => ({ analyst: U[t.a]?.name ?? t.a, a: t.a, date: t.date, no: t.no, ref: t.ref, desc: t.desc })),
  };
}

const TONES = { good: "FFC6EFCE", fair: "FFE2EFDA", warn: "FFFFEB9C", bad: "FFFFC7CE" };

/**
 * Report → .xlsx. Optional extras on the report: `rtl` (right-to-left sheets in a Persian-friendly font),
 * `info`/`infoName` (the closing info sheet); on a sheet, `freeze` (columns kept in view);
 * on a column, `tone(row)` → good | fair | warn | bad to colour the cell.
 */
export async function toXlsx(report, period) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sentinel Ops";
  const font = report.rtl ? { name: "Tahoma", size: 10 } : null;
  const views = (extra) => [{ rightToLeft: !!report.rtl, ...extra }];
  for (const s of report.sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31), { views: views({ state: "frozen", ySplit: 1, xSplit: s.freeze ?? 0 }) });
    ws.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    const head = ws.getRow(1);
    head.font = { ...font, bold: true };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF6" } };
    if (report.rtl) {
      head.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
      head.height = 36;
    }
    s.rows.forEach((r) => {
      const row = ws.addRow(r);
      if (font) row.font = font;
      s.columns.forEach((c, i) => {
        const tone = c.tone?.(r);
        if (tone) row.getCell(i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TONES[tone] } };
      });
    });
    if (s.summary) {
      ws.addRow([]);
      s.summary.forEach(([k, v]) => { const row = ws.addRow([k, v]); row.font = { ...font, bold: true }; });
    }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
  }
  const info = wb.addWorksheet(report.infoName ?? "Info", { views: views() });
  info.addRows(report.info ?? [["Report", report.title], ["Period", `${period.from} – ${period.to}`], ["Generated", new Date().toISOString().replace("T", " ").slice(0, 16)]]);
  info.getColumn(1).width = report.rtl ? 16 : 12;
  info.getColumn(2).width = report.rtl ? 70 : 50;
  if (font) info.eachRow((row) => { row.font = font; row.getCell(1).font = { ...font, bold: true }; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const reportFileName = (key, period) => `${REPORTS.find((r) => r[0] === key)[1].replace(/\W+/g, "_")}_${period.from}_${period.to}.xlsx`;
