import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-assignment-notifications-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.ADMIN_EMAIL = "notifications-admin@example.invalid";
process.env.ADMIN_PASSWORD = "Notifications-Test-2026!";
const repo = await import("@/lib/server/repo");
const { hashPassword } = await import("@/lib/server/password");
const admin = repo.listUsers().find((user) => user.role === "security_manager");
const make = (name) => repo.createMember({ name, email: `${name}@example.invalid`, role: "analyst", team: "SOC · L1", passwordHash: hashPassword("Testing-2026!") });

test("assignments are recorded for the recipient, while self-created tasks are silent", () => {
  const person = make("notifications-a");
  const other = make("notifications-b");
  const task = repo.createTask({ title: "Investigate", a: person.id, prio: "normal", cx: 2 }, admin.id);
  repo.createTask({ title: "Personal", a: person.id, prio: "normal", cx: 2 }, person.id);
  assert.deepEqual(repo.listAssignmentNotifications(person.id).map((item) => item.taskId), [task.id]);
  assert.deepEqual(repo.listAssignmentNotifications(other.id), []);

  const stale = repo.commitTaskUpdate(task.id, { a: other.id, team: other.team }, admin.id, { expectedStatus: "done", expectedAssignee: person.id });
  assert.equal(stale, null);
  assert.deepEqual(repo.listAssignmentNotifications(other.id), []);
  assert.ok(repo.commitTaskUpdate(task.id, { a: other.id, team: other.team }, admin.id, { expectedStatus: "todo", expectedAssignee: person.id }));
  assert.deepEqual(repo.listAssignmentNotifications(person.id), []);
  assert.deepEqual(repo.listAssignmentNotifications(other.id).map((item) => item.taskId), [task.id]);

  assert.ok(repo.commitTaskUpdate(task.id, { a: person.id, team: person.team }, person.id, { expectedStatus: "todo", expectedAssignee: other.id }));
  assert.deepEqual(repo.listAssignmentNotifications(person.id), []);
  assert.deepEqual(repo.listAssignmentNotifications(other.id), []);

  const complete = repo.createTask({ title: "Already finished", a: person.id, prio: "normal", cx: 2 }, admin.id);
  repo.updateTask(complete.id, { status: "done" }, admin.id);
  assert.deepEqual(repo.listAssignmentNotifications(person.id), []);
});

test.after(() => { globalThis.__sentinelDb?.close(); fs.rmSync(dir, { recursive: true, force: true }); });
