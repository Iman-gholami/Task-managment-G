import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shiftLogMode, ENGINEERING_CHECKLIST } from "../lib/shift-log-mode.js";

process.env.ADMIN_EMAIL = "duty-mode-test@local.invalid";
process.env.ADMIN_PASSWORD = "Test-Duty-Mode-2026!";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-shift-duty-"));
process.env.DATABASE_PATH = path.join(dir, "duty.db");
test.after(() => { globalThis.__sentinelDb?.close(); fs.rmSync(dir, { recursive: true, force: true }); });
const repo = await import("@/lib/server/repo");
const { hashPassword } = await import("@/lib/server/password");
const manager = repo.listUsers().find((u) => u.role === "security_manager");
const tomorrow = new Date(Date.parse(repo.today() + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
const newMember = (slug, team, role = "analyst") => repo.createMember({
  name: slug, email: slug + "@duty-mode.test", team, role, passwordHash: hashPassword("Dummy-2026!"),
});
const check = (person, date, shift, mode, expected) => {
  repo.setShiftSchedule(person.id, date, shift, manager.id);
  const log = repo.getShiftLog(person.id, date);
  assert.equal(log.mode, mode, `${person.name} on ${shift}`);
  assert.equal(log.shiftType, shift);
  assert.deepEqual(log.activities.map((a) => a.title), expected, `${person.name} ${shift} items`);
  return log;
};

test("morning work depends on layer; evening and night use common SOC duties", () => {
  const l1 = newMember("layer1", "SOC · L1");
  const l2 = newMember("layer2", "SOC · L2");
  const l3 = newMember("layer3", "SOC · L3");
  const design = newMember("designer", "Design & Automation", "engineer");
  const l1Day = check(l1, repo.today(), "morning", "operational", [
    "Review Logged Incidents in Splunk Incident Review",
    "Review Scanner and Sensor Dashboards",
    "Monitor Website Status in Grafana",
    "Monitor Security Center Website",
    "Monitor Security News",
  ]);
  assert.equal(l1Day.activities.length, 5);
  const l2Day = check(l2, repo.today(), "morning", "ticket_analysis", []);
  assert.equal(l2Day.checklist, null);
  const engTitles = ENGINEERING_CHECKLIST.items.map((x) => x.title);
  const l3Day = check(l3, repo.today(), "morning", "engineering", engTitles);
  assert.equal(l3Day.checklist.name, ENGINEERING_CHECKLIST.name);
  assert.ok(l3Day.activities.every((x) => x.itemId < 0 && !x.legacyN));
  const designDay = check(design, repo.today(), "morning", "engineering", engTitles);
  assert.equal(designDay.team, "SOC · L3");
  const evening = check(l2, tomorrow, "evening", "operational", [
    "Review Logged Incidents in Splunk Incident Review",
    "Upload Malicious IP and Domain Files to the Website",
    "Review Scanner and Sensor Dashboards",
    "Prepare Daily Traffic Report",
    "Monitor Website Status in Grafana",
    "Monitor Security Center Website",
    "Monitor Security News",
    "Add IOCs to MISP and Share Them via Bale",
  ]);
  assert.equal(evening.checklist.name, "Standard SOC routine");
  assert.notEqual(evening.checklist, l2Day.checklist);
  assert.equal(repo.updateActivity(l2.id, 1, { done: true }, evening.activities[0].itemId, tomorrow)[0].done, true);
  assert.throws(() => repo.updateActivity(l2.id, 1, { done: true }, undefined, repo.today()), /ticket analysis only/);
  const l3Cover = check(l3, tomorrow, "evening", "operational", evening.activities.map((x) => x.title));
  const designCover = check(design, tomorrow, "night", "operational", [
    "Review Logged Incidents in Splunk Incident Review",
    "Review Scanner and Sensor Dashboards",
    "Monitor Website Status in Grafana",
    "Monitor Security Center Website",
    "Monitor Security News",
  ]);
  assert.equal(designCover.checklist.name, "Standard SOC routine");
  assert.equal(l3Cover.activities.length, 8);
  assert.equal(repo.getShiftLog(l3.id, repo.today()).mode, "engineering");
  assert.equal(repo.getShiftLog(l3.id, tomorrow).mode, "operational");
  assert.equal(repo.listShiftLogs(l2.id, repo.today(), tomorrow).find((r) => r.date === tomorrow).mode, "operational");
});

test("policy prioritizes duty type, not employee department", () => {
  assert.equal(shiftLogMode({ team: "SOC · L2" }, "morning"), "ticket_analysis");
  assert.equal(shiftLogMode({ team: "SOC · L3" }, "morning"), "engineering");
  assert.equal(shiftLogMode({ team: "Design & Automation" }, "morning"), "engineering");
  for (const team of ["SOC · L1", "SOC · L2", "SOC · L3", "Design & Automation", "Threat Intelligence"])
    for (const shift of ["evening", "night"]) assert.equal(shiftLogMode({ team }, shift), "operational");
});
