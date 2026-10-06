// Statistics over analytics facts. Everything is computed from one structure: a table per person of
// per-day aggregates. Any period, team, level or chart bucket is a sum of those days, so every number on
// every screen (and in the Excel export) comes from the same arithmetic.
//
// Facts (built by lib/server/analytics.js or lib/analytics/mock.js):
//   people:  { id, name, role, team, group, level, active, color, shift, manager }
//   tasks:   { id, title, a, status, prio, cx, due, hours, quality, created, started, completed, cycle, returns[], blockedSince, reviewSince, closed }
//   shifts:  { a, date, type, log, closed, done, total, acts[8] (1 | 0 | null), iocs, report, issues }
//   tickets: { a, date, n }
import { addDays, diffDays } from "./calendar.js";
import { MIN_SAMPLE } from "./config.js";
import { isNum, median, ratio } from "./format.js";
import { GROUPS, OPEN_STATUSES, PRIO_KEYS, SHIFT_HOURS, groupFa } from "./labels.js";

const QIDX = { excellent: 0, good: 1, acceptable: 2, needs: 3 };
const TYPE_FIELD = { morning: "sM", evening: "sE", night: "sN" };

function newAgg() {
  return {
    completed: 0, units: 0, hours: 0, created: 0, dueN: 0, onTime: 0, cycle: [], returnedTasks: 0, returns: 0,
    q: [0, 0, 0, 0], cx: [0, 0, 0, 0],
    shifts: 0, sM: 0, sE: 0, sN: 0, shiftHours: 0, past: 0, closedPast: 0, logs: 0, closed: 0,
    actsDone: 0, actsTotal: 0, actDone: [0, 0, 0, 0, 0, 0, 0, 0], actTotal: [0, 0, 0, 0, 0, 0, 0, 0],
    iocs: 0, reports: 0, issues: 0, tickets: 0,
  };
}

function addInto(a, b) {
  for (const k in b) {
    const v = b[k];
    if (k === "cycle") { for (const x of v) a.cycle.push(x); }
    else if (Array.isArray(v)) v.forEach((x, i) => { a[k][i] += x; });
    else a[k] += v;
  }
  return a;
}

const cache = new WeakMap();

/** Per-person day tables: Map(personId → Map(isoDate → aggregate)). Built once per facts object. */
export function tables(facts) {
  let t = cache.get(facts);
  if (t) return t;
  const byPerson = new Map();
  const day = (a, date) => {
    let m = byPerson.get(a);
    if (!m) byPerson.set(a, (m = new Map()));
    let g = m.get(date);
    if (!g) m.set(date, (g = newAgg()));
    return g;
  };
  for (const task of facts.tasks) {
    if (task.created) day(task.a, task.created).created += 1;
    for (const r of task.returns ?? []) day(task.a, r).returns += 1;
    if (task.completed) {
      const g = day(task.a, task.completed);
      g.completed += 1;
      g.units += task.cx;
      g.hours += task.hours || 0;
      g.cx[task.cx - 1] += 1;
      if (task.quality in QIDX) g.q[QIDX[task.quality]] += 1;
      if (task.due) { g.dueN += 1; if (task.completed <= task.due) g.onTime += 1; }
      if (isNum(task.cycle)) g.cycle.push(task.cycle);
      if (task.returns?.length) g.returnedTasks += 1;
    }
  }
  for (const s of facts.shifts) {
    const g = day(s.a, s.date);
    g.shifts += 1;
    if (TYPE_FIELD[s.type]) g[TYPE_FIELD[s.type]] += 1;
    g.shiftHours += SHIFT_HOURS[s.type] ?? 0;
    if (s.date < facts.today) { g.past += 1; if (s.closed) g.closedPast += 1; }
    if (s.log) g.logs += 1;
    if (s.closed) g.closed += 1;
    g.actsDone += s.done;
    g.actsTotal += s.total;
    s.acts.forEach((v, i) => { if (v === 0 || v === 1) { g.actTotal[i] += 1; g.actDone[i] += v; } });
    g.iocs += s.iocs;
    if (s.report) g.reports += 1;
    g.issues += s.issues;
  }
  for (const tk of facts.tickets) day(tk.a, tk.date).tickets += tk.n;
  t = { byPerson };
  cache.set(facts, t);
  return t;
}

