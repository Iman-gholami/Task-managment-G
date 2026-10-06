// Operational alerts: what needs action now. They describe work items and coverage, never a
// judgement of a person. Thresholds live in config.js.
import { addDays, diffDays, faDate, weekStart } from "./calendar.js";
import { ALERTS } from "./config.js";
import { fmtInt, fmtNum, fmtPct, median } from "./format.js";
import { OPEN_STATUSES, PRIO_FA, groupFa } from "./labels.js";
import { aggregate, derive, experts, groupsIn, idsOf, openStats, stats } from "./metrics.js";

export const LEVELS = { critical: { fa: "بحرانی", order: 0 }, warning: { fa: "نیازمند توجه", order: 1 }, info: { fa: "اطلاع", order: 2 } };

const n = (x) => fmtInt(x);

function byGroup(list, people) {
  const counts = {};
  for (const t of list) {
    const g = people.get(t.a)?.group;
    if (g) counts[g] = (counts[g] ?? 0) + 1;
  }
  return Object.entries(counts).map(([g, c]) => `${groupFa(g)}: ${n(c)}`).join(" · ");
}

/** Every alert for the facts' current state. Sorted critical → info, then by count. */
export function buildAlerts(facts, { range, cmp } = {}) {
  const today = facts.today;
  const people = new Map(facts.people.map((p) => [p.id, p]));
  const name = (id) => people.get(id)?.name ?? "—";
  const out = [];
  const open = facts.tasks.filter((t) => OPEN_STATUSES.includes(t.status));
  const late = (t) => diffDays(t.due, today);
  const taskItem = (t, sub) => ({ kind: "task", id: t.id, label: `${t.id} · ${t.title}`, sub, href: `/tasks/${t.id}`, person: t.a });
  const overdue = open.filter((t) => t.due && t.due < today).sort((a, b) => a.due.localeCompare(b.due));
  const shown = new Set();

  const high = overdue.filter((t) => t.prio === "high" || t.prio === "critical");
  if (high.length) {
    high.forEach((t) => shown.add(t.id));
    out.push({
      id: "overdue-high", level: "critical", count: high.length,
      title: `${n(high.length)} تسک معوق با اولویت بالا یا بحرانی`,
      detail: byGroup(high, people),
      items: high.map((t) => taskItem(t, `${n(late(t))} روز تأخیر · ${PRIO_FA[t.prio]} · ${name(t.a)}`)),
    });
  }

  const old = overdue.filter((t) => !shown.has(t.id) && late(t) > ALERTS.overdueOldDays);
  if (old.length) {
    old.forEach((t) => shown.add(t.id));
    out.push({
      id: "overdue-old", level: "critical", count: old.length,
      title: `${n(old.length)} تسک بیش از ${n(ALERTS.overdueOldDays)} روز از ددلاین گذشته`,
      detail: byGroup(old, people),
      items: old.map((t) => taskItem(t, `${n(late(t))} روز تأخیر · ${name(t.a)}`)),
    });
  }

  const since = addDays(today, -ALERTS.missedLogDays);
  const missed = facts.shifts.filter((s) => s.date >= since && s.date < today && !s.closed).sort((a, b) => b.date.localeCompare(a.date));
  if (missed.length) {
    out.push({
      id: "missed-logs", level: "critical", count: missed.length,
      title: `${n(missed.length)} شیفت‌لاگ کامل‌نشده در ${n(ALERTS.missedLogDays)} روز گذشته`,
      detail: `${n(new Set(missed.map((s) => s.a)).size)} تحلیلگر`,
      items: missed.map((s) => ({ kind: "shift", id: `${s.a}-${s.date}`, label: name(s.a), sub: `${faDate(s.date, { year: false })} · ${s.log ? "ناقص" : "ثبت‌نشده"}`, href: `/analytics/people/${s.a}`, person: s.a })),
    });
  }

  const blocked = open.filter((t) => t.status === "blocked" && t.blockedSince && diffDays(t.blockedSince, today) > ALERTS.blockedDays);
  if (blocked.length) {
    out.push({
      id: "blocked-long", level: "warning", count: blocked.length,
      title: `${n(blocked.length)} تسک بیش از ${n(ALERTS.blockedDays)} روز مسدود مانده`,
      detail: byGroup(blocked, people),
      items: blocked.map((t) => taskItem(t, `${n(diffDays(t.blockedSince, today))} روز مسدود · ${name(t.a)}`)),
    });
  }

  const review = open.filter((t) => t.status === "review" && t.reviewSince && diffDays(t.reviewSince, today) > ALERTS.reviewDays);
  if (review.length) {
    out.push({
      id: "review-waiting", level: "warning", count: review.length,
      title: `${n(review.length)} تسک بیش از ${n(ALERTS.reviewDays)} روز منتظر بازبینی`,
      detail: byGroup(review, people),
      items: review.map((t) => taskItem(t, `${n(diffDays(t.reviewSince, today))} روز انتظار · ${name(t.a)}`)),
    });
  }

  // Queue growth: more work arrived than was finished in each of the last full weeks.
  const lastWeekStart = addDays(weekStart(today), -7);
  const weeks = Array.from({ length: ALERTS.growthWeeks }, (_, i) => {
    const from = addDays(lastWeekStart, -7 * (ALERTS.growthWeeks - 1 - i));
    return { from, to: addDays(from, 6) };
  });
  for (const g of groupsIn(facts)) {
    const ids = idsOf(facts.people.filter((p) => p.group === g.name));
    const w = weeks.map((wk) => derive(aggregate(facts, ids, wk.from, wk.to)));
    if (w.every((s) => s.created > s.completed)) {
      const net = w.reduce((s, x) => s + x.created - x.completed, 0);
      out.push({
        id: `growth-${g.key}`, level: "warning", count: net,
        title: `صف کار ${g.fa} ${n(ALERTS.growthWeeks)} هفته پیاپی رشد کرده`,
        detail: `ورودی بیشتر از خروجی؛ مجموعاً ${n(net)} تسک به صف اضافه شده`,
        items: w.map((s, i) => ({ kind: "week", id: weeks[i].from, label: `هفته ${faDate(weeks[i].from, { year: false })}`, sub: `ایجاد ${n(s.created)} · تکمیل ${n(s.completed)}` })),
        link: { path: "/analytics/trends", params: { team: g.key, metric: "created" } },
      });
    }
  }

  // Load concentration: someone holds far more open work than their team's median.
  for (const g of groupsIn(facts)) {
    const team = experts(facts).filter((p) => p.group === g.name && p.active);
    const counts = team.map((p) => ({ p, open: openStats(facts, [p.id]).open }));
    const med = median(counts.map((c) => c.open)) ?? 0;
    const heavy = counts.filter((c) => c.open >= ALERTS.loadMin && c.open >= ALERTS.loadFactor * med).sort((a, b) => b.open - a.open);
    if (heavy.length) {
      out.push({
        id: `load-${g.key}`, level: "warning", count: heavy.length,
        title: `بار کار نامتوازن در ${g.fa}`,
        detail: `میانه تسک باز هر نفر: ${fmtNum(med)}`,
        items: heavy.map((c) => ({ kind: "person", id: c.p.id, label: c.p.name, sub: `${n(c.open)} تسک باز`, href: `/analytics/people/${c.p.id}`, person: c.p.id })),
        link: { path: "/analytics/teams", params: { team: g.key } },
      });
    }
  }

  const rest = overdue.filter((t) => !shown.has(t.id));
  if (rest.length) {
    out.push({
      id: "overdue", level: "warning", count: rest.length,
      title: `${n(rest.length)} تسک معوق دیگر`,
      detail: byGroup(rest, people),
      items: rest.map((t) => taskItem(t, `${n(late(t))} روز تأخیر · ${name(t.a)}`)),
    });
  }

  // Free capacity (task-based roles only; SOC analysts' main work is their shift).
  const idle = experts(facts).filter((p) => p.active && !p.shift && openStats(facts, [p.id]).open === 0);
  if (idle.length) {
    out.push({
      id: "idle", level: "info", count: idle.length,
      title: `${n(idle.length)} کارشناس بدون تسک باز`,
      detail: "ظرفیت آزاد برای تسک جدید",
      items: idle.map((p) => ({ kind: "person", id: p.id, label: p.name, sub: groupFa(p.group), href: `/analytics/people/${p.id}`, person: p.id })),
    });
  }

  if (range && cmp) {
    const shiftIds = idsOf(facts.people.filter((p) => p.shift));
    if (shiftIds.length) {
      const a = stats(facts, shiftIds, range), b = stats(facts, shiftIds, cmp);
      if (a.logs >= ALERTS.iocMinShifts && b.logs >= ALERTS.iocMinShifts && b.iocPerShift > 0 && (b.iocPerShift - a.iocPerShift) / b.iocPerShift >= ALERTS.iocDrop) {
        out.push({
          id: "ioc-drop", level: "info", count: 1,
          title: `IOC به ازای شیفت ${fmtPct((b.iocPerShift - a.iocPerShift) / b.iocPerShift)} کمتر از ${cmp.label}`,
          detail: `${fmtNum(a.iocPerShift)} در برابر ${fmtNum(b.iocPerShift)}`,
          items: [],
          link: { path: "/analytics/soc", params: {} },
        });
      }
    }
  }

  return out.sort((a, b) => LEVELS[a.level].order - LEVELS[b.level].order || b.count - a.count);
}

/** Overall state for the status banner, derived from alerts only. */
export function overallStatus(alerts) {
  const critical = alerts.filter((a) => a.level === "critical");
  const warning = alerts.filter((a) => a.level === "warning");
  if (critical.length) return { level: "critical", fa: "بحرانی", critical: critical.length, warning: warning.length, lead: critical[0] };
  if (warning.length) return { level: "warning", fa: "نیازمند توجه", critical: 0, warning: warning.length, lead: warning[0] };
  return { level: "ok", fa: "عادی", critical: 0, warning: 0, lead: null };
}

