import "server-only";
import ExcelJS from "exceljs";
import { CX, QUAL, STATUS } from "@/lib/format";
import { REPORTS } from "@/lib/reports";
import { ROLE_LABELS } from "@/lib/roles";
import { STANDARD_CHECKLIST } from "@/lib/checklists";
import { getUser, listUsers } from "@/lib/server/repo";
import { employeeStats, isShiftAnalyst, overview, routineStats, taskReport, teamOf, teamStats, ticketReport } from "@/lib/server/stats";
import { analyzedTicketReport } from "@/lib/server/l2-analyzed-tickets";

// Per-activity columns: the standard SOC routine's eight activities, by historical number.
const ACTIVITIES = STANDARD_CHECKLIST.items.map((it) => it.title);
const dt = (s) => (s ? String(s).replace("T", " ").slice(0, 16) : "");
const users = () => Object.fromEntries(listUsers().map((u) => [u.id, u]));

/**
 * Builds a report as { title, sheets: [{ name, columns: [{ header, key, width }], rows, summary? }] }.
 * The same structure feeds the on-screen preview and the Excel export.
 */
export function buildReport(key, f) {
  const U = users();
  switch (key) {
    case "employee": {
      const u = getUser(f.userId);
      if (!u) return null;
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
            ["MISP IOC count", s.routine.iocs], ["Tickets created", s.routine.tickets], ["Tickets analyzed (L2)", s.routine.analyzedTickets],
            ["False positives (L2)", s.routine.analyzedFalsePositive], ["True positives (L2)", s.routine.analyzedTruePositive], ["Daily traffic reports", s.routine.reports], ["Issues reported", s.routine.issues],
          ].map(([k, v]) => ({ k, v })),
        });
        sheets.push(ticketSheet(ticketReport({ ...f.period, userId: u.id }), U));
        if (u.team === "SOC · L2") sheets.push(analyzedTicketSheet(analyzedTicketReport({ ...f.period, userId: u.id })));
      }
      return { title: `Employee Monthly Report · ${u.name}`, sheets };
    }
    case "team": {
      const rows = overview(f.period).filter((r) => !f.team || teamOf(r.team) === f.team);
      return {
        title: "Team Monthly Report",
        sheets: [
          {
            name: "Teams",
            columns: [{ header: "Team", key: "team", width: 24 }, { header: "People", key: "people", width: 8, num: true }, { header: "Completed tasks", key: "completed", width: 16, num: true }, { header: "Task hours", key: "hours", width: 12, num: true }, { header: "Active", key: "active", width: 8, num: true }, { header: "Overdue", key: "overdue", width: 9, num: true }, ...CX.slice(1).map((c, i) => ({ header: c, key: `cx${i}`, width: 10, num: true }))],
            rows: teamStats(f.period).filter((t) => !f.team || t.team === f.team).map((t) => ({ ...t, ...Object.fromEntries(t.complexity.map((n, i) => [`cx${i}`, n])) })),
          },
          {
            name: "Members",
            columns: [{ header: "Employee", key: "name", width: 24 }, { header: "Team", key: "team", width: 20 }, { header: "Role", key: "role", width: 16 }, { header: "Completed tasks", key: "completed", width: 16, num: true }, { header: "Task hours", key: "hours", width: 12, num: true }, { header: "Shift logs", key: "logs", width: 10, num: true }, { header: "IOCs", key: "iocs", width: 8, num: true }, { header: "Tickets", key: "tickets", width: 8, num: true }, { header: "Analyzed (L2)", key: "analyzed", width: 14, num: true }],
            rows: rows.map((r) => ({ name: r.name, team: r.team, role: ROLE_LABELS[r.role], completed: r.completedTasks, hours: r.taskHours, logs: r.routine?.logs ?? "", iocs: r.routine?.iocs ?? "", tickets: r.routine?.tickets ?? "", analyzed: r.routine?.analyzedTickets ?? "" })),
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
          rows: taskReport({ ...f.period, userId: f.userId, team: f.team, status: f.status, cx: f.cx, quality: f.quality }).map((t) => ({
            id: t.id, title: t.title, description: t.description, status: STATUS[t.status], quality: QUAL[t.quality] ?? "", start: dt(t.started_at), end: dt(t.completed_at), hours: t.hours, executor: t.executor, team: t.team, complexity: CX[t.cx],
          })),
        }],
      };
    case "shift": {
      const analysts = listUsers().filter((u) => u.active && isShiftAnalyst(u) && (!f.userId || u.id === f.userId));
      return {
        title: "SOC Shift Activity Report",
        sheets: [{
          name: "Shift Activity",
          columns: [
            { header: "Analyst", key: "name", width: 22 }, { header: "Team", key: "team", width: 10 }, { header: "Off-duty days", key: "offDays", width: 13, num: true }, { header: "Leave days", key: "leaveDays", width: 12, num: true }, { header: "Shift logs", key: "logs", width: 10, num: true }, { header: "Completed", key: "completed", width: 10, num: true }, { header: "Completion %", key: "completion", width: 12, num: true },
            ...ACTIVITIES.map((a, i) => ({ header: `#${i + 1} ${a}`, key: `a${i}`, width: 14, num: true, short: `#${i + 1}` })),
            { header: "IOCs", key: "iocs", width: 8, num: true }, { header: "Tickets", key: "tickets", width: 8, num: true },
            { header: "Analyzed (L2)", key: "analyzedTickets", width: 14, num: true }, { header: "False positive", key: "analyzedFalsePositive", width: 15, num: true },
            { header: "True positive", key: "analyzedTruePositive", width: 15, num: true }, { header: "Issues", key: "issues", width: 8, num: true }, { header: "Traffic reports", key: "reports", width: 14, num: true },
          ],
          rows: analysts.map((u) => {
            const r = routineStats(u.id, f.period);
            return { name: u.name, team: u.team, ...r, ...Object.fromEntries(r.perActivity.map((v, i) => [`a${i}`, v])) };
          }),
        }, analyzedTicketSheet(analyzedTicketReport({ ...f.period, userId: f.userId }))],
      };
    }
    case "tickets":
      return { title: "Ticket Report", sheets: [ticketSheet(ticketReport({ ...f.period, userId: f.userId, q: f.q }), U)] };
    default:
      return null;
  }
}