/** Sum of day aggregates for `ids` (all people when null) between `from` and `to` inclusive. */
export function aggregate(facts, ids, from, to) {
  const out = newAgg();
  const { byPerson } = tables(facts);
  const people = ids ? ids : [...byPerson.keys()];
  for (const id of people) {
    const m = byPerson.get(id);
    if (!m) continue;
    for (const [date, g] of m) if (date >= from && date <= to) addInto(out, g);
  }
  return out;
}

/** Aggregate → the statistics every screen shows. Rates and medians below MIN_SAMPLE are null. */
export function derive(g) {
  const qN = g.q.reduce((s, x) => s + x, 0);
  return {
    completed: g.completed,
    units: g.units,
    hours: Math.round(g.hours * 10) / 10,
    hoursPerTask: g.completed ? g.hours / g.completed : null,
    onTimeRate: g.dueN >= MIN_SAMPLE ? g.onTime / g.dueN : null,
    onTimeN: g.dueN,
    onTime: g.onTime,
    cycleMedian: g.cycle.length >= MIN_SAMPLE ? median(g.cycle) : null,
    cycleN: g.cycle.length,
    returns: g.returns,
    returnShare: g.completed >= MIN_SAMPLE ? g.returnedTasks / g.completed : null,
    returnedTasks: g.returnedTasks,
    created: g.created,
    net: g.created - g.completed,
    quality: g.q,
    qualityN: qN,
    highQualityShare: qN >= MIN_SAMPLE ? (g.q[0] + g.q[1]) / qN : null,
    cx: g.cx,
    complexShare: g.completed >= MIN_SAMPLE ? (g.cx[2] + g.cx[3]) / g.completed : null,
    shifts: g.shifts,
    shiftTypes: { morning: g.sM, evening: g.sE, night: g.sN },
    shiftHours: g.shiftHours,
    past: g.past,
    closedPast: g.closedPast,
    closureRate: g.past ? g.closedPast / g.past : null,
    missed: g.past - g.closedPast,
    logs: g.logs,
    routineRate: g.actsTotal ? g.actsDone / g.actsTotal : null,
    actsDone: g.actsDone,
    actsTotal: g.actsTotal,
    activityRates: g.actTotal.map((t, i) => (t ? g.actDone[i] / t : null)),
    activityN: g.actTotal,
    iocs: g.iocs,
    iocPerShift: ratio(g.iocs, g.logs),
    tickets: g.tickets,
    ticketsPerShift: ratio(g.tickets, g.logs),
    reports: g.reports,
    issues: g.issues,
  };
}

export const stats = (facts, ids, range) => derive(aggregate(facts, ids, range.from, range.end ?? range.to));

/**
 * Metrics the trend, compare and distribution views can pick from. `kind` decides formatting and how
 * a change is stated (rates in points); `area` keeps SOC-only figures apart from task figures.
 * `perCapita` marks counts that make sense divided by headcount.
 */
