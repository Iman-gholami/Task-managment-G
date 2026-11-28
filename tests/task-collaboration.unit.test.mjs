import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.ADMIN_EMAIL = "collaboration-admin@local.invalid";
process.env.ADMIN_PASSWORD = "Collaboration-Test-2026!";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-collaboration-"));
process.env.DATABASE_PATH = path.join(directory, "collaboration.db");
test.after(() => { globalThis.__sentinelDb?.close(); fs.rmSync(directory, { recursive: true, force: true }); });

const repo = await import("@/lib/server/repo");
const { db } = await import("@/lib/server/db");
const { hashPassword } = await import("@/lib/server/password");
const { canReviewTask, canAssignTask, canAccessTask } = await import("@/lib/roles");
const { configureCollaboration, changeContribution, validateCollaborationInput } = await import("@/lib/server/task-collaboration");

const admin = repo.listUsers().find((p) => p.role === "security_manager");
const passwordHash = hashPassword("Collaboration-Fixture-2026!");
const add = (name, role, team, email) => repo.createMember({ name, role, team, email, passwordHash });
const lead = add("Design Lead", "engineer", "Design & Automation", "design-lead@example.invalid");
const partner = add("Design Partner", "engineer", "Design & Automation", "design-partner@example.invalid");
const stranger = add("SOC Worker", "analyst", "SOC · L1", "soc-worker@example.invalid");
const designManager = add("Design Manager", "automation_manager", "Design & Automation", "design-manager@example.invalid");
const socManager = add("SOC Manager", "soc_manager", "SOC", "soc-manager@example.invalid");

function taskWith(mode, members = [{ userId: partner.id, responsibility: "Implementation" }]) {
  const task = repo.createTask({ title: `${mode} task`, description: "Shared effort", a: lead.id, prio: "normal", cx: 2, due: repo.today() }, admin.id);
  configureCollaboration(task.id, lead.id, mode, members, designManager.id);
  repo.updateTask(task.id, { status: "progress" }, lead.id);
  return repo.getTask(task.id);
}
const work = (revision, title = "Evidence") => ({ action: "save", revision, workPerformed: title, outcome: "Investigated", hours: 2.5, links: ["https://example.com/report"] });

test("manager scope, collaborator membership and independent reports", () => {
  assert.ok(canAssignTask(designManager, lead));
  assert.ok(!canAssignTask(designManager, stranger));
  assert.ok(!canReviewTask(socManager, { team: "Design & Automation" }));
  assert.ok(canReviewTask(designManager, { team: "Design & Automation" }));
  assert.throws(() => validateCollaborationInput({ a: lead.id }, { mode: "split", leadResponsibility: "Primary", members: [{ userId: stranger.id, responsibility: "External" }] }, repo.getUser, canAssignTask, designManager), { status: 403 });
  assert.throws(() => validateCollaborationInput({ a: lead.id }, { mode: "split", members: [{ userId: partner.id, responsibility: "External" }] }, repo.getUser, canAssignTask, designManager), { status: 400 });
  const task = taskWith("split");
  assert.equal(repo.getTask(task.id).collaborationMode, "split");
  assert.ok(canAccessTask(designManager, task));
  assert.ok(!canAccessTask(socManager, task));
  assert.equal(repo.getTaskDetails(task.id).collaboration.members.length, 2);
  assert.ok(repo.getTask(task.id).participantIds.includes(partner.id));
  const before = repo.getTaskDetails(task.id).collaboration.members.find((m) => m.userId === partner.id);
  changeContribution(task, partner, work(before.revision));
  const after = repo.getTaskDetails(task.id).collaboration.members.find((m) => m.userId === partner.id);
  assert.equal(after.workPerformed, "Evidence");
  assert.equal(after.hours, 2.5);
  assert.deepEqual(after.links, ["https://example.com/report"]);
  assert.throws(() => changeContribution(task, partner, work(before.revision, "stale overwrite")), { status: 409 });
  assert.equal(repo.getTaskDetails(task.id).collaboration.members.find((m) => m.userId === partner.id).workPerformed, "Evidence");
});

test("split mode submits, reviews, returns and completes each member separately", () => {
  const task = taskWith("split");
  changeContribution(task, partner, { ...work(0, "Partner contribution"), action: "submit" });
  assert.equal(repo.getTask(task.id).status, "progress", "One submitted member cannot hand over the whole task");
  changeContribution(task, designManager, { action: "approve", userId: partner.id });
  assert.equal(repo.getTaskDetails(task.id).collaboration.members.find((m) => m.userId === partner.id).state, "approved");
  changeContribution(task, lead, { ...work(0, "Lead contribution"), action: "submit", hours: 3 });
  assert.equal(repo.getTask(task.id).status, "review");
  assert.equal(repo.getTask(task.id).hours, 5.5);
  changeContribution(task, designManager, { action: "return", userId: lead.id, reason: "Provide final evidence" });
  assert.equal(repo.getTask(task.id).status, "returned");
  const returned = repo.getTaskDetails(task.id).collaboration.members.find((m) => m.userId === lead.id);
  assert.equal(returned.returnReason, "Provide final evidence");
  changeContribution(task, lead, { ...work(returned.revision, "Lead revised"), action: "submit", hours: 3 });
  assert.equal(repo.getTask(task.id).status, "review");
  changeContribution(task, designManager, { action: "approve", userId: lead.id });
  assert.ok(repo.getTaskDetails(task.id).collaboration.members.every((m) => m.state === "approved"));
  assert.equal(repo.getTask(task.id).hours, 5.5);
  assert.match(repo.getTaskDetails(task.id).report.workPerformed, /Lead revised/);
  assert.match(repo.getTaskDetails(task.id).report.workPerformed, /Partner contribution/);
  const finished = repo.commitTaskUpdate(task.id, { status: "done", quality: "good" }, designManager.id,
    { expectedStatus: "review", expectedAssignee: lead.id });
  assert.equal(finished.status, "done");
  repo.commitTaskUpdate(task.id, { status: "progress" }, designManager.id,
    { expectedStatus: "done", expectedAssignee: lead.id });
  assert.ok(repo.getTaskDetails(task.id).collaboration.members.every((m) => m.state === "working"));
});

test("free mode accepts every member's draft but only the lead hands over", () => {
  const task = taskWith("free");
  changeContribution(task, partner, work(0, "Partner draft"));
  assert.throws(() => changeContribution(task, partner, { ...work(1), action: "handover" }), { status: 403 });
  changeContribution(task, lead, { ...work(0, "Lead draft"), action: "handover" });
  assert.equal(repo.getTask(task.id).status, "review");
  assert.equal(repo.getTask(task.id).hours, 5);
  assert.match(repo.getTaskDetails(task.id).report.workPerformed, /Partner draft/);
  assert.deepEqual(repo.getTaskDetails(task.id).report.links, ["https://example.com/report"]);
  const returned = repo.commitTaskUpdate(task.id, { status: "returned" }, designManager.id,
    { expectedStatus: "review", expectedAssignee: lead.id, returnReason: "Please add validation" });
  assert.equal(returned.status, "returned");
  assert.equal(repo.getTaskDetails(task.id).collaboration.members.find((m) => m.userId === lead.id).state, "returned");
  changeContribution(returned, lead, { ...work(1, "Lead fixed"), action: "save" });
  assert.equal(repo.getTask(task.id).status, "progress");
});