function analyzedTicketSheet(rows) {
  return {
    name: "L2 Ticket Analysis",
    columns: [
      { header: "Analyst", key: "analyst", width: 24 },
      { header: "Date", key: "date", width: 14 },
      { header: "Ticket Number", key: "ticketNumber", width: 26 },
      { header: "Verdict", key: "verdict", width: 28 },
      { header: "Corrected By", key: "correctedBy", width: 18 },
    ],
    rows: rows.map((r) => ({
      analyst: r.analyst, date: r.date, ticketNumber: r.ticketNumber,
      verdict: r.verdict === "false_positive" ? "False Positive" : "True Positive",
      correctedBy: r.correctedBy ?? "",
    })),
  };
}

function ticketSheet(rows, U) {
  return {
    name: "Tickets",
    columns: [{ header: "Analyst", key: "analyst", width: 22 }, { header: "Date", key: "date", width: 12 }, { header: "Ticket Number", key: "no", width: 18 }, { header: "Related Reference", key: "ref", width: 22 }, { header: "Description", key: "desc", width: 50 }],
    rows: rows.map((t) => ({ analyst: U[t.a]?.name ?? t.a, a: t.a, date: t.date, no: t.no, ref: t.ref, desc: t.desc })),
  };
}

export async function toXlsx(report, period) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sentinel Ops";
  for (const s of report.sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF6" } };
    s.rows.forEach((r) => ws.addRow(r));
    if (s.summary) {
      ws.addRow([]);
      s.summary.forEach(([k, v]) => { const row = ws.addRow([k, v]); row.font = { bold: true }; });
    }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
  }
  const info = wb.addWorksheet("Info");
  info.addRows([["Report", report.title], ["Period", `${period.from} – ${period.to}`], ["Generated", new Date().toISOString().replace("T", " ").slice(0, 16)]]);
  info.getColumn(1).width = 12;
  info.getColumn(2).width = 50;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const reportFileName = (key, period) => `${REPORTS.find((r) => r[0] === key)[1].replace(/\W+/g, "_")}_${period.from}_${period.to}.xlsx`;