export const METRICS = {
  completed: { label: "تسک تکمیل‌شده", short: "تکمیل‌شده", kind: "count", area: "task", perCapita: true, hint: "تسک‌هایی که تاریخ تأییدشان در دوره است" },
  units: { label: "حجم کار وزن‌دار", short: "حجم وزن‌دار", kind: "count", area: "task", perCapita: true, hint: "جمع سطح پیچیدگی تسک‌های تکمیل‌شده (ساده ۱ تا پیشرفته ۴)" },
  hours: { label: "ساعت ثبت‌شده", short: "ساعت", kind: "count", area: "task", perCapita: true, hint: "جمع ساعت تسک‌های تکمیل‌شده؛ دستی وارد می‌شود" },
  hoursPerTask: { label: "ساعت به ازای تسک", short: "ساعت/تسک", kind: "avg", area: "task" },
  onTimeRate: { label: "تحویل به‌موقع", short: "به‌موقع", kind: "rate", area: "task", n: "onTimeN", hint: "تکمیل‌شده‌هایی که تا ددلاین تأیید شده‌اند، از میان تسک‌های دارای ددلاین" },
  cycleMedian: { label: "میانه زمان انجام", short: "زمان انجام", kind: "days", area: "task", n: "cycleN", hint: "میانه روزها از شروع تا تأیید" },
  returnShare: { label: "سهم تسک‌های برگشتی", short: "برگشتی", kind: "rate", area: "task", hint: "تکمیل‌شده‌هایی که حداقل یک بار برای اصلاح برگشت خورده‌اند" },
  created: { label: "تسک ایجادشده", short: "ایجادشده", kind: "count", area: "task", perCapita: true, hint: "ورودی کار در دوره" },
  highQualityShare: { label: "سهم کیفیت عالی و خوب", short: "عالی و خوب", kind: "rate", area: "task", n: "qualityN" },
  complexShare: { label: "سهم کار پیچیده و پیشرفته", short: "پیچیده", kind: "rate", area: "task" },
  shifts: { label: "شیفت", short: "شیفت", kind: "count", area: "soc", perCapita: true },
  closureRate: { label: "بسته‌شدن شیفت‌لاگ", short: "بسته‌شدن لاگ", kind: "rate", area: "soc", n: "past", hint: "شیفت‌لاگ‌های کامل‌شده از میان شیفت‌های گذشته" },
  routineRate: { label: "انجام روتین", short: "روتین", kind: "rate", area: "soc", n: "actsTotal", hint: "فعالیت‌های انجام‌شده از کل فعالیت‌های شیفت‌لاگ‌ها" },
  iocs: { label: "IOC ثبت‌شده", short: "IOC", kind: "count", area: "soc", perCapita: true },
  iocPerShift: { label: "IOC به ازای شیفت", short: "IOC/شیفت", kind: "avg", area: "soc" },
  tickets: { label: "تیکت", short: "تیکت", kind: "count", area: "soc", perCapita: true, hint: "فقط تعداد تیکت‌های ثبت‌شده در شیفت‌لاگ" },
  ticketsPerShift: { label: "تیکت به ازای شیفت", short: "تیکت/شیفت", kind: "avg", area: "soc" },
  reports: { label: "گزارش ترافیک", short: "گزارش ترافیک", kind: "count", area: "soc", perCapita: true },
  issues: { label: "Issue گزارش‌شده", short: "Issue", kind: "count", area: "soc", perCapita: true },
};
export const TASK_METRICS = Object.keys(METRICS).filter((k) => METRICS[k].area === "task");
export const SOC_METRICS = Object.keys(METRICS).filter((k) => METRICS[k].area === "soc");

// ---- People, teams, levels ---------------------------------------------------------

export const experts = (facts) => facts.people.filter((p) => !p.manager);
export const idsOf = (people) => people.map((p) => p.id);
export const groupPeople = (facts, group, { includeManagers = true } = {}) =>
  facts.people.filter((p) => p.group === group && (includeManagers || !p.manager));

/** Groups present in the facts, in the fixed order (SOC, Design & Automation, Threat Intelligence). */
export const groupsIn = (facts) => GROUPS.filter((g) => facts.people.some((p) => p.group === g.name && !p.manager));

const hadActivity = (s) => s.completed > 0 || s.created > 0 || s.shifts > 0 || s.tickets > 0;

/** Experts who count for a period: active now, or did any recorded work in it. */
export function headcount(facts, people, range) {
  return people.filter((p) => !p.manager && (p.active || hadActivity(stats(facts, [p.id], range)))).length;
}

/** Current state of open work (independent of the period). */
export function openStats(facts, ids, today = facts.today) {
  const set = ids ? new Set(ids) : null;
  const out = { open: 0, overdue: 0, overdueHigh: 0, overdueOld: 0, blocked: 0, review: 0, returned: 0, backlog: 0, byStatus: {}, byPrio: Object.fromEntries(PRIO_KEYS.map((k) => [k, 0])) };
  for (const t of facts.tasks) {
    if (set && !set.has(t.a)) continue;
    if (!OPEN_STATUSES.includes(t.status)) continue;
    out.open += 1;
    out.byStatus[t.status] = (out.byStatus[t.status] ?? 0) + 1;
    out.byPrio[t.prio] = (out.byPrio[t.prio] ?? 0) + 1;
    if (t.status === "blocked") out.blocked += 1;
    if (t.status === "review") out.review += 1;
    if (t.status === "returned") out.returned += 1;
    if (t.status === "backlog") out.backlog += 1;
    if (t.due && t.due < today) {
      out.overdue += 1;
      if (t.prio === "high" || t.prio === "critical") out.overdueHigh += 1;
      if (diffDays(t.due, today) > 7) out.overdueOld += 1;
    }
  }
  return out;
}

