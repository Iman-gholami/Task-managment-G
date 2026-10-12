import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.ADMIN_NAME = "Weighted Score Administrator";
process.env.ADMIN_EMAIL = "weighted-admin@local.invalid";
process.env.ADMIN_PASSWORD = "Weighted-Admin-Only-2026!";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-weighted-score-"));
test.after(() => {
  globalThis.__sentinelDb?.close();
  globalThis.__sentinelDb = undefined;
  fs.rmSync(dir, { recursive: true, force: true });
});

function useDatabase(name) {
  globalThis.__sentinelDb?.close();
  globalThis.__sentinelDb = undefined;
  process.env.DATABASE_PATH = path.join(dir, name);
}

const { db } = await import("@/lib/server/db");
const repo = await import("@/lib/server/repo");
const reviews = await import("@/lib/server/shift-reviews");
const analytics = await import("@/lib/server/analytics");
const { hashPassword } = await import("@/lib/server/password");
const { jalaliMonthBounds, jalaliMonthKey, toJalali } = await import("@/lib/analytics/calendar");

const member = (name, role, team) => repo.createMember({
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@corp.test`,
  role,
  team,
  passwordHash: hashPassword("Unit-Only-Password-1"),
});

test("monthly Shift Log reviews migrate, enforce access and keep an audit trail", () => {
  useDatabase("reviews.db");
  const admin = repo.listUsers().find((u) => u.role === "security_manager");
  const manager = member("SOC Boss", "soc_manager", "SOC");
  const l1 = member("Layer One", "analyst", "SOC · L1");
  const l2 = member("Layer Two", "analyst", "SOC · L2");
  const month = jalaliMonthKey(repo.today());
  const bounds = jalaliMonthBounds(month);

  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shift_log_reviews'").get());
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shift_log_review_events'").get());

  db.prepare("INSERT INTO shift_logs (user_id, date, data, shift_type) VALUES (?, ?, ?, ?)")
    .run(l1.id, bounds.from, JSON.stringify([{ title: "Checklist item", done: true }]), "morning");
  db.prepare("INSERT INTO shift_logs (user_id, date, data, shift_type) VALUES (?, ?, ?, ?)")
    .run(l2.id, bounds.from, JSON.stringify([{ title: "Checklist item", done: false }]), "night");

  const first = reviews.saveShiftReview(manager, { userId: l1.id, month, rating: "good", note: "Solid month" });
  assert.equal(first.rating, "good");
  assert.equal(first.by, manager.id);
  const changed = reviews.saveShiftReview(manager, { userId: l1.id, month, rating: "excellent", note: "Updated after calibration" });
  assert.equal(changed.rating, "excellent");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM shift_log_reviews WHERE user_id = ? AND month = ?").get(l1.id, month).n, 1, "user/month stays unique");
  assert.deepEqual(reviews.reviewEvents(l1.id, month).map((e) => e.action), ["created", "updated"]);

  assert.equal(reviews.saveShiftReview(admin, { userId: l2.id, month, rating: "acceptable" }).rating, "acceptable", "Security Manager can review any shift analyst");
  assert.throws(() => reviews.saveShiftReview(l1, { userId: l2.id, month, rating: "good" }), (e) => e.status === 403);

  const noLog = member("No Checklist", "analyst", "SOC · L3");
  assert.throws(() => reviews.saveShiftReview(manager, { userId: noLog.id, month, rating: "good" }), (e) => e.status === 409);

  const j = toJalali(repo.today());
  const nextYear = j.jm === 12 ? j.jy + 1 : j.jy;
  const nextMonth = j.jm === 12 ? 1 : j.jm + 1;
  const future = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  assert.throws(() => reviews.saveShiftReview(manager, { userId: l1.id, month: future, rating: "good" }), (e) => e.status === 400);

  reviews.deleteShiftReview(manager, { userId: l1.id, month });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM shift_log_reviews WHERE user_id = ? AND month = ?").get(l1.id, month).n, 0);
  assert.deepEqual(reviews.reviewEvents(l1.id, month).map((e) => e.action), ["created", "updated", "deleted"], "delete keeps its event after the review row is gone");
});

test("analytics submission date keeps the first review in a cycle and resets after reopen", () => {
  useDatabase("submitted.db");
  const admin = repo.listUsers().find((u) => u.role === "security_manager");
  const analyst = member("Submit Analyst", "analyst", "SOC · L1");
  const insertTask = db.prepare(`
    INSERT INTO tasks
      (id, title, assignee, team, status, prio, cx, due, hours, quality, created_by, created_at, started_at, completed_at)
    VALUES (?, ?, ?, ?, 'done', 'normal', 2, ?, 1, 'good', ?, ?, ?, ?)
  `);
  const transition = db.prepare("INSERT INTO task_transitions (task_id, from_status, to_status, user_id, at) VALUES (?, ?, ?, ?, ?)");

  insertTask.run("T-9001", "Returned and resubmitted", analyst.id, analyst.team, "2026-10-06", admin.id, "2026-10-01 08:00:00", "2026-10-02 08:00:00", "2026-10-10 08:00:00");
  transition.run("T-9001", null, "todo", admin.id, "2026-10-01 08:00:00");
  transition.run("T-9001", "todo", "progress", analyst.id, "2026-10-02 08:00:00");
  transition.run("T-9001", "progress", "review", analyst.id, "2026-10-05 08:00:00");
  transition.run("T-9001", "review", "returned", admin.id, "2026-10-06 08:00:00");
  transition.run("T-9001", "returned", "progress", analyst.id, "2026-10-07 08:00:00");
  transition.run("T-9001", "progress", "review", analyst.id, "2026-10-08 08:00:00");
  transition.run("T-9001", "review", "done", admin.id, "2026-10-10 08:00:00");

  insertTask.run("T-9002", "Reopened cycle", analyst.id, analyst.team, "2026-10-10", admin.id, "2026-10-01 08:00:00", "2026-10-02 08:00:00", "2026-10-11 08:00:00");
  transition.run("T-9002", null, "todo", admin.id, "2026-10-01 08:00:00");
  transition.run("T-9002", "todo", "progress", analyst.id, "2026-10-02 08:00:00");
  transition.run("T-9002", "progress", "review", analyst.id, "2026-10-03 08:00:00");
  transition.run("T-9002", "review", "done", admin.id, "2026-10-04 08:00:00");
  transition.run("T-9002", "done", "progress", admin.id, "2026-10-07 08:00:00");
  transition.run("T-9002", "progress", "review", analyst.id, "2026-10-09 08:00:00");
  transition.run("T-9002", "review", "done", admin.id, "2026-10-11 08:00:00");

  const facts = analytics.factsFor(admin, { wf: "2026-10-01", wt: "2026-10-12" });
  assert.equal(facts.tasks.find((t) => t.id === "T-9001").submitted, "2026-10-05", "return + resubmit does not replace the first submission");
  assert.equal(facts.tasks.find((t) => t.id === "T-9002").submitted, "2026-10-09", "reopen starts a new approval cycle");
});
