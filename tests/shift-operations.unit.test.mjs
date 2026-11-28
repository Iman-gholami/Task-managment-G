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
const { replaceDayShiftAssignments, previewShiftImportConflicts, importShiftDays, ShiftImportConflictError } = await import("@/lib/server/shift-batch");
const { hashPassword } = await import("@/lib/server/password");
const { isShiftAnalyst, routineStats } = await import("@/lib/server/stats");
const { isShiftEligible, shiftChecklistTeam, canManageShift } = await import("../lib/roles.js");

test("Excel preflight identifies protected dated shifts, preserves recorded work, and allows safe dates", () => {
  const manager = repo.listUsers().find((person) => person.role === "security_manager");
  const worker = repo.createMember({
    name: "Protected Excel Analyst", role: "analyst", team: "SOC · L1",
    email: "protected-excel@shift-import.test", passwordHash: hashPassword("Protected-Excel-Test-2026!"),
  });
  const plusDays = (iso, count) =>
    new Date(Date.parse(iso + "T00:00:00Z") + count * 864e5).toISOString().slice(0, 10);
  const recordedDate = plusDays(repo.today(), 80);
  const safeDate = plusDays(recordedDate, 1);
  const empty = () => ({ morning: [], evening: [], night: [], off: [], leave: [] });
  repo.setShiftSchedule(worker.id, recordedDate, "night", manager.id);
  const log = repo.getShiftLog(worker.id, recordedDate);
  repo.updateActivity(worker.id, log.activities[0].n, { done: true }, log.activities[0].itemId, recordedDate);

  const unchanged = [{ date: recordedDate, assignments: { ...empty(), night: [worker.id] } }];
  assert.deepEqual(previewShiftImportConflicts(unchanged), [], "identical roster keeps a started night shift");
  assert.equal(importShiftDays(unchanged, manager.id).importedDays, 1, "re-importing the same assignment is safe");
  assert.equal(repo.findShiftLog(worker.id, recordedDate).activities[0].done, true);

  const submitted = [
    { date: safeDate, assignments: { ...empty(), morning: [worker.id] }, holidayNote: "Imported holiday" },
    { date: recordedDate, assignments: empty(), holidayNote: "Should not be saved" },
  ];
  const conflicts = previewShiftImportConflicts(submitted);
  assert.deepEqual(conflicts, [{
    date: recordedDate, userId: worker.id, name: worker.name,
    currentType: "night", requestedType: null,
  }]);
  assert.throws(() => importShiftDays(submitted, manager.id), (error) => {
    assert.ok(error instanceof ShiftImportConflictError);
    assert.deepEqual(error.conflicts, conflicts);
    return true;
  });
  assert.equal(repo.getShiftSchedule(worker.id, recordedDate)?.shiftType, "night");
  assert.equal(repo.findShiftLog(worker.id, recordedDate).activities[0].done, true);
  assert.equal(repo.getShiftSchedule(worker.id, safeDate) ?? null, null, "even the preceding safe day rolls back");
  assert.equal(repo.getCenterHoliday(safeDate), null, "holiday metadata rolls back too");

  const changed = [{ date: recordedDate, assignments: { ...empty(), off: [worker.id] } }];
  assert.equal(previewShiftImportConflicts(changed)[0].requestedType, "off");
  const safe = importShiftDays([submitted[0]], manager.id);
  assert.equal(safe.importedDays, 1);
  assert.equal(repo.getShiftSchedule(worker.id, safeDate)?.shiftType, "morning");
  assert.equal(repo.getCenterHoliday(safeDate)?.note, "Imported holiday");
});
test("design engineer can work shifts, days off and leave atomically", async () => {
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
  }, admin.id), /more than one work shift or absence/);
  assert.equal(repo.getShiftSchedule(design.id, date).shiftType, "evening");

  const updated = replaceDayShiftAssignments(date, {
    morning: [], evening: [l1.id], night: [design.id, l2.id],
  }, admin.id);
  assert.equal(updated.length, 3);
  assert.equal(repo.getShiftSchedule(design.id, date).shiftType, "night");
  assert.equal(repo.getShiftSchedule(l1.id, date).shiftType, "evening");
  assert.equal(repo.getShiftLog(design.id, date), null, "Design night duty no longer requires a shift log");

  // An untouched evening draft may be discarded during the shift replacement.
  assert.equal(repo.findShiftLog(design.id, date) ?? null, null);

  // Off-duty and leave are explicit calendar entries, never counted as worked shifts.
  const future = new Date(Date.parse(date + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
  const planned = replaceDayShiftAssignments(future, {
    morning: [], evening: [l1.id], night: [],
    off: [l2.id], leave: [design.id],
  }, admin.id);
  assert.equal(planned.length, 3);
  assert.equal(repo.getDayStatus(l2.id, future), "off");
  assert.equal(repo.getDayStatus(design.id, future), "leave");
  assert.equal(repo.getShiftSchedule(design.id, future) ?? null, null);
  assert.equal(repo.getShiftLog(design.id, future), null);
  const { scheduleStats } = await import("../lib/shifts.js");
  const totals = scheduleStats(planned);
  assert.equal(totals.total, 1, "only worked shifts count as shifts");
  assert.equal(totals.off, 1);
  assert.equal(totals.leave, 1);
  assert.equal(totals.hours, 12.5, "absence contributes no shift hours");

  // A worker can move from an absence to a shift (or between absence kinds).
  const revised = replaceDayShiftAssignments(future, {
    morning: [design.id], evening: [], night: [],
    off: [], leave: [l1.id, l2.id],
  }, admin.id);
  assert.equal(revised.length, 3);
  assert.equal(repo.getDayStatus(design.id, future), null);
  assert.equal(repo.getShiftSchedule(design.id, future).shiftType, "morning");
  assert.equal(repo.getDayStatus(l1.id, future), "leave");
  assert.equal(repo.getDayStatus(l2.id, future), "leave");

  // An engineer's unlogged night duty can be corrected to an absence.
  replaceDayShiftAssignments(date, {
    morning: [], evening: [], night: [], off: [design.id], leave: [],
  }, admin.id);
  assert.equal(repo.getShiftSchedule(design.id, date) ?? null, null);
  assert.equal(repo.getDayStatus(design.id, date), "off");

  const offStats = routineStats(design.id, { from: future, to: future });
  assert.equal(offStats.offDays, 0);
  assert.equal(offStats.leaveDays, 0, "engineer was moved from leave to work");
  assert.equal(routineStats(l2.id, { from: future, to: future }).leaveDays, 1);


  // Center holiday is informational; a scheduled worker still covers the date.
  const { updateCenterHoliday, importShiftDays } = await import("@/lib/server/shift-batch");
  const holidayDate = new Date(Date.parse(future + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
  replaceDayShiftAssignments(holidayDate, {
    morning: [l1.id], evening: [], night: [], off: [l2.id], leave: [],
  }, admin.id);
  updateCenterHoliday(holidayDate, true, "تعطیلی رسمی مرکز", admin.id);
  assert.equal(repo.getShiftSchedule(l1.id, holidayDate).shiftType, "morning");
  assert.equal(repo.getDayStatus(l2.id, holidayDate), "off");
  assert.equal(repo.getCenterHoliday(holidayDate).note, "تعطیلی رسمی مرکز");
  repo.setShiftSchedule(design.id, holidayDate, "night", admin.id);
  assert.equal(repo.getShiftSchedule(design.id, holidayDate).shiftType, "night");
  const later = new Date(Date.parse(holidayDate + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
  const next = new Date(Date.parse(later + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
  const empty = () => ({ morning: [], evening: [], night: [], off: [], leave: [] });
  importShiftDays([
    { date: later, assignments: { ...empty(), morning: [l1.id] }, holidayNote: "تعطیلی مرکز" },
    { date: next, assignments: { ...empty(), evening: [design.id] }, holidayNote: null },
  ], admin.id);
  assert.equal(repo.getCenterHoliday(later).note, "تعطیلی مرکز");
  assert.equal(repo.getShiftSchedule(l1.id, later).shiftType, "morning");
  assert.equal(repo.getShiftSchedule(design.id, next).shiftType, "evening");
  const nextLog = repo.getShiftLog(design.id, next);
  repo.updateActivity(design.id, nextLog.activities[0].n, { done: true }, nextLog.activities[0].itemId, next);
  assert.throws(() => importShiftDays([
    { date: later, assignments: { ...empty(), morning: [design.id] }, holidayNote: null },
    { date: next, assignments: empty(), holidayNote: "تعطیلی دیگر" },
  ], admin.id), /already has activity/);
  assert.equal(repo.getShiftSchedule(l1.id, later).shiftType, "morning", "whole Excel batch rolled back");
  assert.equal(repo.getCenterHoliday(next), null);
  updateCenterHoliday(next, true, "", admin.id);
  assert.equal(repo.getShiftSchedule(design.id, next).shiftType, "evening");
  assert.equal(repo.findShiftLog(design.id, next).activities[0].done, true);

});

test("cross-day Saturday/Sunday swaps succeed without conflicts and never overwrite existing duties", () => {
  const admin = repo.listUsers().find((person) => person.role === "security_manager");
  const createAnalyst = (name) => repo.createMember({
    name, role: "analyst", team: "SOC · L1",
    email: name.toLowerCase().replaceAll(" ", "-") + "@shift-swap.test",
    passwordHash: hashPassword("Swap-Test-Password-2026!"),
  });
  const a = createAnalyst("Saturday Swap Analyst");
  const b = createAnalyst("Sunday Swap Analyst");

  const saturday = new Date(repo.today() + "T00:00:00Z");
  saturday.setUTCDate(saturday.getUTCDate() + ((6 - saturday.getUTCDay() + 7) % 7 || 7));
  const asISO = (date) => date.toISOString().slice(0, 10);
  const plusDays = (date, days) => asISO(new Date(Date.parse(date + "T00:00:00Z") + days * 864e5));
  const sat = asISO(saturday);
  const sun = plusDays(sat, 1);

  repo.setShiftSchedule(a.id, sat, "morning", admin.id);
  repo.setShiftSchedule(b.id, sun, "evening", admin.id);
  const swap = repo.createShiftChangeRequest(a.id, b.id, sat, sun, "Cross-day exchange");
  assert.equal(swap.status, "pending_target");
  repo.actOnShiftChange(swap.id, b, "accept");
  const approved = repo.actOnShiftChange(swap.id, admin, "approve");
  assert.equal(approved.status, "approved");
  assert.equal(repo.getShiftSchedule(a.id, sat) ?? null, null);
  assert.equal(repo.getShiftSchedule(b.id, sun) ?? null, null);
  assert.equal(repo.getShiftSchedule(a.id, sun)?.shiftType, "evening");
  assert.equal(repo.getShiftSchedule(b.id, sat)?.shiftType, "morning");

  // Regression: two "until 8" shifts on adjacent days must be exchangeable,
  // even when both analysts are recorded as off on the other person's shift day.
  const restSat = plusDays(sat, 14);
  const restSun = plusDays(restSat, 1);
  repo.setShiftSchedule(a.id, restSat, "evening", admin.id);
  repo.setDayStatus(a.id, restSun, "off", admin.id);
  repo.setDayStatus(b.id, restSat, "off", admin.id);
  repo.setShiftSchedule(b.id, restSun, "evening", admin.id);
  const restingSwap = repo.createShiftChangeRequest(a.id, b.id, restSat, restSun, "Both until 8");
  repo.actOnShiftChange(restingSwap.id, b, "accept");
  assert.equal(repo.actOnShiftChange(restingSwap.id, admin, "approve").status, "approved");
  assert.equal(repo.getShiftSchedule(a.id, restSun)?.shiftType, "evening");
  assert.equal(repo.getShiftSchedule(b.id, restSat)?.shiftType, "evening");
  assert.equal(repo.getShiftSchedule(a.id, restSat) ?? null, null);
  assert.equal(repo.getShiftSchedule(b.id, restSun) ?? null, null);
  assert.equal(repo.getDayStatus(a.id, restSat), "off", "requester keeps the off-day count");
  assert.equal(repo.getDayStatus(b.id, restSun), "off", "target keeps the off-day count");
  assert.equal(repo.getDayStatus(a.id, restSun), null);
  assert.equal(repo.getDayStatus(b.id, restSat), null);

  // With only one off-day marker, do not invent an absence for the other person.
  const oneSat = plusDays(sat, 21);
  const oneSun = plusDays(oneSat, 1);
  repo.setShiftSchedule(a.id, oneSat, "evening", admin.id);
  repo.setDayStatus(a.id, oneSun, "off", admin.id);
  repo.setShiftSchedule(b.id, oneSun, "evening", admin.id);
  const oneSwap = repo.createShiftChangeRequest(a.id, b.id, oneSat, oneSun);
  repo.actOnShiftChange(oneSwap.id, admin, "approve");
  assert.equal(repo.getShiftSchedule(a.id, oneSun)?.shiftType, "evening");
  assert.equal(repo.getShiftSchedule(b.id, oneSat)?.shiftType, "evening");
  assert.equal(repo.getDayStatus(a.id, oneSat), "off");
  assert.equal(repo.getDayStatus(b.id, oneSun), null);

  const nextSat = plusDays(sat, 7);
  const nextSun = plusDays(sun, 7);
  repo.setShiftSchedule(a.id, nextSat, "morning", admin.id);
  repo.setShiftSchedule(b.id, nextSun, "evening", admin.id);

  repo.setDayStatus(a.id, nextSun, "leave", admin.id);
  assert.throws(
    () => repo.createShiftChangeRequest(a.id, b.id, nextSat, nextSun),
    /requester is marked as leave on/
  );
  assert.equal(repo.getDayStatus(a.id, nextSun), "leave");
  repo.removeDayStatus(a.id, nextSun);

  repo.setShiftSchedule(a.id, nextSun, "night", admin.id);
  assert.throws(
    () => repo.createShiftChangeRequest(a.id, b.id, nextSat, nextSun),
    /requester already has a night shift on/
  );
  repo.removeShiftSchedule(a.id, nextSun);

  repo.setShiftSchedule(b.id, nextSat, "night", admin.id);
  assert.throws(
    () => repo.createShiftChangeRequest(a.id, b.id, nextSat, nextSun),
    /other analyst already has a night shift on/
  );
  repo.removeShiftSchedule(b.id, nextSat);

  // A newly introduced day off after submission must move at approval time too.
  const pending = repo.createShiftChangeRequest(a.id, b.id, nextSat, nextSun);
  repo.setDayStatus(b.id, nextSat, "off", admin.id);
  assert.equal(repo.actOnShiftChange(pending.id, admin, "approve").status, "approved");
  assert.equal(repo.getShiftSchedule(a.id, nextSun)?.shiftType, "evening");
  assert.equal(repo.getShiftSchedule(b.id, nextSat)?.shiftType, "morning");
  assert.equal(repo.getDayStatus(b.id, nextSun), "off");
  assert.equal(repo.getDayStatus(b.id, nextSat), null);

  // But a newly introduced leave must still block approval with no partial move.
  const leaveSat = plusDays(sat, 28);
  const leaveSun = plusDays(leaveSat, 1);
  repo.setShiftSchedule(a.id, leaveSat, "evening", admin.id);
  repo.setShiftSchedule(b.id, leaveSun, "evening", admin.id);
  const blocked = repo.createShiftChangeRequest(a.id, b.id, leaveSat, leaveSun);
  repo.setDayStatus(b.id, leaveSat, "leave", admin.id);
  assert.throws(() => repo.actOnShiftChange(blocked.id, admin, "approve"), /other analyst is marked as leave on/);
  assert.equal(repo.getShiftChangeRequest(blocked.id)?.status, "pending_target");
  assert.equal(repo.getShiftSchedule(a.id, leaveSat)?.shiftType, "evening");
  assert.equal(repo.getShiftSchedule(b.id, leaveSun)?.shiftType, "evening");
  assert.equal(repo.getDayStatus(b.id, leaveSat), "leave");
});

test("evening swaps may explicitly extend a pre-existing morning shift, but never double book", () => {
  const admin = repo.listUsers().find((person) => person.role === "security_manager");
  const analyst = (name) => repo.createMember({
    name, role: "analyst", team: "SOC · L1",
    email: name.toLowerCase().replaceAll(" ", "-") + "@morning-upgrade.test",
    passwordHash: hashPassword("Swap-Test-Password-2026!"),
  });
  const requester = analyst("Extended Shift Requester");
  const target = analyst("Morning Overlap Target");
  const plusDays = (iso, days) =>
    new Date(Date.parse(iso + "T00:00:00Z") + days * 864e5).toISOString().slice(0, 10);
  const date23 = plusDays(repo.today(), 42);
  const date24 = plusDays(date23, 1);

  // Matches the reported 23/24 Aban case: both exchanged shifts are evening,
  // but the target is already assigned the morning of the requester's day.
  repo.setShiftSchedule(requester.id, date23, "evening", admin.id);
  repo.setShiftSchedule(target.id, date23, "morning", admin.id);
  repo.setShiftSchedule(target.id, date24, "evening", admin.id);

  const pending = repo.createShiftChangeRequest(
    requester.id, target.id, date23, date24, "Agreed extended shift"
  );
  assert.throws(
    () => repo.actOnShiftChange(pending.id, admin, "approve"),
    /must accept the extended-shift exchange/
  );
  assert.equal(pending.requesterDestinationUpgrade, false);
  assert.equal(pending.targetDestinationUpgrade, true);
  repo.actOnShiftChange(pending.id, target, "accept");
  const approved = repo.actOnShiftChange(pending.id, admin, "approve");
  assert.equal(approved.status, "approved");
  assert.equal(repo.getShiftSchedule(requester.id, date24)?.shiftType, "evening");
  assert.equal(repo.getShiftSchedule(requester.id, date23) ?? null, null);
  assert.equal(repo.getShiftSchedule(target.id, date23)?.shiftType, "evening");
  assert.equal(repo.getShiftSchedule(target.id, date24) ?? null, null);
  assert.equal(repo.getDayStatus(target.id, date23), null);
  const scheduled = repo.listShiftSchedules(date23, date24);
  assert.equal(scheduled.length, 2, "existing morning is upgraded, never duplicated");

  // Existing Shift Log work remains immutable, including for a proposed upgrade.
  const blockedRequester = analyst("Morning Upgrade Locked A");
  const blockedTarget = analyst("Morning Upgrade Locked B");
  const lockedDate = plusDays(date23, 7);
  const lockedOther = plusDays(lockedDate, 1);
  repo.setShiftSchedule(blockedRequester.id, lockedDate, "evening", admin.id);
  repo.setShiftSchedule(blockedTarget.id, lockedDate, "morning", admin.id);
  repo.setShiftSchedule(blockedTarget.id, lockedOther, "evening", admin.id);
  const waiting = repo.createShiftChangeRequest(blockedRequester.id, blockedTarget.id, lockedDate, lockedOther);
  repo.actOnShiftChange(waiting.id, blockedTarget, "accept");
  const log = repo.getShiftLog(blockedTarget.id, lockedDate);
  const item = log.activities[0];
  repo.updateActivity(blockedTarget.id, item.n, { done: true }, item.itemId, lockedDate);
  assert.throws(() => repo.actOnShiftChange(waiting.id, admin, "approve"), /Shift Log has already started/);
  assert.equal(repo.getShiftChangeRequest(waiting.id)?.status, "pending_manager");
  assert.equal(repo.getShiftSchedule(blockedTarget.id, lockedDate)?.shiftType, "morning");
  assert.equal(repo.getShiftSchedule(blockedTarget.id, lockedOther)?.shiftType, "evening");

  // Opting into an extension never allows a morning -> night overwrite.
  const nightRequester = analyst("Night Upgrade Disallowed A");
  const nightTarget = analyst("Night Upgrade Disallowed B");
  const nightDate = plusDays(date23, 14);
  const nightOther = plusDays(nightDate, 1);
  repo.setShiftSchedule(nightRequester.id, nightDate, "night", admin.id);
  repo.setShiftSchedule(nightTarget.id, nightDate, "morning", admin.id);
  repo.setShiftSchedule(nightTarget.id, nightOther, "night", admin.id);
  assert.throws(
    () => repo.createShiftChangeRequest(nightRequester.id, nightTarget.id, nightDate, nightOther),
    /already has a morning shift/
  );
});
