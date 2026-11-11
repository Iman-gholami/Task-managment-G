import "server-only";
import { db } from "@/lib/server/db";
import { today } from "@/lib/server/repo";
import { isManager, isIranProvince } from "@/lib/roles";
import { monthlyReportFactsFor } from "@/lib/server/analytics";
import { jalaliMonthBounds, localMonth, minIso } from "@/lib/analytics/calendar";
import { applyFilters, parseFilters } from "@/lib/analytics/filters";
import { GROUP_BY_KEY, LEVELS } from "@/lib/analytics/labels";
import { openStats, stats } from "@/lib/analytics/metrics";
import { SHIFT_TYPES } from "@/lib/shifts";
import { shiftLogMode } from "@/lib/shift-log-mode";

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const by = (rows, key) => {
  const map = new Map();
  for (const row of rows) { if (!map.has(row[key])) map.set(row[key], []); map.get(row[key]).push(row); }
  return map;
};

/** Hours come from the configured rota, not a time clock. Leave/off have no work hours. */
function shiftSummary(shifts) {
  const soc = shifts.filter((s) => s.workType === "soc");
  const completed = soc.filter((s) => s.closed);
  const pending = soc.filter((s) => !s.closed);
  const engineering = shifts.filter((s) => s.workType === "engineering");
  const hours = (rows) => Math.round(rows.reduce((sum, s) => sum + s.hours, 0) * 100) / 100;
  return {
    socShifts: soc.length, socShiftHours: hours(soc),
    completedSocShifts: completed.length, completedSocShiftHours: hours(completed),
    pendingSocShifts: pending.length, pendingSocShiftHours: hours(pending),
    engineeringShifts: engineering.length, engineeringShiftHours: hours(engineering),
  };
}

export function monthlyBounds(month, now = today()) {
  const bounds = jalaliMonthBounds(month);
  if (!bounds || bounds.from > now) fail(400, "Choose a valid month that is not in the future.");
  return { ...bounds, end: minIso(bounds.to, now), partial: bounds.to > now };
}

