import test from "node:test";
import assert from "node:assert/strict";
import {
  EXTENDED_SHIFT_TASK_TITLES,
  SHIFT_TYPES,
  isIsoDate,
  monthBounds,
  scheduleStats,
} from "../lib/shifts.js";

test("shift definitions match the SOC rota", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(SHIFT_TYPES).map(([key, s]) => [key, [s.start, s.end, s.hours]])),
    {
      morning: ["07:30", "15:15", 7.75],
      evening: ["07:30", "20:00", 12.5],
      night: ["20:00", "08:00", 12],
    }
  );
});

test("extended shift-only task list contains exactly the requested activities", () => {
  assert.deepEqual(new Set(EXTENDED_SHIFT_TASK_TITLES), new Set([
    "Prepare Daily Traffic Report",
    "Add IOCs to MISP and Share Them via Bale",
    "Upload Malicious IP and Domain Files to the Website",
  ]));
});

test("monthly stats count hours, weekdays, and shift types", () => {
  const stats = scheduleStats([
    { date: "2026-10-01", shiftType: "morning" }, // Thu
    { date: "2026-10-02", shiftType: "evening" }, // Fri
    { date: "2026-10-03", shiftType: "night" },
  ]);
  assert.deepEqual(stats, {
    hours: 32.25,
    total: 3,
    thursdays: 1,
    fridays: 1,
    morning: 1,
    evening: 1,
    night: 1,
  });
});

test("month bounds and date validation reject malformed dates", () => {
  assert.deepEqual(monthBounds("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.equal(monthBounds("2026-13"), null);
  assert.equal(isIsoDate("2026-09-30"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
});
