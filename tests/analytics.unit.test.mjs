import test from "node:test";
import assert from "node:assert/strict";
import { addDays, dayNum, faDate, fromJalali, isoOfDay, jalaliMonthLength, toJalali, weekdayIndex } from "../lib/analytics/calendar.js";
import { autoGranularity, buckets, comparisonRange, resolveRange } from "../lib/analytics/periods.js";
import { applyFilters, filterQuery, parseFilters } from "../lib/analytics/filters.js";
import { change, fmtPct } from "../lib/analytics/format.js";
import { backlogSeries, openStats, peopleRows, stats, teamRows } from "../lib/analytics/metrics.js";
import { buildAlerts, overallStatus } from "../lib/analytics/alerts.js";
import { buildInsights } from "../lib/analytics/insights.js";
import { mockFacts } from "../lib/analytics/mock.js";
import { buildActivityLeaderboard, cohortFor } from "../lib/analytics/performance.js";

test("Jalali conversion matches Intl's persian calendar for every day of 2015–2035", () => {
  const fmt = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });
  for (let d = dayNum("2015-01-01"); d <= dayNum("2035-12-31"); d++) {
    const iso = isoOfDay(d);
    const p = Object.fromEntries(fmt.formatToParts(new Date(d * 864e5)).map((x) => [x.type, x.value]));
    const j = toJalali(iso);
    assert.deepEqual([j.jy, j.jm, j.jd], [parseInt(p.year, 10), Number(p.month), Number(p.day)], iso);
    assert.equal(fromJalali(j.jy, j.jm, j.jd), iso);
  }
});

test("Jalali helpers: month lengths, labels, week starts on Saturday", () => {
  assert.equal(jalaliMonthLength(1403, 12), 30); // 1403 is a leap year
  assert.equal(jalaliMonthLength(1404, 12), 29);
  assert.equal(fromJalali(1404, 12, 30), fromJalali(1404, 12, 29)); // clamped
  assert.equal(faDate("2026-10-06"), "۱۴ مهر ۱۴۰۵");
  assert.equal(weekdayIndex("2026-10-03"), 0); // Saturday
  assert.equal(weekdayIndex("2026-10-09"), 6); // Friday
});

test("current month is measured to today and compared like for like", () => {
  const r = resolveRange({ p: "month" }, "2026-10-06");
  assert.deepEqual([r.from, r.to, r.end, r.days, r.partial, r.label], ["2026-09-23", "2026-10-22", "2026-10-06", 14, true, "مهر ۱۴۰۵"]);
  const c = comparisonRange(r, "prev");
  assert.deepEqual([c.from, c.to, c.days], ["2026-08-23", "2026-09-05", 14]);
  assert.equal(c.label, "۱۴ روز اول شهریور ۱۴۰۵");
  const yoy = comparisonRange(r, "yoy");
  assert.deepEqual([yoy.from, yoy.to], [fromJalali(1404, 7, 1), fromJalali(1404, 7, 14)]);
  assert.equal(comparisonRange(r, "none"), null);
});

test("full previous month compares with the whole month before it; a 31-day month vs a 30-day one is capped", () => {
  const r = resolveRange({ p: "prev-month" }, "2026-10-06"); // Shahrivar (31 days)
  assert.equal(r.days, 31);
  const c = comparisonRange(r, "prev"); // Mordad (31 days)
  assert.equal(c.days, 31);
  const mehr = resolveRange({ p: "prev-month" }, fromJalali(1405, 8, 10)); // Mehr, 30 days
  const vsShahrivar = comparisonRange(mehr, "prev");
  assert.equal(vsShahrivar.days, 30);
});

test("rolling and custom ranges compare with the same number of days before them", () => {
  const r = resolveRange({ p: "last-30" }, "2026-10-06");
  assert.deepEqual([r.from, r.end, r.days], [addDays("2026-10-06", -29), "2026-10-06", 30]);
  const c = comparisonRange(r, "prev");
  assert.deepEqual([c.to, c.days], [addDays(r.from, -1), 30]);
  const bad = resolveRange({ p: "custom", from: "2026-10-10", to: "2026-10-01" }, "2026-10-06");
  assert.equal(bad.preset, "month");
  assert.equal(bad.unit, "month");
});

test("buckets follow the Jalali calendar and flag partial edges", () => {
  assert.equal(autoGranularity(14), "day");
  assert.equal(autoGranularity(90), "week");
  assert.equal(autoGranularity(365), "month");
  const weeks = buckets("2026-09-23", "2026-10-06", "week");
  assert.equal(weeks[0].from, "2026-09-23");
  assert.equal(weeks[0].partial, true); // starts on a Wednesday
  assert.equal(weeks[1].from, "2026-09-26"); // Saturday
  const months = buckets(fromJalali(1405, 1, 1), fromJalali(1405, 12, 29), "month");
  assert.equal(months.length, 12);
  assert.ok(months.every((m) => !m.partial));
  assert.equal(buckets(fromJalali(1405, 1, 1), fromJalali(1405, 12, 29), "season").length, 4);
});

