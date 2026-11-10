import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskDate, taskDate, taskWhen } from "../lib/task-date.js";

test("task dates use Solar Hijri while storing ISO Gregorian days", () => {
  assert.equal(taskDate("2026-03-21"), "1405/01/01");
  assert.equal(taskDate("2026-03-21", "fa"), "۱۴۰۵/۰۱/۰۱");
  assert.equal(parseTaskDate("۱۴۰۵/۰۱/۰۱").iso, "2026-03-21");
  assert.equal(parseTaskDate("١٤٠٥/٠١/٠١").iso, "2026-03-21");
  assert.equal(parseTaskDate("1404/12/30").iso, null); // common year: never silently clamp
  assert.equal(parseTaskDate("1405/07/31").iso, null);
  assert.equal(parseTaskDate("1405/01/01", "2026-03-22").iso, null);
  assert.equal(parseTaskDate("").iso, "");
});

test("task timestamps use Tehran's day even across midnight UTC", () => {
  assert.equal(taskWhen("2026-03-20 22:00:00"), "1405/01/01 · 01:30");
});
