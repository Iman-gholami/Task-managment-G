import test from "node:test";
import assert from "node:assert/strict";
import {
  fmtJalali,
  jalaliMonthRange,
  jalaliSeasonRange,
  jalaliYearRange,
  monthKeysBetween,
  periodChoices,
  resolveJalaliPeriod,
} from "../lib/jalali.js";
import { WEIGHTS, levelFor, overallScore, reviewSpeedScore, workloadScore } from "../lib/workforce.js";

test("Jalali months map to the right Gregorian ranges", () => {
  assert.deepEqual(jalaliMonthRange(1405, 1), { from: "2026-03-21", to: "2026-04-20" });
  assert.deepEqual(jalaliMonthRange(1405, 6), { from: "2026-08-23", to: "2026-09-22" });
  assert.deepEqual(jalaliMonthRange(1405, 7), { from: "2026-09-23", to: "2026-10-22" });
  assert.deepEqual(jalaliMonthRange(1405, 11), { from: "2027-01-21", to: "2027-02-19" });
  // Esfand ends the day before the next Nowruz: 29 days in 1404, 30 in the leap year 1403.
  assert.deepEqual(jalaliMonthRange(1404, 12), { from: "2026-02-20", to: "2026-03-20" });
  assert.deepEqual(jalaliMonthRange(1403, 12), { from: "2025-02-19", to: "2025-03-20" });
});

test("seasons and years cover whole months", () => {
  assert.deepEqual(jalaliSeasonRange(1405, 3), { from: "2026-09-23", to: "2026-12-21" });
  assert.deepEqual(jalaliSeasonRange(1404, 4), { from: "2025-12-22", to: "2026-03-20" });
  assert.deepEqual(jalaliYearRange(1405), { from: "2026-03-21", to: "2027-03-20" });
});

test("dates format as Jalali", () => {
  assert.equal(fmtJalali("2026-10-05"), "1405/07/13");
  assert.equal(fmtJalali("2026-10-05 14:30:00"), "1405/07/13");
  assert.equal(fmtJalali("2026-10-05", { fa: true }), "۱۴۰۵/۰۷/۱۳");
  assert.equal(fmtJalali("—"), "");
  assert.equal(fmtJalali(null), "");
});

test("periods resolve from query parameters and fall back to the current month", () => {
  const today = "2026-10-05";
  assert.deepEqual(resolveJalaliPeriod({}, today), { period: "month", key: "1405-07", month: "1405-07", from: "2026-09-23", to: "2026-10-22", label: "مهر ۱۴۰۵" });
  assert.equal(resolveJalaliPeriod({ period: "month", key: "1405-06" }, today).label, "شهریور ۱۴۰۵");
  assert.equal(resolveJalaliPeriod({ period: "season", key: "1405-3" }, today).label, "پاییز ۱۴۰۵");
  assert.equal(resolveJalaliPeriod({ period: "season", key: "1405-3" }, today).month, undefined);
  assert.equal(resolveJalaliPeriod({ period: "year", key: "1405" }, today).from, "2026-03-21");
  assert.deepEqual(
    (({ from, to }) => ({ from, to }))(resolveJalaliPeriod({ period: "custom", from: "2026-09-01", to: "2026-09-30" }, today)),
    { from: "2026-09-01", to: "2026-09-30" }
  );
  for (const bad of [{ period: "month", key: "1405-13" }, { period: "custom", from: "2026-09-30", to: "2026-09-01" }, { period: "year", key: "99999" }, { period: "season", key: "1405-5" }]) {
    assert.equal(resolveJalaliPeriod(bad, today).key, "1405-07", JSON.stringify(bad));
  }
});

test("period choices go back across the year boundary", () => {
  const { months, seasons, years } = periodChoices("2026-04-01"); // 12 Farvardin 1405
  assert.equal(months.length, 12);
  assert.deepEqual(months.slice(0, 3).map((m) => m.key), ["1405-01", "1404-12", "1404-11"]);
  assert.deepEqual(seasons.map((s) => s.key), ["1405-1", "1404-4", "1404-3", "1404-2"]);
  assert.deepEqual(years.map((y) => y.key), ["1405", "1404"]);
});

test("month keys between two dates", () => {
  assert.deepEqual(monthKeysBetween("2026-09-23", "2026-10-22"), ["1405-07"]);
  assert.deepEqual(monthKeysBetween("2026-02-25", "2026-04-02"), ["1404-12", "1405-01"]);
});

test("weights for every role add up to 100", () => {
  for (const [profile, w] of Object.entries(WEIGHTS)) {
    assert.equal(Object.values(w).reduce((s, n) => s + n, 0), 100, profile);
  }
});

test("overall score is a weighted mean of the parts with data", () => {
  const all = { quality: 100, onTime: 100, firstPass: 100, workload: 100, routine: 100, attendance: 100, manager: 100 };
  assert.equal(overallScore("shift", all), 100);
  assert.equal(overallScore("shift", { ...all, routine: 0 }), 80);
  // Missing parts are left out and the rest are re-weighted.
  assert.equal(overallScore("staff", { quality: 80, workload: 60 }), Math.round((80 * 30 + 60 * 25) / 55));
  assert.equal(overallScore("staff", {}), null);
  assert.equal(overallScore("staff", { quality: 150, onTime: -20 }), Math.round((100 * 30) / 50));
});

test("score helpers", () => {
  assert.equal(levelFor(92), "عالی");
  assert.equal(levelFor(70), "خوب");
  assert.equal(levelFor(55), "قابل قبول");
  assert.equal(levelFor(10), "نیاز به بهبود");
  assert.equal(levelFor(null), "");
  assert.equal(workloadScore(10, 10), 80);
  assert.equal(workloadScore(20, 10), 100);
  assert.equal(workloadScore(0, 10), 0);
  assert.equal(workloadScore(5, 0), null);
  assert.equal(reviewSpeedScore(2), 100);
  assert.equal(reviewSpeedScore(72), 50);
  assert.equal(reviewSpeedScore(200), 0);
  assert.equal(reviewSpeedScore(null), null);
});