test("filters parse from the URL, drop invalid values and round-trip", () => {
  const f = parseFilters(new URLSearchParams("p=custom&from=2026-09-01&to=2026-09-30&team=da&level=L2&prio=high&cx=9&demo=1"));
  assert.equal(f.level, ""); // levels only exist in SOC
  assert.equal(f.cx, "");
  assert.equal(f.prio, "high");
  assert.equal(filterQuery(f), "p=custom&from=2026-09-01&to=2026-09-30&team=da&prio=high&demo=1");
  assert.equal(parseFilters({ p: "month", from: "2026-01-01" }).from, "");
});

test("changes: rates in points, small bases stated as absolute differences", () => {
  assert.equal(change(0.8, 0.7, "rate").text, "۱۰ واحد درصد");
  assert.equal(change(12, 10).text, "۲۰٪");
  assert.equal(change(3, 1).absolute, true);
  assert.equal(change(null, 1), null);
  assert.equal(fmtPct(0.853), "۸۵٪");
});

/** A tiny hand-made organisation, so the arithmetic can be checked by hand. */
function fixture() {
  const today = "2026-10-06";
  const P = (id, team, extra = {}) => ({ id, name: id, role: "analyst", team, group: team.startsWith("SOC") ? "SOC" : team, level: /L\d$/.exec(team)?.[0] ?? null, active: true, color: "#000", shift: team.startsWith("SOC ·"), manager: false, ...extra });
  const T = (id, a, o) => ({ id, title: id, a, status: "done", prio: "normal", cx: 2, due: null, hours: 2, quality: "good", created: "2026-09-25", started: "2026-09-26", completed: "2026-09-28", cycle: 2, returns: [], blockedSince: null, reviewSince: null, closed: "2026-09-28", ...o });
  return {
    today, window: { from: "2026-01-01", to: today }, demo: false,
    people: [P("a", "SOC · L1"), P("b", "SOC · L2"), P("m", "SOC", { role: "soc_manager", manager: true }), P("e", "Design & Automation", { role: "engineer" })],
    tasks: [
      T("t1", "a", { cx: 1, hours: 1, due: "2026-09-30" }),
      T("t2", "a", { cx: 3, hours: 5, due: "2026-09-27", quality: "excellent", returns: ["2026-09-27"] }),
      T("t3", "e", { cx: 4, hours: 10, created: "2026-09-01", started: "2026-09-02", completed: "2026-09-10", closed: "2026-09-10" }),
      T("t4", "m", { cx: 2, hours: 3 }),
      T("t5", "e", { status: "progress", completed: null, closed: null, quality: null, due: "2026-09-20", prio: "high" }),
      T("t6", "e", { status: "blocked", completed: null, closed: null, quality: null, blockedSince: "2026-09-29" }),
    ],
    shifts: [
      { a: "a", date: "2026-10-04", type: "evening", log: true, closed: true, done: 7, total: 8, acts: [1, 1, 1, 1, 1, 1, 0, 1], iocs: 6, report: true, issues: 1 },
      { a: "a", date: "2026-10-05", type: "morning", log: true, closed: false, done: 3, total: 5, acts: [1, null, 1, null, 0, 1, 0, null], iocs: 0, report: false, issues: 0 },
      { a: "b", date: "2026-10-06", type: "night", log: false, closed: false, done: 0, total: 0, acts: Array(8).fill(null), iocs: 0, report: false, issues: 0 },
    ],
    tickets: [{ a: "a", date: "2026-10-04", n: 3 }, { a: "a", date: "2026-10-05", n: 1 }],
  };
}

test("statistics: completed, weighted units, hours, on-time, SOC closure and routine", () => {
  const f = fixture();
  const range = resolveRange({ p: "month" }, f.today); // 2026-09-23 … 2026-10-06
  const s = stats(f, null, range);
  assert.equal(s.completed, 3); // t1, t2, t4 (t3 is in Shahrivar)
  assert.equal(s.units, 1 + 3 + 2);
  assert.equal(s.hours, 1 + 5 + 3);
  assert.equal(s.onTimeN, 2);
  assert.equal(s.onTimeRate, null); // below the minimum sample
  assert.equal(s.onTime, 1); // t1 on time; t2 a day late
  assert.equal(s.returns, 1);
  assert.equal(s.shifts, 3);
  assert.equal(s.past, 2); // today's night shift hasn't happened yet
  assert.equal(s.closureRate, 0.5);
  assert.equal(s.missed, 1);
  assert.equal(s.routineRate, 10 / 13);
  assert.deepEqual(s.activityRates.slice(0, 2), [1, 1]);
  assert.equal(s.tickets, 4);
  assert.equal(s.iocPerShift, 3);
});

