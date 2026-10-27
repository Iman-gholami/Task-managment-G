import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.ADMIN_EMAIL = "backfill-unit-admin@local.invalid";
process.env.ADMIN_PASSWORD = "Backfill-Test-Only-2026!";
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-review-backfill-"));
process.env.DATABASE_PATH = path.join(folder, "test.db");
test.after(() => {
  globalThis.__sentinelDb?.close();
  fs.rmSync(folder, { force: true, recursive: true });
});
const repo = await import("@/lib/server/repo");
const { db } = await import("@/lib/server/db");
const { hashPassword } = await import("@/lib/server/password");
const { allowedTransitions } = await import("../lib/workflow.js");
const grants = await import("@/lib/server/shift-backfill");
const daysAgo = (n) => new Date(Date.parse(repo.today() + "T00:00:00Z") - n * 864e5).toISOString().slice(0,10);
const admin = repo.listUsers().find((u) => u.role === "security_manager");
const make = (name, role, team) => repo.createMember({ name, role, team,
  email: name.toLowerCase().replaceAll(" ", "-") + "@review-backfill.test",
  passwordHash: hashPassword("Testing-2026!") });

test("review-exempt self tasks transition directly from progress to done, but analyst tasks do not", () => {
  const boss = make("Task SOC Manager", "soc_manager", "SOC");
  const analyst = make("Task L1 Analyst", "analyst", "SOC · L1");
  const self = repo.createTask({ title: "My planned work", a: boss.id, prio: "normal", cx: 2,
    reviewRequired: false }, boss.id);
  assert.equal(self.reviewRequired, false);
  assert.equal(allowedTransitions(boss, self).includes("review"), false);
  const ongoing = repo.updateTask(self.id, { status: "progress" }, boss.id);
  assert.ok(allowedTransitions(boss, ongoing).includes("done"));
  const completed = repo.updateTask(self.id, { status: "done" }, boss.id);
  assert.equal(completed.status, "done");
  assert.equal(completed.quality, null);
  assert.ok(db.prepare("SELECT completed_at FROM tasks WHERE id = ?").get(self.id).completed_at);
  assert.ok(db.prepare("SELECT 1 FROM task_transitions WHERE task_id = ? AND to_status = 'done'").get(self.id));

  const regular = repo.createTask({ title: "Analyst work", a: analyst.id, prio: "normal", cx: 2 }, boss.id);
  assert.equal(regular.reviewRequired, true);
  const inProgress = repo.updateTask(regular.id, { status: "progress" }, analyst.id);
  assert.ok(allowedTransitions(analyst, inProgress).includes("review"));
  assert.ok(!allowedTransitions(analyst, inProgress).includes("done"));
  assert.ok(!allowedTransitions(boss, inProgress).includes("done"));

  const transferable = repo.createTask({ title: "Self then assigned", a: boss.id,
    prio: "normal", cx: 1, reviewRequired: false }, boss.id);
  const assigned = repo.updateTask(transferable.id, { a: analyst.id, team: analyst.team, reviewRequired: 1 }, boss.id);
  assert.equal(assigned.reviewRequired, true);
  assert.ok(!allowedTransitions(analyst, repo.updateTask(assigned.id, { status: "progress" }, analyst.id)).includes("done"));
});

test("manager approves multiple past shifts atomically, with audit, revocation, and submitted locks", () => {
  const manager = repo.listUsers().find((u) => u.role === "soc_manager");
  const analyst = make("Backfill L2 Analyst", "analyst", "SOC · L2");
  const outsider = make("Backfill Outsider", "analyst", "SOC · L1");
  const dates = [1,2,3,4].map(daysAgo);
  for (const date of dates) repo.setShiftSchedule(analyst.id, date, "morning", admin.id);

  assert.equal(grants.isBackfillAllowed(analyst.id, dates[0]), false);
  assert.throws(() => grants.setBackfillDays(outsider, analyst.id, dates, true), /not authorized/);
  assert.throws(() => grants.setBackfillDays(manager, analyst.id, [dates[0], daysAgo(6)], true),
    /No work shift/);
  assert.equal(grants.isBackfillAllowed(analyst.id, dates[0]), false, "invalid batch did not partially grant");
  assert.deepEqual(grants.setBackfillDays(manager, analyst.id, dates, true, "Forgot to submit"), { dates, enabled: true });
  assert.ok(dates.every((date) => grants.isBackfillAllowed(analyst.id, date)));
  assert.equal(grants.returnedShiftsForAnalyst(analyst).length, 4);
  assert.equal(grants.returnedShiftsForManager(manager).filter((row) => row.userId === analyst.id).length, 4);
  assert.equal(grants.returnedShiftsForManager(admin).filter((row) => row.userId === analyst.id).length, 4);
  assert.throws(() => grants.returnedShiftsForManager(outsider), /Only SOC and Security Managers/);
  assert.equal(grants.backfillDays(analyst.id).filter((row) => row.granted).length, 4);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM shift_log_backfill_events WHERE user_id = ?").get(analyst.id).n, 4);
  assert.throws(() => grants.setBackfillDays(manager, analyst.id, [repo.today()], true), /past shift/);

  const past = repo.getShiftLog(analyst.id, dates[0]);
  assert.equal(past.date, dates[0]);
  assert.equal(past.activities.length, 0, "L2 has no routine checklists");
  repo.setShiftCompleted(analyst.id, true, dates[0]);
  assert.equal(grants.isBackfillAllowed(analyst.id, dates[0]), false);
  assert.equal(grants.returnedShiftsForAnalyst(analyst).length, 3);
  assert.deepEqual(grants.returnedShiftsForManager(manager).filter((row) => row.userId === analyst.id).map((r) => r.date), dates.slice(1));
  assert.throws(() => grants.setBackfillDays(manager, analyst.id, [dates[0]], true), /already submitted/);
  const revoked = grants.setBackfillDays(manager, analyst.id, [dates[1], dates[2]], false, "Requested correction");
  assert.equal(revoked.enabled, false);
  assert.equal(grants.isBackfillAllowed(analyst.id, dates[1]), false);
  assert.equal(grants.isBackfillAllowed(analyst.id, dates[3]), true);
  assert.deepEqual(grants.returnedShiftsForAnalyst(analyst).map((r) => r.date), [dates[3]]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM shift_log_backfill_events WHERE user_id = ?").get(analyst.id).n, 6);
  assert.deepEqual(grants.listEnabledBackfillDates(analyst.id, daysAgo(8), daysAgo(1))
    .map((r) => r.date), [dates[3]]);
});