const perCapita = (s, n) => Object.fromEntries(Object.keys(METRICS).filter((k) => METRICS[k].perCapita).map((k) => [k, n ? s[k] / n : null]));

/** One row per expert: this period, the comparison period and open work. Alphabetical. */
export function peopleRows(facts, range, cmp) {
  return experts(facts)
    .map((p) => {
      const cur = stats(facts, [p.id], range);
      return { person: p, cur, prev: cmp ? stats(facts, [p.id], cmp) : null, open: openStats(facts, [p.id]), activeInPeriod: hadActivity(cur) };
    })
    .filter((r) => r.person.active || r.activeInPeriod)
    .sort((a, b) => a.person.name.localeCompare(b.person.name, "fa"));
}

/** One row per team: totals, per-capita figures, open work and headcount. */
export function teamRows(facts, range, cmp) {
  return groupsIn(facts).map((g) => {
    const people = groupPeople(facts, g.name);
    const ids = idsOf(people);
    const cur = stats(facts, ids, range);
    const prev = cmp ? stats(facts, ids, cmp) : null;
    const n = headcount(facts, people, range);
    const nPrev = cmp ? headcount(facts, people, cmp) : null;
    return { key: g.key, group: g.name, fa: g.fa, headcount: n, cur, prev, pc: perCapita(cur, n), prevPc: prev ? perCapita(prev, nPrev) : null, open: openStats(facts, ids), people };
  });
}

/** SOC levels (L1–L3) inside one group. */
export function levelRows(facts, range, cmp, group = "SOC") {
  return ["L1", "L2", "L3"].map((level) => {
    const people = facts.people.filter((p) => p.group === group && p.level === level);
    if (!people.length) return null;
    const ids = idsOf(people);
    const cur = stats(facts, ids, range);
    const n = headcount(facts, people, range);
    return { level, headcount: n, cur, prev: cmp ? stats(facts, ids, cmp) : null, pc: perCapita(cur, n), open: openStats(facts, ids), people };
  }).filter(Boolean);
}

/** Median of a metric across a set of people (only those with activity), for "vs team median". */
export function peerMedian(facts, people, range, key) {
  const vals = people
    .filter((p) => !p.manager)
    .map((p) => stats(facts, [p.id], range))
    .filter(hadActivity)
    .map((s) => s[key]);
  return median(vals);
}

/** Statistics per bucket (array aligned with `bucketList`). */
export const bucketStats = (facts, ids, bucketList) => bucketList.map((b) => derive(aggregate(facts, ids, b.from, b.to)));

/** Open tasks at the end of each bucket, rebuilt from creation and closing dates. */
export function backlogSeries(facts, ids, bucketList) {
  const set = ids ? new Set(ids) : null;
  const tasks = facts.tasks.filter((t) => !set || set.has(t.a));
  return bucketList.map((b) => tasks.filter((t) => t.created && t.created <= b.to && (!t.closed || t.closed > b.to)).length);
}

/** Daily values for one metric between two dates (for calendar heatmaps and spike detection). */
export function dailySeries(facts, ids, from, to, key) {
  const { byPerson } = tables(facts);
  const merged = new Map();
  for (const id of ids ?? byPerson.keys()) {
    for (const [date, g] of byPerson.get(id) ?? []) {
      if (date < from || date > to) continue;
      if (!merged.has(date)) merged.set(date, newAgg());
      addInto(merged.get(date), g);
    }
  }
  const out = [];
  const empty = derive(newAgg());
  for (let d = from; d <= to; d = addDays(d, 1)) out.push([d, (merged.has(d) ? derive(merged.get(d)) : empty)[key]]);
  return out;
}

export const groupLabel = groupFa;
