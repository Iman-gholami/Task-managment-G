import "server-only";
import { db } from "@/lib/server/db";
import { isShiftEligible } from "@/lib/roles";
import { listUsers, today } from "@/lib/server/repo";
import { legacyActivityNumber } from "@/lib/checklists";
import { analyzedTicketSummary } from "@/lib/server/l2-analyzed-tickets";

const iso = (d) => d.toISOString().slice(0, 10);

/** Period keys used by the UI and reports: this | last | quarter | custom (from/to). */
export function resolvePeriod({ period = "this", from, to } = {}) {
  const now = new Date(today() + "T00:00:00Z");
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  if (period === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) return { period, from, to };
  if (period === "last") return { period, from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
  if (period === "quarter") {
    const q = Math.floor(m / 3) * 3;
    return { period, from: iso(new Date(Date.UTC(y, q, 1))), to: iso(new Date(Date.UTC(y, q + 3, 0))) };
  }
  return { period: "this", from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
}

export const isShiftAnalyst = isShiftEligible;

/** Completed tasks for one user within the period (by completion date). */
export function completedTasks(userId, { from, to }) {
  return db.prepare(
    `SELECT id, title, description, cx, quality, hours, started_at, completed_at, assignee, team FROM tasks
     WHERE deleted_at IS NULL AND status = 'done' AND assignee = ? AND date(completed_at) BETWEEN ? AND ? ORDER BY completed_at`
  ).all(userId, from, to).map((t) => ({ ...t }));
}

/** Routine (shift log) statistics for one user within the period. */
export function routineStats(userId, { from, to }) {
  const logs = db.prepare("SELECT date, data, completed_at FROM shift_logs WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date").all(userId, from, to);
  let done = 0, total = 0, iocs = 0, reports = 0, issues = 0, completed = 0;
  const perActivity = Array.from({ length: 8 }, () => ({ done: 0, total: 0 }));
  const iocSeries = [];
  for (const l of logs) {
    const acts = JSON.parse(l.data);
    if (l.completed_at) completed++;
    acts.forEach((a) => {
      total++;
      if (a.done) done++;
      // Per-activity figures describe the standard routine's eight activities, by their historical number
      // (morning and night logs skip some of them, so the position in the list is not the number).
      const slot = perActivity[(legacyActivityNumber(a) ?? 0) - 1];
      if (slot) { slot.total++; if (a.done) slot.done++; }
      if (a.issue) issues++;
      if (a.kind === "report" && a.done) reports++;
      if (a.kind === "misp") { iocs += a.iocs || 0; iocSeries.push(a.iocs || 0); }
    });
  }
  const tickets = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND date BETWEEN ? AND ?").get(userId, from, to).n;
  const analyzed = analyzedTicketSummary(userId, from, to);
  const days = db.prepare("SELECT status, COUNT(*) AS n FROM shift_day_statuses WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY status").all(userId, from, to);
  const offDays = days.find((d) => d.status === "off")?.n ?? 0;
  const leaveDays = days.find((d) => d.status === "leave")?.n ?? 0;
  return {
    logs: logs.length,
    offDays,
    leaveDays,
    completed,
    completion: total ? Math.round((done / total) * 1000) / 10 : 0,
    activitiesDone: done,
    activitiesTotal: total,
    iocs,
    tickets,
    analyzedTickets: analyzed.total,
    analyzedFalsePositive: analyzed.falsePositive,
    analyzedTruePositive: analyzed.truePositive,
    reports,
    issues,
    iocSeries,
    perActivity: perActivity.map((a) => (a.total ? Math.round((a.done / a.total) * 100) : 0)),
  };
}

const COMPLEXITY = [1, 2, 3, 4];
const QUALITY = ["excellent", "good", "acceptable", "needs"];

/** Everything the Employee Performance screen and Employee Monthly Report need. */
export function employeeStats(user, period) {
  const tasks = completedTasks(user.id, period);
  return {
    user,
    period,
    tasks,
    completedTasks: tasks.length,
    taskHours: Math.round(tasks.reduce((s, t) => s + t.hours, 0) * 10) / 10,
    complexity: COMPLEXITY.map((c) => tasks.filter((t) => t.cx === c).length),
    quality: QUALITY.map((q) => tasks.filter((t) => t.quality === q).length),
    routine: isShiftAnalyst(user) ? routineStats(user.id, period) : null,
  };
}

/** One row per active member (Performance Overview, Security dashboard). */
export function overview(period) {
  return listUsers()
    .filter((u) => u.active && u.role !== "security_manager")
    .map((u) => {
      const s = employeeStats(u, period);
      return { id: u.id, name: u.name, team: u.team, role: u.role, completedTasks: s.completedTasks, taskHours: s.taskHours, complexity: s.complexity, routine: s.routine && { logs: s.routine.logs, iocs: s.routine.iocs, tickets: s.routine.tickets, analyzedTickets: s.routine.analyzedTickets, analyzedFalsePositive: s.routine.analyzedFalsePositive, analyzedTruePositive: s.routine.analyzedTruePositive, completion: s.routine.completion } };
    });
}

export const teamOf = (team) => (team.startsWith("SOC") ? "SOC" : team === "Security Department" ? null : team);

/** Team totals and a 6-month completed-task trend. */
export function teamStats(period) {
  const rows = overview(period);
  const teams = ["SOC", "Design & Automation", "Threat Intelligence"];
  const now = new Date(today() + "T00:00:00Z");
  return teams.map((team) => {
    const members = rows.filter((r) => teamOf(r.team) === team);
    const ids = listUsers().filter((u) => teamOf(u.team) === team).map((u) => u.id);
    const q = (sql, ...args) => (ids.length ? db.prepare(sql.replace("$IDS", ids.map(() => "?").join(","))).get(...ids, ...args).n : 0);
    const trend = Array.from({ length: 6 }, (_, i) => {
      const a = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
      const b = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0));
      return q("SELECT COUNT(*) AS n FROM tasks WHERE deleted_at IS NULL AND status = 'done' AND assignee IN ($IDS) AND date(completed_at) BETWEEN ? AND ?", iso(a), iso(b));
    });
    return {
      team,
      people: members.length,
      completed: members.reduce((s, r) => s + r.completedTasks, 0),
      hours: Math.round(members.reduce((s, r) => s + r.taskHours, 0) * 10) / 10,
      complexity: COMPLEXITY.map((_, i) => members.reduce((s, r) => s + r.complexity[i], 0)),
      active: q("SELECT COUNT(*) AS n FROM tasks WHERE deleted_at IS NULL AND status NOT IN ('done', 'cancelled', 'backlog') AND assignee IN ($IDS)"),
      overdue: q("SELECT COUNT(*) AS n FROM tasks WHERE deleted_at IS NULL AND status NOT IN ('done', 'cancelled') AND due GLOB '[0-9]*' AND assignee IN ($IDS) AND due < ?", today()),
      trend,
    };
  });
}

