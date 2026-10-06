import "server-only";
import { db } from "@/lib/server/db";
import { listUsers, today } from "@/lib/server/repo";
import { isShiftAnalyst } from "@/lib/server/stats";
import { APP_TIME_ZONE } from "@/lib/shifts";
import { addDays, diffDays, ISO, minIso } from "@/lib/analytics/calendar";
import { HISTORY_DAYS, MAX_WINDOW_DAYS } from "@/lib/analytics/config";
import { median } from "@/lib/analytics/format";
import { teamParts } from "@/lib/analytics/labels";
import { METRICS, stats } from "@/lib/analytics/metrics";
import { mockFacts } from "@/lib/analytics/mock";

/**
 * Whose data a viewer may see in analytics:
 * Security Manager → the department; SOC Manager → SOC; everyone else → only themselves
 * (plus anonymous team medians, see `peers`).
 */
export function scopeFor(user) {
  if (user.role === "security_manager") return { kind: "department" };
  if (user.role === "soc_manager") return { kind: "soc" };
  return { kind: "self", userId: user.id };
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const parseTs = (ts) => new Date(ts.includes("T") ? ts : `${ts.replace(" ", "T")}Z`);
/** Stored timestamp (UTC "YYYY-MM-DD HH:MM:SS" or ISO) → Tehran calendar day. */
function tehranDay(ts) {
  if (!ts) return null;
  const d = parseTs(ts);
  if (Number.isNaN(d.getTime())) return null;
  return dayFmt.format(d);
}

const toPerson = (u) => {
  const { group, level } = teamParts(u.team);
  return { id: u.id, name: u.name, role: u.role, team: u.team, group, level, active: !!u.active, color: u.color, shift: isShiftAnalyst(u), manager: u.role === "soc_manager" };
};

function scopedPeople(scope) {
  const all = listUsers().filter((u) => u.role !== "security_manager").map(toPerson).filter((p) => p.group);
  if (scope.kind === "department") return all;
  if (scope.kind === "soc") return all.filter((p) => p.group === "SOC");
  if (scope.kind === "group") return all.filter((p) => p.group === scope.group);
  return all.filter((p) => p.id === scope.userId);
}

const placeholders = (n) => Array.from({ length: n }, () => "?").join(",");

function loadTasks(ids, window) {
  if (!ids.length) return [];
  const rows = db.prepare(
    `SELECT id, title, assignee, status, prio, cx, due, hours, quality, created_at, started_at, completed_at, updated_at
     FROM tasks WHERE assignee IN (${placeholders(ids.length)})`
  ).all(...ids);
  const history = new Map();
  for (const t of db.prepare(
    `SELECT task_id, to_status, at FROM task_transitions
     WHERE task_id IN (SELECT id FROM tasks WHERE assignee IN (${placeholders(ids.length)})) ORDER BY id`
  ).all(...ids)) {
    if (!history.has(t.task_id)) history.set(t.task_id, []);
    history.get(t.task_id).push(t);
  }
  const out = [];
  for (const r of rows) {
    const h = history.get(r.id) ?? [];
    const last = (status) => { for (let i = h.length - 1; i >= 0; i--) if (h[i].to_status === status) return tehranDay(h[i].at); return null; };
    const created = tehranDay(r.created_at) ?? tehranDay(r.updated_at);
    const completed = r.status === "done" ? tehranDay(r.completed_at) : null;
    const closed = r.status === "done" ? completed : r.status === "cancelled" ? last("cancelled") ?? tehranDay(r.updated_at) : null;
    if (created > window.to || (closed && closed < window.from)) continue;
    let cycle = null;
    if (completed && r.started_at) {
      const days = (parseTs(r.completed_at) - parseTs(r.started_at)) / 864e5;
      if (Number.isFinite(days) && days >= 0) cycle = Math.round(days * 100) / 100;
    }
    out.push({
      id: r.id, title: r.title, a: r.assignee, status: r.status, prio: r.prio, cx: r.cx,
      due: ISO.test(r.due ?? "") ? r.due : null, hours: Number(r.hours) || 0, quality: r.status === "done" ? r.quality : null,
      created, started: tehranDay(r.started_at), completed, cycle,
      returns: h.filter((x) => x.to_status === "returned").map((x) => tehranDay(x.at)),
      blockedSince: r.status === "blocked" ? last("blocked") : null,
      reviewSince: r.status === "review" ? last("review") : null,
      closed,
    });
  }
  return out;
}

function loadShifts(ids, window) {
  if (!ids.length) return [];
  const args = [window.from, window.to, ...ids];
  const map = new Map();
  const key = (a, d) => `${a}|${d}`;
  for (const s of db.prepare(`SELECT user_id, date, shift_type FROM shift_schedules WHERE date BETWEEN ? AND ? AND user_id IN (${placeholders(ids.length)})`).all(...args)) {
    map.set(key(s.user_id, s.date), { a: s.user_id, date: s.date, type: s.shift_type, row: null });
  }
  for (const l of db.prepare(`SELECT user_id, date, data, completed_at, shift_type FROM shift_logs WHERE date BETWEEN ? AND ? AND user_id IN (${placeholders(ids.length)})`).all(...args)) {
    const k = key(l.user_id, l.date);
    const cur = map.get(k);
    map.set(k, { a: l.user_id, date: l.date, type: cur?.type ?? l.shift_type ?? "morning", row: l });
  }
  return [...map.values()].map(({ a, date, type, row }) => {
    const acts = Array(8).fill(null);
    let done = 0, total = 0, iocs = 0, issues = 0, report = false;
    if (row) {
      let list = [];
      try { list = JSON.parse(row.data); } catch {}
      for (const act of list) {
        total += 1;
        if (act.done) done += 1;
        if (act.n >= 1 && act.n <= 8) acts[act.n - 1] = act.done ? 1 : 0;
        if (act.issue) issues += 1;
        if (act.kind === "misp") iocs += Number(act.iocs) || 0;
        if (act.kind === "report" && act.done) report = true;
      }
    }
    return { a, date, type, log: !!row, closed: !!row?.completed_at, done, total, acts, iocs, report, issues };
  }).sort((x, y) => x.date.localeCompare(y.date));
}

function loadTickets(ids, window) {
  if (!ids.length) return [];
  return db.prepare(
    `SELECT user_id AS a, date, COUNT(*) AS n FROM tickets WHERE date BETWEEN ? AND ? AND user_id IN (${placeholders(ids.length)}) GROUP BY user_id, date ORDER BY date`
  ).all(window.from, window.to, ...ids).map((t) => ({ a: t.a, date: t.date, n: t.n }));
}

/** A valid window ending today at the latest, at most MAX_WINDOW_DAYS long, with a year of history by default. */
export function resolveWindow(q = {}, now = today()) {
  let to = ISO.test(q.wt ?? "") ? minIso(q.wt, now) : now;
  let from = ISO.test(q.wf ?? "") ? q.wf : addDays(now, -HISTORY_DAYS);
  from = minIso(from, addDays(now, -HISTORY_DAYS));
  if (from > to) from = to;
  if (diffDays(from, to) > MAX_WINDOW_DAYS) from = addDays(to, -MAX_WINDOW_DAYS);
  return { from, to };
}

function buildFromDb(scope, window, now) {
  const people = scopedPeople(scope);
  const ids = people.map((p) => p.id);
  return {
    version: 1, demo: false, today: now, generatedAt: new Date().toISOString(), window, scope: { kind: scope.kind },
    people, tasks: loadTasks(ids, window), shifts: loadShifts(ids, window), tickets: loadTickets(ids, window), peers: null,
  };
}

const PEER_KEYS = Object.keys(METRICS);

/** Anonymous medians of a person's team (only when at least 3 colleagues have activity), for the personal view. */
function peerMedians(user, window, now, ranges) {
  const me = toPerson(user);
  if (!me.group) return null;
  const facts = buildFromDb({ kind: "group", group: me.group }, window, now);
  const peers = facts.people.filter((p) => !p.manager && p.id !== me.id);
  const out = { group: me.group, count: 0 };
  for (const [name, range] of Object.entries(ranges)) {
    if (!range) continue;
    const rows = peers.map((p) => stats(facts, [p.id], range)).filter((s) => s.completed || s.created || s.shifts);
    out.count = Math.max(out.count, rows.length);
    out[name] = Object.fromEntries(PEER_KEYS.map((k) => [k, median(rows.map((s) => s[k]))]));
  }
  return out.count >= 3 ? out : { group: me.group, count: out.count, hidden: true };
}

const rangeParam = (from, to) => (ISO.test(from ?? "") && ISO.test(to ?? "") && from <= to ? { from, to, end: to } : null);

/**
 * Facts for a viewer: real data from the database, or demo data (managers only) when `demo` is set.
 * `q` carries the window (wf, wt) and, for the personal view, the selected and comparison ranges (rf, rt, cf, ct).
 */
export function factsFor(user, q = {}) {
  const now = today();
  const scope = scopeFor(user);
  const window = resolveWindow(q, now);
  if (q.demo === "1") {
    if (scope.kind === "self") return null;
    return mockFacts({ today: now, window, scope: scope.kind });
  }
  const facts = buildFromDb(scope, window, now);
  if (scope.kind === "self") facts.peers = peerMedians(user, window, now, { range: rangeParam(q.rf, q.rt), cmp: rangeParam(q.cf, q.ct) });
  return facts;
}

