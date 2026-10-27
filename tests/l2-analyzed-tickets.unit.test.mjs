import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.ADMIN_EMAIL = "l2-analyzed-admin@local.invalid";
process.env.ADMIN_PASSWORD = "Unit-L2-Admin-2026!";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-l2-tickets-"));
process.env.DATABASE_PATH = path.join(dir, "l2.db");
test.after(() => { globalThis.__sentinelDb?.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const repo = await import("@/lib/server/repo");
const svc = await import("@/lib/server/l2-analyzed-tickets");
const { hashPassword } = await import("@/lib/server/password");
const { routineStats } = await import("@/lib/server/stats");
const { buildReport } = await import("@/lib/server/reports");

test("L2 ticket analyses: counted by verdict, isolated by shift, editable and protected", () => {
  const manager = repo.listUsers().find((u) => u.role === "security_manager");
  const l2 = repo.createMember({ name: "L2 ticket analyst", role: "analyst", team: "SOC · L2",
    email: "l2@analyzed.test", passwordHash: hashPassword("L2-test-pass") });
  const l1 = repo.createMember({ name: "L1 ticket analyst", role: "analyst", team: "SOC · L1",
    email: "l1@analyzed.test", passwordHash: hashPassword("L1-test-pass") });
  const date = repo.today();
  repo.setShiftSchedule(l2.id, date, "morning", manager.id);
  repo.setShiftSchedule(l1.id, date, "morning", manager.id);
  assert.deepEqual(repo.getShiftLog(l2.id).analyzedTickets, []);
  assert.equal(repo.getShiftLog(l1.id).analyzedTickets.length, 0);
  assert.throws(() => svc.saveAnalyzedTicket(l1.id, date, { ticketNumber: "INC-2", verdict: "false_positive" }), /Only SOC Layer 2/);
  assert.throws(() => svc.saveAnalyzedTicket(l2.id, date, { ticketNumber: "INC-1", verdict: "pending" }), /Choose False Positive/);
  assert.throws(() => svc.saveAnalyzedTicket(l2.id, date, { ticketNumber: "", verdict: "false_positive" }), /Ticket number/);

  svc.saveAnalyzedTicket(l2.id, date, { ticketNumber: " INC-1 ", verdict: "false_positive" });
  svc.saveAnalyzedTicket(l2.id, date, { ticketNumber: "INC-2", verdict: "true_positive" });
  assert.throws(() => svc.saveAnalyzedTicket(l2.id, date, { ticketNumber: "inc-1", verdict: "true_positive" }), /already registered/);
  const initial = svc.listAnalyzedTickets(l2.id, date);
  assert.deepEqual(initial.map((x) => x.ticketNumber).sort(), ["INC-1", "INC-2"]);
  assert.deepEqual(svc.analyzedTicketSummary(l2.id, date), { total: 2, falsePositive: 1, truePositive: 1 });
  assert.equal(repo.getShiftLog(l2.id).analyzedTickets.length, 2);
  assert.throws(() => repo.removeShiftSchedule(l2.id, date), /already has activity/);
  assert.throws(() => svc.saveAnalyzedTicket(l2.id, date, { id: 123456, ticketNumber: "INC-3", verdict: "true_positive" }), /not found/);
  assert.throws(() => svc.removeAnalyzedTicket(l2.id, date, 123456), /not found/);
  assert.throws(() => svc.saveAnalyzedTicket(l2.id, date, { id: initial[0].id, ticketNumber: "INC-1", verdict: "false_positive" }), /already registered/);

  const second = initial.find((x) => x.ticketNumber === "INC-2");
  svc.saveAnalyzedTicket(l2.id, date, { id: second.id, ticketNumber: "INC-2", verdict: "false_positive" });
  assert.deepEqual(svc.analyzedTicketSummary(l2.id, date), { total: 2, falsePositive: 2, truePositive: 0 });
  assert.equal(routineStats(l2.id, { from: date, to: date }).analyzedTickets, 2);
  const report = buildReport("shift", { period: { from: date, to: date } });
  const shiftSheet = report.sheets.find((s) => s.name === "Shift Activity");
  assert.equal(shiftSheet.rows.find((r) => r.name === l2.name).analyzedFalsePositive, 2);
  const details = report.sheets.find((s) => s.name === "L2 Ticket Analysis");
  assert.deepEqual(details.rows.map((x) => x.ticketNumber).sort(), ["INC-1", "INC-2"]);
  assert.deepEqual(details.rows.map((x) => x.verdict), ["False Positive", "False Positive"]);
  const monthly = buildReport("employee", { userId: l2.id, period: { from: date, to: date } });
  assert.ok(monthly.sheets.some((s) => s.name === "L2 Ticket Analysis"));
  assert.equal(repo.listShiftLogs(l2.id, date, date)[0].analyzedTickets, 2);

  // After shift submission only an authorized manager may correct existing analyses.
  repo.setShiftCompleted(l2.id, true);
  assert.throws(() => svc.saveAnalyzedTicket(l2.id, date, { ticketNumber: "INC-3", verdict: "true_positive" }), /locked/);
  assert.throws(() => svc.removeAnalyzedTicket(l2.id, date, second.id), /locked/);
  svc.saveAnalyzedTicket(l2.id, date, { id: second.id, ticketNumber: "INC-2", verdict: "true_positive" },
    { manager: true, actorId: manager.id });
  assert.equal(svc.listAnalyzedTickets(l2.id, date).find((x) => x.id === second.id).correctedBy, manager.id);
  assert.deepEqual(svc.analyzedTicketSummary(l2.id, date), { total: 2, falsePositive: 1, truePositive: 1 });
  const first = initial.find((x) => x.ticketNumber === "INC-1");
  svc.removeAnalyzedTicket(l2.id, date, first.id, { manager: true, actorId: manager.id });
  assert.deepEqual(svc.analyzedTicketSummary(l2.id, date), { total: 1, falsePositive: 0, truePositive: 1 });
});