/** The two report formats share this manager-only department report model. */
export function buildMonthlyReport(actor, options = {}) {
  if (!isManager(actor)) fail(403, "Only SOC and Security Managers can create this report.");
  if (options.demo) fail(400, "Monthly reports require real data.");
  const now = today(), bounds = monthlyBounds(options.month, now), locale = options.locale === "en" ? "en" : "fa";
  if (options.team && !GROUP_BY_KEY[options.team]) fail(400, "Invalid team filter.");
  if (options.level && !LEVELS.includes(options.level)) fail(400, "Invalid level filter.");
  if (options.province && !isIranProvince(options.province)) fail(400, "Invalid province filter.");
  const facts = monthlyReportFactsFor(actor, { wf: bounds.from, wt: bounds.end });
  const filters = parseFilters({ team: options.team, level: options.level, province: options.province });
  const view = applyFilters(facts, filters);
  let selected = view.people;
  if (options.person) {
    selected = selected.filter((person) => person.id === options.person);
    if (!selected.length) fail(404, "No matching person in your scope.");
  }
  const ids = selected.map((p) => p.id), range = { from: bounds.from, end: bounds.end };
  const sample = db.prepare("SELECT value FROM meta WHERE key = 'monthly_report_demo'").get()?.value === "1";
  const base = { locale, month: bounds.month, from: bounds.from, to: bounds.end, partial: bounds.partial, label: localMonth(bounds.from, locale), generatedAt: new Date().toISOString(), scope: facts.scope.kind, filters, sample };
  if (!ids.length) return { ...base, personName: "", people: [], teams: [] };
  const q = ids.map(() => "?").join(",");
  const taskRows = db.prepare(`SELECT t.id, t.assignee, t.title, t.description, t.team, t.status, t.prio, t.cx, t.due, t.hours, t.quality,
    t.created_at, t.started_at, t.completed_at, w.work_performed, w.outcome
    FROM tasks t LEFT JOIN task_work_reports w ON w.task_id = t.id
    WHERE t.deleted_at IS NULL AND t.assignee IN (${q})`).all(...ids);
  // This report is the explicitly authorized department-wide view for both managers.
  const taskById = new Map(taskRows.map((t) => [t.id, t]));
  const visibleTasks = view.tasks.filter((t) => taskById.has(t.id));
  const scopedView = { ...view, people: selected, tasks: visibleTasks };
  const taskSet = new Set(visibleTasks.filter((t) => t.created <= bounds.end && (!t.closed || t.closed >= bounds.from)).map((t) => t.id));
  const checklists = by(db.prepare(`SELECT c.task_id, c.label, c.done FROM checklist_items c JOIN tasks t ON t.id = c.task_id WHERE t.deleted_at IS NULL AND t.assignee IN (${q}) ORDER BY c.position, c.id`).all(...ids).filter((r) => taskSet.has(r.task_id)), "task_id");
  const comments = by(db.prepare(`SELECT c.task_id, c.body, c.created_at, u.name AS author FROM comments c JOIN tasks t ON t.id = c.task_id LEFT JOIN users u ON u.id = c.user_id WHERE t.deleted_at IS NULL AND t.assignee IN (${q}) ORDER BY c.id`).all(...ids).filter((r) => taskSet.has(r.task_id)), "task_id");
  const attachments = by(db.prepare(`SELECT a.task_id, a.name FROM attachments a JOIN tasks t ON t.id = a.task_id WHERE t.deleted_at IS NULL AND t.assignee IN (${q}) ORDER BY a.id`).all(...ids).filter((r) => taskSet.has(r.task_id)), "task_id");
  const returns = by(db.prepare(`SELECT r.task_id, r.reason, r.created_at, u.name AS author FROM task_review_returns r JOIN tasks t ON t.id = r.task_id LEFT JOIN users u ON u.id = r.user_id WHERE t.deleted_at IS NULL AND t.assignee IN (${q}) ORDER BY r.id`).all(...ids).filter((r) => taskSet.has(r.task_id)), "task_id");
  const history = by(db.prepare(`SELECT h.task_id, h.from_status, h.to_status, h.at, u.name AS author FROM task_transitions h JOIN tasks t ON t.id = h.task_id LEFT JOIN users u ON u.id = h.user_id WHERE t.deleted_at IS NULL AND t.assignee IN (${q}) ORDER BY h.id`).all(...ids).filter((r) => taskSet.has(r.task_id)), "task_id");
  const tasks = visibleTasks.filter((t) => taskSet.has(t.id)).map((t) => {
    const raw = taskById.get(t.id);
    return { ...t, description: raw.description || "", workPerformed: raw.work_performed || "", outcome: raw.outcome || "", createdAt: raw.created_at, startedAt: raw.started_at, completedAt: raw.completed_at,
      checklist: checklists.get(t.id) ?? [], comments: comments.get(t.id) ?? [], attachments: (attachments.get(t.id) ?? []).map((a) => a.name), returnReasons: returns.get(t.id) ?? [], history: history.get(t.id) ?? [] };
  });
  const args = [bounds.from, bounds.end, ...ids];
  const shiftData = new Map(db.prepare(`SELECT user_id, date, data, team FROM shift_logs WHERE date BETWEEN ? AND ? AND user_id IN (${q})`).all(...args).map((r) => {
    let activities = []; try { const parsed = JSON.parse(r.data); if (Array.isArray(parsed)) activities = parsed; } catch {}
    return [`${r.user_id}|${r.date}`, { activities, team: r.team }];
  }));
  const tickets = by(db.prepare(`SELECT user_id AS a, date, number, ref, description FROM tickets WHERE date BETWEEN ? AND ? AND user_id IN (${q}) ORDER BY date, id`).all(...args), "a");
  const analyzed = by(db.prepare(`SELECT user_id AS a, date, ticket_number AS ticketNumber, verdict FROM l2_analyzed_tickets WHERE date BETWEEN ? AND ? AND user_id IN (${q}) ORDER BY date, id`).all(...args), "a");
  const records = selected.map((p) => {
    const personTasks = tasks.filter((t) => t.a === p.id);
    const shifts = view.shifts.filter((s) => s.a === p.id && s.date >= bounds.from && s.date <= bounds.end).map((s) => {
      const saved = shiftData.get(`${p.id}|${s.date}`);
      const duration = SHIFT_TYPES[s.type]?.hours ?? 0;
      const mode = duration ? shiftLogMode({ team: saved?.team || p.team }, s.type) : null;
      return { ...s, activities: saved?.activities ?? [], hours: duration,
        workType: !duration ? null : mode === "engineering" ? "engineering" : "soc" };
    });
    const personTickets = tickets.get(p.id) ?? [], analyzedTickets = analyzed.get(p.id) ?? [];
    const reviews = (view.reviews ?? []).filter((r) => r.a === p.id && r.month === bounds.month);
    return { ...p, tasks: personTasks, shifts, tickets: personTickets, analyzedTickets, reviews, stats: { ...stats(scopedView, [p.id], range), ...shiftSummary(shifts), open: openStats(scopedView, [p.id]).open,
      analyzed: analyzedTickets.length, falsePositive: analyzedTickets.filter((t) => t.verdict === "false_positive").length, truePositive: analyzedTickets.filter((t) => t.verdict === "true_positive").length } };
  }).filter((p) => p.active || p.tasks.length || p.shifts.length || p.tickets.length || p.analyzedTickets.length);
  const teams = [...new Set(records.map((p) => p.group))].map((name) => {
    const members = records.filter((p) => p.group === name), sum = (key) => members.reduce((total, p) => total + (Number(p.stats[key]) || 0), 0);
    return { name, people: members.length, completed: sum("completed"), hours: sum("hours"), open: sum("open"), shifts: sum("shifts"),
      socShifts: sum("socShifts"), socShiftHours: sum("socShiftHours"), completedSocShifts: sum("completedSocShifts"), completedSocShiftHours: sum("completedSocShiftHours"),
      pendingSocShifts: sum("pendingSocShifts"), pendingSocShiftHours: sum("pendingSocShiftHours"), engineeringShifts: sum("engineeringShifts"), engineeringShiftHours: sum("engineeringShiftHours"),
      analyzed: sum("analyzed"), falsePositive: sum("falsePositive"), truePositive: sum("truePositive") };
  });
  return { ...base, personName: options.person ? selected[0]?.name ?? "" : "", people: records, teams };
}
