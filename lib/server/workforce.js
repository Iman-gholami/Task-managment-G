import "server-only";
import { db } from "@/lib/server/db";
import { TEAMS, canManageMember, inReportScope } from "@/lib/roles";
import { listUsers, today } from "@/lib/server/repo";
import { isShiftAnalyst, teamOf } from "@/lib/server/stats";
import { scheduleStats } from "@/lib/shifts";
import { WEEKDAYS_FA, faDigits, fmtJalali, jalaliMonthKey, monthKeyLabel, monthKeysBetween } from "@/lib/jalali";
import {
  ACTIVITY_FA, COMPONENTS, CX_FA, PRIO_FA, PROFILE_FA, QUALITY_POINTS, QUAL_FA, ROLE_FA, SHIFT_FA, STATUS_FA, WEIGHTS,
  levelFor, overallScore, reviewSpeedScore, toneFor, workloadScore,
} from "@/lib/workforce";

/** Team filter values (see teamOf). */
export const TEAM_GROUPS = ["SOC", "Design & Automation", "Threat Intelligence"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (ts) => (ts ? String(ts).slice(0, 10) : null);
const time = (ts) => Date.parse(String(ts).includes("T") ? ts : `${String(ts).replace(" ", "T")}Z`);
const hoursBetween = (a, b) => (time(b) - time(a)) / 36e5;
const round1 = (n) => Math.round(n * 10) / 10;
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const sum = (rows, f) => rows.reduce((s, r) => s + (f(r) || 0), 0);
const isOpen = (t) => t.status !== "done" && t.status !== "cancelled";

/**
 * Everything the Workforce Performance report needs for one viewer and period.
 * - Security Manager: every member, with team and manager summaries.
 * - SOC Manager: the analysts of SOC · L1/L2/L3.
 * - Anyone else: themselves.
 * Members removed during the period are kept when they have activity in it. Scores are computed
 * over the whole department, so workload is always compared with the same peers.
 * `details` adds the per-task and per-shift rows used by the Excel export.
 */
export function workforceReport(viewer, period, { team, details = false } = {}) {
  const { from, to } = period;
  const now = today();
  const inPeriod = (d) => !!d && d >= from && d <= to;
  const all = listUsers();
  const byId = Object.fromEntries(all.map((u) => [u.id, u]));

  const tasks = db.prepare("SELECT * FROM tasks").all();
  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const events = db.prepare("SELECT task_id, user_id, text, created_at FROM task_events ORDER BY id").all();

  // Review decisions, each with how long the task waited since it was submitted.
  const lastSubmit = {};
  const decisions = [];
  for (const e of events) {
    if (e.text.startsWith("submitted it for review")) lastSubmit[e.task_id] = e.created_at;
    else if (e.text.startsWith("approved it") || e.text.startsWith("returned it for changes")) {
      const since = lastSubmit[e.task_id];
      decisions.push({ task: e.task_id, by: e.user_id, approved: e.text.startsWith("approved it"), at: e.created_at, wait: since ? Math.max(0, hoursBetween(since, e.created_at)) : null });
      delete lastSubmit[e.task_id];
    }
  }
  const periodDecisions = decisions.filter((d) => inPeriod(day(d.at)));
  const returnsByTask = {};
  for (const d of decisions) if (!d.approved) returnsByTask[d.task] = (returnsByTask[d.task] ?? 0) + 1;

  // Shifts still ahead are a plan, not performance: count them up to today.
  const schedules = db.prepare("SELECT user_id, date, shift_type FROM shift_schedules WHERE date BETWEEN ? AND ? ORDER BY date").all(from, to < now ? to : now);
  const logs = db.prepare("SELECT user_id, date, data, completed_at FROM shift_logs WHERE date BETWEEN ? AND ?").all(from, to)
    .map((l) => ({ user: l.user_id, date: l.date, completed: !!l.completed_at, acts: JSON.parse(l.data) }));
  const logOf = Object.fromEntries(logs.map((l) => [`${l.user}|${l.date}`, l]));
  const ticketCounts = db.prepare("SELECT user_id, date, COUNT(*) AS n FROM tickets WHERE date BETWEEN ? AND ? GROUP BY user_id, date").all(from, to);
  const ticketsOn = Object.fromEntries(ticketCounts.map((t) => [`${t.user_id}|${t.date}`, t.n]));
  const changes = db.prepare("SELECT requester_id, date, status, manager_approved_by, manager_approved_at FROM shift_change_requests").all();
  const months = monthKeysBetween(from, to);
  const evaluations = db.prepare(
    `SELECT e.user_id, e.month, e.evaluator_id, e.score, e.comment, e.updated_at, u.name AS evaluator_name
     FROM evaluations e LEFT JOIN users u ON u.id = e.evaluator_id
     WHERE e.month IN (${months.map(() => "?").join(",")}) ORDER BY e.month, e.updated_at`
  ).all(...months).map((e) => ({
    userId: e.user_id, month: e.month, monthLabel: monthKeyLabel(e.month), by: e.evaluator_id, byName: e.evaluator_name ?? "",
    score: e.score, comment: e.comment, at: e.updated_at,
  }));

  const started = (l) => !!l && (l.completed || l.acts.some((a) => a.done));

  function taskStats(u) {
    const mine = tasks.filter((t) => t.assignee === u.id);
    const ids = new Set(mine.map((t) => t.id));
    const done = mine.filter((t) => t.status === "done" && inPeriod(day(t.completed_at)));
    const withDue = done.filter((t) => DATE.test(t.due));
    const onTime = withDue.filter((t) => day(t.completed_at) <= t.due).length;
    const rated = done.filter((t) => t.quality in QUALITY_POINTS);
    const reviewed = periodDecisions.filter((d) => ids.has(d.task));
    const approvals = reviewed.filter((d) => d.approved).length;
    const returns = reviewed.length - approvals;
    const open = mine.filter(isOpen);
    const cycle = done.filter((t) => t.started_at).map((t) => hoursBetween(t.started_at, t.completed_at) / 24).filter((d) => d >= 0);
    const points = sum(done, (t) => t.cx);
    return {
      completed: done.length,
      hours: round1(sum(done, (t) => t.hours)),
      points,
      avgCx: done.length ? round1(points / done.length) : null,
      cx: [1, 2, 3, 4].map((c) => done.filter((t) => t.cx === c).length),
      quality: Object.keys(QUALITY_POINTS).map((q) => done.filter((t) => t.quality === q).length),
      qualityPct: rated.length ? Math.round(mean(rated.map((t) => QUALITY_POINTS[t.quality]))) : null,
      withDue: withDue.length,
      onTime,
      late: withDue.length - onTime,
      onTimePct: pct(onTime, withDue.length),
      approvals,
      returns,
      firstPass: pct(approvals, approvals + returns),
      openNow: open.filter((t) => t.status !== "backlog").length,
      overdueNow: open.filter((t) => DATE.test(t.due) && t.due < now).length,
      blockedNow: open.filter((t) => t.status === "blocked").length,
      cycleDays: cycle.length ? round1(mean(cycle)) : null,
      // Titles of the work behind the numbers, in completion order.
      doneTasks: done
        .sort((a, b) => a.completed_at.localeCompare(b.completed_at))
        .map((t) => ({ id: t.id, title: t.title, completed: day(t.completed_at), cx: t.cx, quality: t.quality, hours: t.hours, onTime: DATE.test(t.due) ? day(t.completed_at) <= t.due : null })),
    };
  }

  function shiftStats(u) {
    const mine = schedules.filter((s) => s.user_id === u.id).map((s) => ({ date: s.date, shiftType: s.shift_type }));
    const plan = scheduleStats(mine);
    // A shift counts once it is over; today's shift only once its log has started.
    const due = mine.filter((s) => s.date < now || (s.date === now && started(logOf[`${u.id}|${s.date}`])));
    const logged = due.filter((s) => started(logOf[`${u.id}|${s.date}`])).length;
    const myLogs = logs.filter((l) => l.user === u.id);
    const closed = myLogs.filter((l) => l.completed || l.date < now);
    let done = 0, total = 0, iocs = 0, reports = 0, issues = 0;
    const perActivity = Array.from({ length: 8 }, () => ({ done: 0, total: 0 }));
    for (const l of myLogs) {
      const counted = closed.includes(l);
      l.acts.forEach((a, i) => {
        if (a.issue) issues++;
        if (a.kind === "report" && a.done) reports++;
        if (a.kind === "misp") iocs += a.iocs || 0;
        if (!counted) return;
        total++;
        if (a.done) done++;
        const slot = perActivity[(a.n ?? i + 1) - 1];
        if (slot) { slot.total++; if (a.done) slot.done++; }
      });
    }
    const requests = changes.filter((c) => c.requester_id === u.id && inPeriod(c.date));
    return {
      scheduled: plan.total,
      hours: plan.hours,
      morning: plan.morning,
      evening: plan.evening,
      night: plan.night,
      thursdays: plan.thursdays,
      fridays: plan.fridays,
      due: due.length,
      logged,
      missing: due.length - logged,
      attendancePct: pct(logged, due.length),
      logs: myLogs.length,
      completedLogs: myLogs.filter((l) => l.completed).length,
      routinePct: pct(done, total),
      iocs,
      tickets: sum(ticketCounts.filter((t) => t.user_id === u.id), (t) => t.n),
      reports,
      issues,
      perActivity: perActivity.map((a) => pct(a.done, a.total)),
      changeRequests: requests.length,
      changesApproved: requests.filter((c) => c.status === "approved").length,
    };
  }

  function managerStats(m) {
    const mine = periodDecisions.filter((d) => d.by === m.id);
    const waits = mine.map((d) => d.wait).filter((w) => w !== null);
    const pending = tasks.filter((t) => t.status === "review" && byId[t.assignee] && canManageMember(m, byId[t.assignee]));
    const ages = pending.filter((t) => lastSubmit[t.id]).map((t) => hoursBetween(lastSubmit[t.id], new Date().toISOString()) / 24);
    return {
      reviewed: mine.length,
      approved: mine.filter((d) => d.approved).length,
      returned: mine.filter((d) => !d.approved).length,
      reviewHours: waits.length ? round1(mean(waits)) : null,
      pendingNow: pending.length,
      oldestPendingDays: ages.length ? round1(Math.max(...ages)) : null,
      assigned: events.filter((e) => e.user_id === m.id && e.text === "created the task" && inPeriod(day(e.created_at)) && taskById[e.task_id]?.assignee !== m.id).length,
      shiftChangesApproved: changes.filter((c) => c.manager_approved_by === m.id && inPeriod(day(c.manager_approved_at))).length,
    };
  }

  // Everyone the department report could contain (Security Managers are not scored).
  const people = all.filter((u) => u.role !== "security_manager").map((u) => {
    const profile = u.role === "soc_manager" ? "manager" : isShiftAnalyst(u) ? "shift" : "staff";
    const evals = evaluations.filter((e) => e.userId === u.id);
    return {
      id: u.id,
      name: u.name,
      team: u.team,
      role: u.role,
      roleLabel: ROLE_FA[u.role] ?? u.role,
      active: u.active,
      profile,
      ...taskStats(u),
      shift: profile === "shift" ? shiftStats(u) : null,
      mgr: profile === "manager" ? managerStats(u) : null,
      evaluations: evals,
      evalScore: evals.length ? round1(mean(evals.map((e) => e.score))) : null,
    };
  }).filter((p) => p.active || p.completed || p.approvals || p.returns || p.evaluations.length || p.shift?.scheduled || p.shift?.logs || p.mgr?.reviewed);

  // Workload is compared within peer groups: SOC shift analysts together, everyone else by team.
  const peerKey = (p) => (p.profile === "shift" ? "soc-shift" : p.profile === "manager" ? null : teamOf(p.team) ?? p.team);
  const peerAverage = {};
  for (const p of people) if (peerKey(p)) (peerAverage[peerKey(p)] ??= []).push(p.points);
  for (const k of Object.keys(peerAverage)) peerAverage[k] = mean(peerAverage[k]);

  const score = (p, extra = {}) => {
    p.parts = {
      quality: p.qualityPct,
      onTime: p.onTimePct,
      firstPass: p.firstPass,
      workload: peerKey(p) ? workloadScore(p.points, peerAverage[peerKey(p)]) : null,
      routine: p.shift?.routinePct ?? null,
      attendance: p.shift?.attendancePct ?? null,
      manager: p.evalScore !== null ? p.evalScore * 20 : null,
      ...extra,
    };
    p.score = overallScore(p.profile, p.parts);
    p.level = levelFor(p.score);
    p.tone = toneFor(p.score);
  };
  people.filter((p) => p.profile !== "manager").forEach((p) => score(p));
  const analystScores = people.filter((p) => p.profile === "shift" && p.score !== null).map((p) => p.score);
  const teamScore = analystScores.length ? Math.round(mean(analystScores)) : null;
  people.filter((p) => p.profile === "manager").forEach((p) => {
    p.mgr.teamScore = teamScore;
    score(p, { reviewSpeed: reviewSpeedScore(p.mgr.reviewHours), team: teamScore });
  });

  // What this viewer may see.
  const scope = viewer.role === "security_manager" ? "all" : viewer.role === "soc_manager" ? "soc" : "self";
  const order = (t) => (TEAMS.indexOf(t) === -1 ? TEAMS.length : TEAMS.indexOf(t));
  const rows = people
    .filter((p) => (scope === "self" ? p.id === viewer.id : inReportScope(viewer, byId[p.id]) && p.id !== viewer.id))
    .filter((p) => scope !== "all" || !team || teamOf(p.team) === team)
    .sort((a, b) => order(a.team) - order(b.team) || (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));

  const currentMonth = jalaliMonthKey(now);
  const out = {
    period,
    scope,
    team: scope === "all" ? team ?? null : null,
    people: rows,
    teams: scope === "self" ? [] : teamSummary(rows),
    // Evaluations are written for one month at a time, and not ahead of time.
    evalMonth: period.month && period.month <= currentMonth ? period.month : null,
    canEvaluate: rows.filter((p) => canManageMember(viewer, byId[p.id])).map((p) => p.id),
  };
  if (details) {
    const ids = new Set(rows.map((p) => p.id));
    const touched = new Set(events.filter((e) => inPeriod(day(e.created_at))).map((e) => e.task_id));
    out.tasks = tasks
      .filter((t) => ids.has(t.assignee) && ((t.status === "done" && inPeriod(day(t.completed_at))) || touched.has(t.id)))
      .sort((a, b) => (day(a.completed_at) ?? "9999").localeCompare(day(b.completed_at) ?? "9999") || a.id.localeCompare(b.id))
      .map((t) => ({
        id: t.id, title: t.title, assignee: byId[t.assignee]?.name ?? t.assignee, team: t.team, status: t.status, prio: t.prio, cx: t.cx,
        due: DATE.test(t.due) ? t.due : null, started: day(t.started_at), completed: t.status === "done" ? day(t.completed_at) : null,
        hours: t.hours, quality: t.quality, onTime: t.status === "done" && DATE.test(t.due) ? day(t.completed_at) <= t.due : null,
        returns: returnsByTask[t.id] ?? 0,
      }));
    out.shifts = schedules
      .filter((s) => ids.has(s.user_id))
      .map((s) => {
        const l = logOf[`${s.user_id}|${s.date}`];
        const status = l?.completed ? "تکمیل‌شده" : started(l) ? "ناقص" : s.date < now ? "ثبت نشده" : "امروز";
        return {
          date: s.date, name: byId[s.user_id]?.name ?? s.user_id, team: byId[s.user_id]?.team ?? "", shiftType: s.shift_type, status,
          done: l ? l.acts.filter((a) => a.done).length : null, total: l ? l.acts.length : null,
          iocs: l ? sum(l.acts.filter((a) => a.kind === "misp"), (a) => a.iocs) : null,
          issues: l ? l.acts.filter((a) => a.issue).length : null,
          tickets: ticketsOn[`${s.user_id}|${s.date}`] ?? 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  }
  return out;
}

/** One row per team present, plus the department total. */
function teamSummary(rows) {
  const groups = {};
  for (const p of rows) (groups[p.team] ??= []).push(p);
  const line = (team, ps) => {
    const scored = ps.filter((p) => p.score !== null).map((p) => p.score);
    const shift = ps.filter((p) => p.shift).map((p) => p.shift);
    const routine = shift.map((s) => s.routinePct).filter((v) => v !== null);
    return {
      team,
      people: ps.length,
      avgScore: scored.length ? Math.round(mean(scored)) : null,
      maxScore: scored.length ? Math.max(...scored) : null,
      minScore: scored.length ? Math.min(...scored) : null,
      completed: sum(ps, (p) => p.completed),
      hours: round1(sum(ps, (p) => p.hours)),
      onTimePct: pct(sum(ps, (p) => p.onTime), sum(ps, (p) => p.withDue)),
      returns: sum(ps, (p) => p.returns),
      overdueNow: sum(ps, (p) => p.overdueNow),
      shifts: shift.length ? sum(shift, (s) => s.scheduled) : null,
      missing: shift.length ? sum(shift, (s) => s.missing) : null,
      routinePct: routine.length ? Math.round(mean(routine)) : null,
      iocs: shift.length ? sum(shift, (s) => s.iocs) : null,
      tickets: shift.length ? sum(shift, (s) => s.tickets) : null,
    };
  };
  const out = Object.entries(groups).map(([team, ps]) => line(team, ps));
  if (out.length > 1) out.push({ ...line("کل", rows), total: true });
  return out;
}

// ---- Excel ------------------------------------------------------------------

const SCOPE_FA = { all: "همه‌ی تیم‌های دپارتمان امنیت", soc: "تحلیلگران SOC (سطح ۱، ۲ و ۳)", self: "گزارش شخصی" };
const yesNo = (v) => (v === true ? "بله" : v === false ? "خیر" : "");
const scoreTone = (r) => toneFor(r.score);

/** The report as workbook sheets (Persian, right-to-left) for toXlsx. */
export function workforceWorkbook(data, viewer) {
  const { period, people } = data;
  const title = `گزارش عملکرد نیروها — ${period.label}`;
  const comment = (p) => p.evaluations.map((e) => `${e.byName}${period.month ? "" : ` (${e.monthLabel})`}: ${e.comment || "—"}`).join(" | ");
  const sheets = [];

  sheets.push({
    name: "خلاصه عملکرد",
    freeze: 2,
    columns: [
      { header: "ردیف", key: "n", width: 6 }, { header: "نام", key: "name", width: 22 }, { header: "تیم", key: "team", width: 18 },
      { header: "سمت", key: "role", width: 12 }, { header: "وضعیت", key: "state", width: 9 },
      { header: "نمره کلی (از ۱۰۰)", key: "score", width: 11, tone: scoreTone }, { header: "سطح", key: "level", width: 13, tone: scoreTone },
      { header: "تسک انجام‌شده", key: "completed", width: 10 }, { header: "ساعت کار تسک‌ها", key: "hours", width: 10 },
      { header: "میانگین پیچیدگی (۱ تا ۴)", key: "avgCx", width: 12 }, { header: "کیفیت کار (٪)", key: "qualityPct", width: 10 },
      { header: "تحویل به‌موقع (٪)", key: "onTimePct", width: 10 }, { header: "تسک دیرتحویل", key: "late", width: 9 },
      { header: "برگشت برای اصلاح", key: "returns", width: 10 }, { header: "میانگین زمان انجام (روز)", key: "cycleDays", width: 12 },
      { header: "تسک باز (اکنون)", key: "openNow", width: 9 }, { header: "عقب‌افتاده (اکنون)", key: "overdueNow", width: 10 },
      { header: "شیفت", key: "scheduled", width: 7 }, { header: "ساعت شیفت", key: "shiftHours", width: 9 },
      { header: "شیفت بدون گزارش", key: "missing", width: 10 }, { header: "انجام فعالیت‌های روتین (٪)", key: "routinePct", width: 12 },
      { header: "IOC", key: "iocs", width: 7 }, { header: "تیکت", key: "tickets", width: 7 }, { header: "گزارش ترافیک", key: "reports", width: 9 },
      { header: "Issue", key: "issues", width: 7 }, { header: "نمره مدیر (از ۵)", key: "evalScore", width: 10 }, { header: "نظر مدیر", key: "comment", width: 50, wrap: true },
      { header: "عنوان تسک‌های انجام‌شده", key: "titles", width: 80, wrap: true },
    ],
    rows: people.map((p, i) => ({
      n: i + 1, name: p.name, team: p.team, role: p.roleLabel, state: p.active ? "فعال" : "غیرفعال", score: p.score, level: p.level,
      completed: p.completed, hours: p.hours, avgCx: p.avgCx, qualityPct: p.qualityPct, onTimePct: p.onTimePct, late: p.late, returns: p.returns,
      cycleDays: p.cycleDays, openNow: p.openNow, overdueNow: p.overdueNow,
      scheduled: p.shift?.scheduled ?? null, shiftHours: p.shift?.hours ?? null, missing: p.shift?.missing ?? null, routinePct: p.shift?.routinePct ?? null,
      iocs: p.shift?.iocs ?? null, tickets: p.shift?.tickets ?? null, reports: p.shift?.reports ?? null, issues: p.shift?.issues ?? null,
      evalScore: p.evalScore, comment: comment(p), titles: p.doneTasks.map((t, i) => `${faDigits(i + 1)}- ${t.title}`).join(" ؛ "),
    })),
  });

  // Every completed task, person by person: the list behind each "completed tasks" figure.
  sheets.push({
    name: "تسک‌های انجام‌شده",
    freeze: 2,
    columns: [
      { header: "نام", key: "name", width: 22 }, { header: "تیم", key: "team", width: 16 }, { header: "ردیف", key: "n", width: 6 },
      { header: "عنوان تسک", key: "title", width: 50 }, { header: "شناسه", key: "id", width: 9 }, { header: "تاریخ تأیید", key: "completed", width: 11 },
      { header: "پیچیدگی", key: "cx", width: 9 }, { header: "کیفیت", key: "quality", width: 12 }, { header: "ساعت", key: "hours", width: 7 }, { header: "به‌موقع", key: "onTime", width: 8 },
    ],
    rows: people.flatMap((p) => p.doneTasks.map((t, i) => ({
      name: p.name, team: p.team, n: i + 1, title: t.title, id: t.id, completed: fmtJalali(t.completed), cx: CX_FA[t.cx] ?? "",
      quality: QUAL_FA[t.quality] ?? "", hours: t.hours, onTime: yesNo(t.onTime),
    }))),
  });

  if (data.teams.length > 1) {
    sheets.push({
      name: "خلاصه تیم‌ها",
      freeze: 1,
      columns: [
        { header: "تیم", key: "team", width: 20 }, { header: "تعداد نفرات", key: "people", width: 9 },
        { header: "میانگین نمره", key: "avgScore", width: 10, tone: (r) => toneFor(r.avgScore) }, { header: "بالاترین نمره", key: "maxScore", width: 10 }, { header: "پایین‌ترین نمره", key: "minScore", width: 10 },
        { header: "تسک انجام‌شده", key: "completed", width: 10 }, { header: "ساعت کار تسک‌ها", key: "hours", width: 10 }, { header: "تحویل به‌موقع (٪)", key: "onTimePct", width: 10 },
        { header: "برگشت برای اصلاح", key: "returns", width: 10 }, { header: "عقب‌افتاده (اکنون)", key: "overdueNow", width: 10 },
        { header: "شیفت", key: "shifts", width: 7 }, { header: "شیفت بدون گزارش", key: "missing", width: 10 }, { header: "انجام فعالیت‌های روتین (٪)", key: "routinePct", width: 12 },
        { header: "IOC", key: "iocs", width: 7 }, { header: "تیکت", key: "tickets", width: 7 },
      ],
      rows: data.teams,
    });
  }

  const managers = people.filter((p) => p.mgr);
  if (managers.length) {
    sheets.push({
      name: "مدیران",
      freeze: 1,
      columns: [
        { header: "نام", key: "name", width: 22 }, { header: "تیم", key: "team", width: 12 },
        { header: "نمره کلی (از ۱۰۰)", key: "score", width: 11, tone: scoreTone }, { header: "سطح", key: "level", width: 13, tone: scoreTone },
        { header: "تسک بررسی‌شده", key: "reviewed", width: 10 }, { header: "تأیید", key: "approved", width: 7 }, { header: "برگشت برای اصلاح", key: "returned", width: 10 },
        { header: "میانگین زمان بررسی (ساعت)", key: "reviewHours", width: 12 }, { header: "منتظر بررسی (اکنون)", key: "pendingNow", width: 10 },
        { header: "قدیمی‌ترین بررسی معطل (روز)", key: "oldestPendingDays", width: 12 }, { header: "تسک واگذارشده به دیگران", key: "assigned", width: 12 },
        { header: "جابه‌جایی شیفت تأییدشده", key: "shiftChangesApproved", width: 12 }, { header: "میانگین نمره تحلیلگران", key: "teamScore", width: 12 },
        { header: "تسک انجام‌شده (شخصی)", key: "completed", width: 11 }, { header: "نمره مدیر (از ۵)", key: "evalScore", width: 10 }, { header: "نظر مدیر", key: "comment", width: 50, wrap: true },
      ],
      rows: managers.map((p) => ({ ...p.mgr, name: p.name, team: p.team, score: p.score, level: p.level, completed: p.completed, evalScore: p.evalScore, comment: comment(p) })),
    });
  }

  const analysts = people.filter((p) => p.shift);
  if (analysts.length) {
    sheets.push({
      name: "شیفت‌ها",
      freeze: 1,
      columns: [
        { header: "نام", key: "name", width: 22 }, { header: "تیم", key: "team", width: 10 },
        { header: "کل شیفت‌ها", key: "scheduled", width: 8 }, { header: "صبح", key: "morning", width: 6 }, { header: "تا ۸ شب", key: "evening", width: 7 }, { header: "شب", key: "night", width: 6 },
        { header: "پنجشنبه", key: "thursdays", width: 7 }, { header: "جمعه", key: "fridays", width: 6 }, { header: "ساعت شیفت", key: "hours", width: 8 },
        { header: "شیفت سپری‌شده", key: "due", width: 9 }, { header: "با گزارش", key: "logged", width: 8 }, { header: "بدون گزارش", key: "missing", width: 8 },
        { header: "ثبت گزارش شیفت (٪)", key: "attendancePct", width: 11 }, { header: "Shift Log تکمیل‌شده", key: "completedLogs", width: 11 },
        { header: "انجام فعالیت‌های روتین (٪)", key: "routinePct", width: 12 },
        ...ACTIVITY_FA.map((a, i) => ({ header: `${i + 1}. ${a} (٪)`, key: `a${i}`, width: 13 })),
        { header: "IOC", key: "iocs", width: 7 }, { header: "تیکت", key: "tickets", width: 7 }, { header: "گزارش ترافیک", key: "reports", width: 9 }, { header: "Issue", key: "issues", width: 7 },
        { header: "درخواست جابه‌جایی", key: "changeRequests", width: 10 }, { header: "جابه‌جایی تأییدشده", key: "changesApproved", width: 10 },
      ],
      rows: analysts.map((p) => ({ name: p.name, team: p.team, ...p.shift, ...Object.fromEntries(p.shift.perActivity.map((v, i) => [`a${i}`, v])) })),
    });
  }

  if (data.tasks) {
    sheets.push({
      name: "همه‌ی تسک‌های دوره",
      freeze: 2,
      columns: [
        { header: "شناسه", key: "id", width: 9 }, { header: "عنوان", key: "title", width: 40 }, { header: "مسئول", key: "assignee", width: 20 }, { header: "تیم", key: "team", width: 16 },
        { header: "وضعیت", key: "status", width: 14 }, { header: "اولویت", key: "prio", width: 8 }, { header: "پیچیدگی", key: "cx", width: 9 },
        { header: "موعد", key: "due", width: 11 }, { header: "شروع", key: "started", width: 11 }, { header: "تأیید", key: "completed", width: 11 },
        { header: "ساعت", key: "hours", width: 7 }, { header: "کیفیت", key: "quality", width: 12 }, { header: "به‌موقع", key: "onTime", width: 8 },
        { header: "دفعات برگشت برای اصلاح", key: "returns", width: 11 },
      ],
      rows: data.tasks.map((t) => ({
        ...t, status: STATUS_FA[t.status] ?? t.status, prio: PRIO_FA[t.prio] ?? t.prio, cx: CX_FA[t.cx] ?? "", due: fmtJalali(t.due), started: fmtJalali(t.started),
        completed: fmtJalali(t.completed), quality: QUAL_FA[t.quality] ?? "", onTime: yesNo(t.onTime),
      })),
    });
  }

  if (data.shifts?.length) {
    sheets.push({
      name: "ریز شیفت‌ها",
      freeze: 3,
      columns: [
        { header: "تاریخ", key: "date", width: 11 }, { header: "روز", key: "weekday", width: 10 }, { header: "نام", key: "name", width: 20 }, { header: "تیم", key: "team", width: 10 },
        { header: "شیفت", key: "shift", width: 7 }, { header: "وضعیت گزارش شیفت", key: "status", width: 14, tone: (r) => ({ "تکمیل‌شده": "good", "ناقص": "warn", "ثبت نشده": "bad" })[r.status] ?? null },
        { header: "فعالیت انجام‌شده", key: "done", width: 10 }, { header: "کل فعالیت‌ها", key: "total", width: 8 }, { header: "IOC", key: "iocs", width: 6 }, { header: "تیکت", key: "tickets", width: 6 }, { header: "Issue", key: "issues", width: 6 },
      ],
      rows: data.shifts.map((s) => ({ ...s, date: fmtJalali(s.date), weekday: WEEKDAYS_FA[new Date(`${s.date}T00:00:00Z`).getUTCDay()], shift: SHIFT_FA[s.shiftType] ?? s.shiftType })),
    });
  }

  const evaluations = people.flatMap((p) => p.evaluations.map((e) => ({ name: p.name, team: p.team, month: e.monthLabel, by: e.byName, score: e.score, comment: e.comment, at: fmtJalali(e.at) })));
  sheets.push({
    name: "ارزیابی مدیران",
    freeze: 1,
    columns: [
      { header: "نام", key: "name", width: 22 }, { header: "تیم", key: "team", width: 16 }, { header: "ماه", key: "month", width: 12 }, { header: "ارزیاب", key: "by", width: 20 },
      { header: "نمره (از ۵)", key: "score", width: 9 }, { header: "نظر", key: "comment", width: 70, wrap: true }, { header: "آخرین ویرایش", key: "at", width: 12 },
    ],
    rows: evaluations,
  });

  sheets.push({
    name: "راهنمای نمره",
    columns: [{ header: "گروه", key: "profile", width: 28 }, { header: "بخش نمره", key: "part", width: 26 }, { header: "وزن", key: "weight", width: 7 }, { header: "نحوه‌ی محاسبه", key: "how", width: 90 }],
    rows: [
      ...Object.entries(WEIGHTS).flatMap(([profile, w]) => Object.entries(w).map(([k, weight]) => ({ profile: PROFILE_FA[profile], part: COMPONENTS[k].label, weight, how: COMPONENTS[k].how }))),
      { profile: "همه", part: "داده‌ی ناموجود", weight: null, how: "اگر برای بخشی داده‌ای نباشد (مثلاً تسکی تأیید نشده یا شیفتی نداشته)، آن بخش حذف و وزنش بین بقیه پخش می‌شود." },
      { profile: "همه", part: "سطح", weight: null, how: "۸۵ و بالاتر عالی · ۷۰ تا ۸۴ خوب · ۵۰ تا ۶۹ قابل قبول · زیر ۵۰ نیاز به بهبود" },
    ],
  });

  return {
    title,
    rtl: true,
    sheets,
    infoName: "مشخصات گزارش",
    info: [
      ["عنوان گزارش", title], ["دوره", period.label], ["از تاریخ", fmtJalali(period.from)], ["تا تاریخ", fmtJalali(period.to)],
      ["محدوده", data.team ? `${SCOPE_FA[data.scope]} — ${data.team}` : SCOPE_FA[data.scope]], ["تعداد نفرات", people.length],
      ["تهیه‌کننده", viewer.name], ["تاریخ تهیه", fmtJalali(today())],
      ["توضیح", "ستون‌های «اکنون» وضعیت لحظه‌ی تهیه‌ی گزارش را نشان می‌دهند؛ بقیه‌ی ستون‌ها مربوط به همین دوره‌اند."],
      ["برگه‌های تسک", "«تسک‌های انجام‌شده»: تسک‌های تأییدشده‌ی دوره، نفر به نفر. «همه‌ی تسک‌های دوره»: هر تسکی که در این دوره تأیید شده یا رویش کاری انجام شده، از جمله تسک‌های باز."],
    ],
  };
}
