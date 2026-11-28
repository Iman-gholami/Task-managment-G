import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.ADMIN_EMAIL = "subtask-admin@local.invalid";
process.env.ADMIN_PASSWORD = "Subtask-Unit-Admin-2026!";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-subtasks-"));
process.env.DATABASE_PATH = path.join(directory, "subtasks.db");
test.after(() => { globalThis.__sentinelDb?.close(); fs.rmSync(directory, { recursive: true, force: true }); });

const repo = await import("@/lib/server/repo");
const { db } = await import("@/lib/server/db");
const { hashPassword } = await import("@/lib/server/password");

const admin = repo.listUsers().find((user) => user.role === "security_manager");
const member = repo.createMember({
  name: "Subtask Operator", email: "subtask-unit@example.invalid", role: "engineer",
  team: "Design & Automation", passwordHash: hashPassword("Subtask-Operator-2026!"),
});

test("subtasks are ordinary individually reportable tasks, not checklist items", () => {
  const parent = repo.createTask({ title: "Deploy SOC workflow", a: member.id, prio: "normal", cx: 2, due: "—" }, admin.id);
  const child = repo.createSubtask(parent.id, { title: "Connect Splunk", description: "Configure webhook", a: member.id, prio: "high", cx: 3, due: "2026-12-20" }, admin.id);
  assert.equal(child.parentTaskId, parent.id);
  assert.equal(child.originParentTaskId, parent.id);
  assert.equal(child.status, "todo");
  assert.equal(child.prio, "high");
  assert.equal(repo.listRelatedSubtasks(parent.id).length, 1);
  assert.ok(repo.getTaskDetails(child.id).events.some((event) => event.text.includes("created as a subtask")));
  assert.ok(repo.listAssignmentNotifications(member.id).some((notice) => notice.taskId === child.id));

  assert.throws(() => repo.createSubtask(child.id, { title: "Grandchild", a: member.id, prio: "normal", cx: 2 }, admin.id), { status: 409 });
  repo.updateTask(child.id, { status: "progress" }, member.id);
  const result = repo.commitTaskUpdate(child.id, { hours: 2.5 }, member.id, {
    expectedStatus: "progress", expectedAssignee: member.id, expectedRevision: 0,
    report: { workPerformed: "Webhook configured", outcome: "Connected", hoursRecorded: true, links: ["https://example.com/evidence"] },
  });
  assert.equal(result.hours, 2.5);
  assert.equal(repo.getTask(parent.id).hours, 0, "child time must never be silently added to the parent");

  const promoted = repo.promoteSubtask(parent.id, child.id, admin.id);
  assert.equal(promoted.id, child.id);
  assert.equal(promoted.parentTaskId, null);
  assert.equal(promoted.originParentTaskId, parent.id);
  assert.ok(promoted.promotedAt);
  assert.equal(promoted.status, "progress");
  assert.equal(promoted.hours, 2.5);
  assert.deepEqual(repo.getTaskReport(child.id), { workPerformed: "Webhook configured", outcome: "Connected", links: ["https://example.com/evidence"], hoursRecorded: true, revision: 1 });
  assert.equal(repo.getTaskDetails(child.id).events.filter((event) => event.text.includes("promoted")).length, 1);
  assert.ok(repo.getTaskDetails(parent.id).events.some((event) => event.text.includes(`promoted subtask ${child.id}`)));
  assert.equal(repo.listRelatedSubtasks(parent.id)[0].id, child.id);
  assert.throws(() => repo.promoteSubtask(parent.id, child.id, admin.id), { status: 409 });
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
});

test("subtasks can be created only for open root tasks", () => {
  const done = repo.createTask({ title: "Completed parent", a: member.id, prio: "normal", cx: 2 }, admin.id);
  repo.updateTask(done.id, { status: "done" }, admin.id);
  assert.throws(() => repo.createSubtask(done.id, { title: "Too late", a: member.id, prio: "normal", cx: 2 }, admin.id), { status: 409 });
  assert.equal(repo.listRelatedSubtasks(done.id).length, 0);
});