/** Task report rows (all tasks matching filters, not only completed). */
export function taskReport({ from, to, userId, team, status, cx, quality }) {
  const users = Object.fromEntries(listUsers().map((u) => [u.id, u]));
  return db.prepare(
    `SELECT * FROM tasks WHERE deleted_at IS NULL AND (date(COALESCE(completed_at, started_at, updated_at)) BETWEEN ? AND ?) ORDER BY COALESCE(completed_at, started_at, updated_at)`
  ).all(from, to)
    .filter((t) => (!userId || t.assignee === userId) && (!team || teamOf(t.team) === team || t.team === team) && (!status || t.status === status) && (!cx || t.cx === Number(cx)) && (!quality || t.quality === quality))
    .map((t) => ({ ...t, executor: users[t.assignee]?.name ?? t.assignee }));
}

export function ticketReport({ from, to, userId, q }) {
  return db.prepare("SELECT user_id AS a, date, number AS no, ref, description AS desc FROM tickets WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC")
    .all(from, to)
    .filter((t) => (!userId || t.a === userId) && (!q || `${t.no} ${t.ref} ${t.desc}`.toLowerCase().includes(q.toLowerCase())))
    .map((t) => ({ ...t }));
}

/** Dashboard counters for the signed-in user and their scope. */
export function dashboardStats(me) {
  const period = resolvePeriod({ period: "this" });
  const mine = employeeStats(me, period);
  const socIds = listUsers().filter((u) => u.active && isShiftAnalyst(u)).map((u) => u.id);
  const socRoutine = socIds.map((id) => routineStats(id, period));
  const todayLogs = socIds.map((id) => db.prepare("SELECT data, completed_at FROM shift_logs WHERE user_id = ? AND date = ?").get(id, today()));
  const todayActs = todayLogs.flatMap((l) => (l ? JSON.parse(l.data) : []));
  const doneToday = todayActs.filter((a) => a.done).length;
  const month = (sql, ...a) => db.prepare(sql).get(...a).n;
  return {
    period,
    my: { completed: mine.completedTasks, iocs: mine.routine?.iocs ?? 0, tickets: mine.routine?.tickets ?? 0 },
    soc: {
      iocs: socRoutine.reduce((s, r) => s + r.iocs, 0),
      tickets: socRoutine.reduce((s, r) => s + r.tickets, 0),
      shiftCompletion: todayActs.length ? Math.round((doneToday / todayActs.length) * 100) : 0,
      iocSeries: lastDays(7).map((d) => socIds.reduce((s, id) => s + (routineStats(id, { from: d, to: d }).iocs), 0)),
      ticketSeries: lastDays(7).map((d) => month("SELECT COUNT(*) AS n FROM tickets WHERE date = ?", d)),
    },
    department: {
      completed: month("SELECT COUNT(*) AS n FROM tasks WHERE deleted_at IS NULL AND status = 'done' AND date(completed_at) BETWEEN ? AND ?", period.from, period.to),
      hours: Math.round(db.prepare("SELECT COALESCE(SUM(hours), 0) AS n FROM tasks WHERE deleted_at IS NULL AND status = 'done' AND date(completed_at) BETWEEN ? AND ?").get(period.from, period.to).n * 10) / 10,
      shiftCompliance: (() => {
        const all = socRoutine.reduce((s, r) => s + r.logs, 0);
        return all ? Math.round((socRoutine.reduce((s, r) => s + r.completed, 0) / all) * 100) : 0;
      })(),
    },
  };
}

function lastDays(n) {
  const out = [];
  const d = new Date(today() + "T00:00:00Z");
  for (let i = n - 1; i >= 0; i--) out.push(iso(new Date(d.getTime() - i * 864e5)));
  return out;
}
