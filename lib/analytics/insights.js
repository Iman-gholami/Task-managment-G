// Automatic insights: short statistical sentences about changes and patterns, each with a link
// to the evidence. Rule-based and deterministic (no language model), so every sentence can be
// traced back to the numbers on screen. They describe teams and work, not verdicts on people.
import { addDays, faDate, weekStart } from "./calendar.js";
import { INSIGHTS as T, MIN_BASE_FOR_CHANGE } from "./config.js";
import { change, fmtDays, fmtInt, fmtNum, fmtPct, isNum, median } from "./format.js";
import { ACTIVITIES_FA } from "./labels.js";
import { aggregate, dailySeries, derive, experts, groupsIn, idsOf, openStats, stats } from "./metrics.js";

const n = fmtInt;
const moreLess = (dir) => (dir === "up" ? "افزایش" : "کاهش");

/** The last `count` full Saturday–Friday weeks ending on or before `end`. */
function fullWeeks(end, count) {
  const last = addDays(weekStart(addDays(end, 1)), -7);
  return Array.from({ length: count }, (_, i) => {
    const from = addDays(last, -7 * (count - 1 - i));
    return { from, to: addDays(from, 6) };
  });
}

export function buildInsights(facts, { range, cmp } = {}) {
  const out = [];
  if (!range || range.empty) return out;
  const push = (x) => out.push({ attention: false, tone: "neutral", ...x });
  const cur = stats(facts, null, range);
  const prev = cmp ? stats(facts, null, cmp) : null;
  const groups = groupsIn(facts).map((g) => {
    const ids = idsOf(facts.people.filter((p) => p.group === g.name));
    return { ...g, ids, cur: stats(facts, ids, range), prev: cmp ? stats(facts, ids, cmp) : null };
  });

  if (prev) {
    const c = change(cur.completed, prev.completed);
    if (c?.value !== null && c && Math.abs(c.value) >= T.deptChange) {
      push({ id: "dept-completed", tone: c.dir, score: Math.abs(c.value) * 1.2,
        text: `تسک‌های تکمیل‌شده نسبت به ${cmp.label} ${c.text} ${moreLess(c.dir)} داشته است (${n(cur.completed)} در برابر ${n(prev.completed)}).`,
        link: { path: "/analytics/trends", params: { metric: "completed" } } });
    }
    for (const g of groups) {
      const gc = change(g.cur.completed, g.prev.completed);
      if (gc?.value !== null && gc && g.prev.completed >= MIN_BASE_FOR_CHANGE && Math.abs(gc.value) >= T.teamChange) {
        push({ id: `team-completed-${g.key}`, tone: gc.dir, score: Math.abs(gc.value),
          text: `تسک‌های تکمیل‌شده ${g.fa} نسبت به ${cmp.label} ${gc.text} ${moreLess(gc.dir)} داشته است (${n(g.cur.completed)} در برابر ${n(g.prev.completed)}).`,
          link: { path: "/analytics/teams", params: { team: g.key } } });
      }
      const qa = g.cur.highQualityShare, qb = g.prev.highQualityShare;
      if (gc?.dir === "up" && gc.value >= T.volumeRise && isNum(qa) && isNum(qb) && g.cur.qualityN >= T.qualityMinRated && g.prev.qualityN >= T.qualityMinRated && qb - qa >= T.qualityDropPoints) {
        push({ id: `volume-quality-${g.key}`, tone: "down", attention: true, score: 1 + (qb - qa),
          text: `حجم کار تکمیل‌شده ${g.fa} ${gc.text} بیشتر شده، ولی سهم کیفیت «عالی و خوب» از ${fmtPct(qb)} به ${fmtPct(qa)} رسیده است.`,
          link: { path: "/analytics/teams", params: { team: g.key } } });
      }
    }
  }

  // Three full weeks in a row moving the same way.
  const weeks = fullWeeks(range.end, T.trendWeeks);
  if (weeks[0].from >= facts.window.from) {
    for (const g of groups) {
      const v = weeks.map((w) => derive(aggregate(facts, g.ids, w.from, w.to)).completed);
      const falling = v.every((x, i) => i === 0 || x < v[i - 1]);
      const rising = v.every((x, i) => i === 0 || x > v[i - 1]);
      const first = v[0], last = v[v.length - 1];
      if (falling && first >= MIN_BASE_FOR_CHANGE && (first - last) / first >= T.trendMinChange) {
        push({ id: `trend-down-${g.key}`, tone: "down", attention: true, score: 0.9 + (first - last) / first,
          text: `تسک‌های تکمیل‌شده ${g.fa} ${n(T.trendWeeks)} هفته پیاپی کم شده است (${v.map(n).join("، ")}).`,
          link: { path: "/analytics/trends", params: { team: g.key, g: "week" } } });
      } else if (rising && last >= MIN_BASE_FOR_CHANGE && first > 0 && (last - first) / first >= T.trendMinChange) {
        push({ id: `trend-up-${g.key}`, tone: "up", score: 0.6 + (last - first) / first,
          text: `تسک‌های تکمیل‌شده ${g.fa} ${n(T.trendWeeks)} هفته پیاپی زیاد شده است (${v.map(n).join("، ")}).`,
          link: { path: "/analytics/trends", params: { team: g.key, g: "week" } } });
      }
    }
  }

  // Inflow vs outflow.
  if (Math.abs(cur.net) >= Math.max(T.netBacklogMin, 0.1 * cur.completed)) {
    const grew = cur.net > 0;
    push({ id: "net-backlog", tone: grew ? "up" : "down", attention: grew, score: 0.5 + Math.abs(cur.net) / Math.max(1, cur.completed),
      text: `صف کار در این دوره ${n(Math.abs(cur.net))} تسک ${grew ? "بزرگ‌تر" : "کوچک‌تر"} شد (ایجاد ${n(cur.created)}، تکمیل ${n(cur.completed)}).`,
      link: { path: "/analytics/trends", params: { metric: "created" } } });
  }

  if (prev) {
    if (cur.onTimeN >= T.onTimeMinN && prev.onTimeN >= T.onTimeMinN && isNum(cur.onTimeRate) && isNum(prev.onTimeRate)) {
      const d = cur.onTimeRate - prev.onTimeRate;
      if (Math.abs(d) >= T.onTimePoints) {
        push({ id: "on-time", tone: d > 0 ? "up" : "down", attention: d < 0, score: Math.abs(d) * 3,
          text: `تحویل به‌موقع از ${fmtPct(prev.onTimeRate)} به ${fmtPct(cur.onTimeRate)} رسیده است.`,
          link: { path: "/analytics/trends", params: { metric: "onTimeRate" } } });
      }
    }
    if (cur.cycleN >= T.cycleMinN && prev.cycleN >= T.cycleMinN && prev.cycleMedian > 0) {
      const d = (cur.cycleMedian - prev.cycleMedian) / prev.cycleMedian;
      if (Math.abs(d) >= T.cycleChange) {
        push({ id: "cycle", tone: d > 0 ? "up" : "down", attention: d > 0, score: Math.abs(d),
          text: `میانه زمان انجام تسک‌ها از ${fmtDays(prev.cycleMedian)} به ${fmtDays(cur.cycleMedian)} رسیده است.`,
          link: { path: "/analytics/trends", params: { metric: "cycleMedian" } } });
      }
    }
    if (cur.completed >= T.complexMinN && prev.completed >= T.complexMinN && isNum(cur.complexShare) && isNum(prev.complexShare)) {
      const d = cur.complexShare - prev.complexShare;
      if (Math.abs(d) >= T.complexPoints) {
        push({ id: "complex-mix", tone: d > 0 ? "up" : "down", score: Math.abs(d) * 2,
          text: `سهم کار پیچیده و پیشرفته از ${fmtPct(prev.complexShare)} به ${fmtPct(cur.complexShare)} رسیده است.`,
          link: { path: "/analytics/trends", params: { metric: "complexShare" } } });
      }
    }
    if (cur.completed >= T.hoursMinN && prev.completed >= T.hoursMinN && prev.hoursPerTask > 0) {
      const d = (cur.hoursPerTask - prev.hoursPerTask) / prev.hoursPerTask;
      if (Math.abs(d) >= T.hoursPerTaskChange) {
        push({ id: "hours-per-task", tone: d > 0 ? "up" : "down", score: Math.abs(d) * 0.8,
          text: `میانگین ساعت ثبت‌شده به ازای هر تسک از ${fmtNum(prev.hoursPerTask)} به ${fmtNum(cur.hoursPerTask)} ساعت رسیده است.`,
          link: { path: "/analytics/trends", params: { metric: "hoursPerTask" } } });
      }
    }
  }

  // Open work concentrated on one person.
  for (const g of groups) {
    const team = experts(facts).filter((p) => p.group === g.name && p.active);
    const counts = team.map((p) => ({ p, open: openStats(facts, [p.id]).open }));
    const total = counts.reduce((s, c) => s + c.open, 0);
    const top = counts.sort((a, b) => b.open - a.open)[0];
    if (team.length > 1 && total >= T.concentrationMinOpen && top && top.open / total >= T.concentration) {
      push({ id: `concentration-${g.key}`, tone: "neutral", attention: true, score: 0.8 + top.open / total,
        text: `${fmtPct(top.open / total)} صف باز ${g.fa} با ${top.p.name} است (${n(top.open)} از ${n(total)} تسک).`,
        link: { path: `/analytics/people/${top.p.id}`, params: {} } });
    }
  }

  // SOC routine.
  const shiftIds = idsOf(facts.people.filter((p) => p.shift));
  if (shiftIds.length) {
    const a = stats(facts, shiftIds, range);
    const b = cmp ? stats(facts, shiftIds, cmp) : null;
    if (b && a.actsTotal >= T.routineMinActs && b.actsTotal >= T.routineMinActs) {
      const d = a.routineRate - b.routineRate;
      if (Math.abs(d) >= T.routinePoints) {
        push({ id: "routine", tone: d > 0 ? "up" : "down", attention: d < 0, score: Math.abs(d) * 4,
          text: `انجام روتین شیفت‌ها از ${fmtPct(b.routineRate)} به ${fmtPct(a.routineRate)} رسیده است.`,
          link: { path: "/analytics/soc", params: {} } });
      }
    }
    const low = a.activityRates
      .map((r, i) => ({ r, i, n: a.activityN[i] }))
      .filter((x) => isNum(x.r) && x.n >= T.activityMinN)
      .sort((x, y) => x.r - y.r)[0];
    if (low && low.r < T.activityLow) {
      push({ id: "activity-low", tone: "neutral", attention: true, score: 0.7 + (T.activityLow - low.r),
        text: `فعالیت «${ACTIVITIES_FA[low.i]}» کمترین درصد انجام را دارد (${fmtPct(low.r)} از ${n(low.n)} شیفت).`,
        link: { path: "/analytics/soc", params: {} } });
    }
    const days = dailySeries(facts, shiftIds, range.from, range.end, "tickets");
    const withShift = dailySeries(facts, shiftIds, range.from, range.end, "shifts");
    const counted = days.filter((_, i) => withShift[i][1] > 0).map(([, v]) => v);
    const med = median(counted);
    const peak = days.reduce((best, d) => (d[1] > (best?.[1] ?? -1) ? d : best), null);
    if (med > 0 && peak && peak[1] >= T.ticketSpikeMin && peak[1] >= T.ticketSpike * med) {
      push({ id: "ticket-spike", tone: "up", score: 0.4 + peak[1] / med / 10,
        text: `در ${faDate(peak[0], { year: false })} ${n(peak[1])} تیکت ثبت شد؛ ${fmtNum(peak[1] / med)} برابر میانه روزانه.`,
        link: { path: "/analytics/soc", params: {} } });
    }
  }

  return out.sort((x, y) => Number(y.attention) - Number(x.attention) || y.score - x.score);
}
