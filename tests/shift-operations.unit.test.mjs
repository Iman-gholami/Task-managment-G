// Cross-team SOC roster integration tests using the real SQLite repository.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.ADMIN_NAME = "Shift Test Administrator";
process.env.ADMIN_EMAIL = "shift-test-admin@local.invalid";
process.env.ADMIN_PASSWORD = "Shift-Test-Password-2026!";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-shift-operations-"));
process.env.DATABASE_PATH = path.join(directory, "shift-operations.db");
test.after(() => {
  globalThis.__sentinelDb?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

const repo = await import("@/lib/server/repo");
const { replaceDayShiftAssignments } = await import("@/lib/server/shift-batch");
const { hashPassword } = await import("@/lib/server/password");
const { isShiftAnalyst, routineStats } = await import("@/lib/server/stats");
const { isShiftEligible, shiftChecklistTeam, canManageShift } = await import("../lib/roles.js");

test("design engineer can work a Layer 3 SOC shift and all three shifts save atomically", () => {
  const admin = repo.listUsers().find((user) => user.role === "security_manager");
  assert.ok(admin);
  const member = (name, role, team) => repo.createMember({
    name, role, team, email: name.toLowerCase().replaceAll(" ", "-") + "@example.test",
    passwordHash: hashPassword("Test-Pass-1234"),
  });
  const design = member("Parsa Designer", "engineer", "Design & Automation");
  const l1 = member("Laleh One", "analyst", "SOC · L1");
  const l2 = member("Nima Two", "analyst", "SOC · L2");
  const other = member("Tina Intel", "engineer", "Threat Intelligence");
  assert.equal(isShiftEligible(design), true);
  assert.equal(isShiftAnalyst(design), true);
  assert.equal(shiftChecklistTeam(design), "SOC · L3");
  assert.equal(canManageShift(admin, design), true);
  assert.equal(isShiftEligible(other), false);

  const date = repo.today();
  const initial = replaceDayShiftAssignments(date, {
    morning: [l1.id], evening: [design.id], night: [l2.id],
  }, admin.id);
  assert.equal(initial.length, 3);
  assert.deepEqual(new Set(initial.map((row) => row.userId)), new Set([design.id, l1.id, l2.id]));
  const log = repo.getShiftLog(design.id, date);
  assert.equal(log.team, "SOC · L3");
  assert.equal(log.shiftType, "evening");
  assert.equal(log.checklist.name, "Standard SOC routine");
  assert.equal(log.activities.length, 8, "Until 8 receives all extended SOC activities");
  assert.equal(routineStats(design.id, { from: date, to: date }).logs, 1);

  assert.throws(() => replaceDayShiftAssignments(date, {
    morning: [design.id], evening: [design.id], night: [],
  }, admin.id), /multiple shifts/);
  assert.equal(repo.getShiftSchedule(design.id, date).shiftType, "evening");

  const updated = replaceDayShiftAssignments(date, {
    morning: [], evening: [l1.id], night: [design.id, l2.id],
  }, admin.id);
  assert.equal(updated.length, 3);
  assert.equal(repo.getShiftSchedule(design.id, date).shiftType, "night");
  assert.equal(repo.getShiftSchedule(l1.id, date).shiftType, "evening");
  assert.equal(repo.getShiftLog(design.id, date).shiftType, "night");

  const first = repo.getShiftLog(design.id, date).activities[0];
  repo.updateActivity(design.id, first.n, { done: true }, first.itemId);
  assert.throws(() => replaceDayShiftAssignments(date, {
    morning: [l1.id, design.id], evening: [], night: [],
  }, admin.id), /already has activity/);
  assert.equal(repo.getShiftSchedule(design.id, date).shiftType, "night", "transaction rolled back");
  assert.equal(repo.getShiftSchedule(l1.id, date).shiftType, "evening", "other assignment not partially saved");
  assert.equal(repo.getShiftSchedule(l2.id, date).shiftType, "night", "deletion not partially applied");
  assert.equal(repo.getShiftLog(design.id, date).activities[0].done, true, "recorded log retained");
});
