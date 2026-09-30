import test from "node:test";
import assert from "node:assert/strict";
import { SHIFT_TYPES, monthBounds, scheduleStats } from "../lib/shifts.js";

test("SOC shift definitions match operational hours", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(SHIFT_TYPES).map(([key, s]) => [key, [s.start, s.end, s.hours]])),
    {
      morning: ["07:30", "15:15", 7.75],
      evening: ["07:30", "20:00", 12.5],
      night: ["20:00", "08:00", 12],
    },
  );
});

test("month bounds handle leap years", () => {
  assert.deepEqual(monthBounds("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
  assert.equal(monthBounds("2028-13"), null);
});

test("monthly schedule statistics count hours, weekdays and shift types", () => {
  const stats = scheduleStats([
    { date: "2026-10-01", shiftType: "morning" }, // Thursday
    { date: "2026-10-02", shiftType: "evening" }, // Friday
    { date: "2026-10-03", shiftType: "night" },
    { date: "2026-10-08", shiftType: "evening" }, // Thursday
  ]);
  assert.equal(stats.total, 4);
  assert.equal(stats.hours, 44.75);
  assert.equal(stats.thursdays, 2);
  assert.equal(stats.fridays, 1);
  assert.equal(stats.morning, 1);
  assert.equal(stats.evening, 2);
  assert.equal(stats.night, 1);
});