test("teams count managers' work in totals but not in headcount; people rows exclude managers", () => {
  const f = fixture();
  const range = resolveRange({ p: "month" }, f.today);
  const [soc, da] = teamRows(f, range, null);
  assert.equal(soc.cur.completed, 3);
  assert.equal(soc.headcount, 2);
  assert.equal(soc.pc.completed, 1.5);
  assert.equal(da.cur.completed, 0);
  assert.deepEqual(peopleRows(f, range, null).map((r) => r.person.id), ["a", "b", "e"]);
  const open = openStats(f, null);
  assert.deepEqual([open.open, open.overdue, open.overdueHigh, open.blocked], [2, 1, 1, 1]);
});

test("filters narrow people, tasks and SOC data independently", () => {
  const f = fixture();
  const range = resolveRange({ p: "month" }, f.today);
  const soc = applyFilters(f, parseFilters({ team: "soc" }));
  assert.equal(stats(soc, null, range).completed, 3);
  const evening = applyFilters(f, parseFilters({ shift: "evening" }));
  const s = stats(evening, null, range);
  assert.equal(s.shifts, 1);
  assert.equal(s.tickets, 3); // only the ticket logged on the evening shift
  assert.equal(stats(evening, null, range).completed, 3); // task data untouched
});

test("backlog over time is rebuilt from creation and closing dates", () => {
  const f = fixture();
  const b = buckets("2026-09-24", "2026-09-30", "day");
  // Five tasks arrive on 09-25; three close on 09-28; t3 closed before the window.
  assert.deepEqual(backlogSeries(f, null, b), [0, 5, 5, 5, 2, 2, 2]);
});

test("alerts flag overdue high-priority work and missed shift logs; status follows the worst alert", () => {
  const f = fixture();
  const alerts = buildAlerts(f, {});
  const ids = alerts.map((a) => a.id);
  assert.ok(ids.includes("overdue-high"));
  assert.ok(ids.includes("missed-logs"));
  assert.equal(overallStatus(alerts).level, "critical");
  assert.equal(overallStatus([]).level, "ok");
});

test("demo data is deterministic and produces alerts and insights", () => {
  const today = "2026-10-06";
  const window = { from: addDays(today, -371), to: today };
  const a = mockFacts({ today, window });
  const b = mockFacts({ today, window });
  assert.equal(JSON.stringify(a.tasks), JSON.stringify(b.tasks));
  assert.ok(a.people.every((p) => p.id.startsWith("d-")));
  const soc = mockFacts({ today, window, scope: "soc" });
  assert.ok(soc.people.every((p) => p.group === "SOC"));
  const range = resolveRange({ p: "month" }, today);
  const cmp = comparisonRange(range, "prev");
  assert.ok(buildAlerts(a, { range, cmp }).length > 0);
  assert.ok(buildInsights(a, { range, cmp }).length > 0);
});


test("peer activity ranking is isolated by cohort and ranks visible output", () => {
  const person = (id, level) => ({ id, name: id, role: "analyst", group: "SOC", level, shift: true, manager: false });
  assert.equal(cohortFor(person("l1-a", "L1")).key, "SOC|L1");
  assert.equal(cohortFor(person("l2-a", "L2")).key, "SOC|L2");

  const rows = [
    { person: person("l1-a", "L1"), cur: { units: 20, completed: 8, actsDone: 40, closureRate: 1 } },
    { person: person("l1-b", "L1"), cur: { units: 14, completed: 9, actsDone: 30, closureRate: 0.9 } },
    { person: person("l1-c", "L1"), cur: { units: 8, completed: 4, actsDone: 20, closureRate: 0.8 } },
  ];

  const ranked = buildActivityLeaderboard(rows);
  assert.deepEqual(ranked.map((r) => r.person.id), ["l1-a", "l1-b", "l1-c"]);
  assert.equal(ranked[0].rank, 1);
  assert.ok(ranked[0].score <= 100 && ranked[0].score > ranked[1].score);
  assert.equal(ranked.find((r) => r.person.id === "l1-b").ranks.completed, 1);
  assert.equal(ranked.find((r) => r.person.id === "l1-a").ranks.units, 1);
  assert.equal(ranked.find((r) => r.person.id === "l1-a").ranks.actsDone, 1);
});
