import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-dashboard-perf-"));
process.env.DATABASE_PATH = path.join(directory, "dashboard.db");
process.env.ADMIN_EMAIL = "dashboard-perf@local.invalid";
process.env.ADMIN_PASSWORD = "Dashboard-Only-2026!";
test.after(() => { globalThis.__sentinelDb?.close(); fs.rmSync(directory, { recursive:true, force:true }); });
const repo = await import("@/lib/server/repo");
const { db } = await import("@/lib/server/db");
const { hashPassword } = await import("@/lib/server/password");
const { addDays } = await import("@/lib/analytics/calendar");
const { dashboardStats, resolvePeriod, teamStats } = await import("@/lib/server/stats");
const admin = repo.listUsers().find((u) => u.role === "security_manager");
const passwordHash = hashPassword("Dashboard-Fixture-2026!");
const people = Array.from({ length:10 }, (_,i) => repo.createMember({ name:`Staff ${i}`, email:`staff${i}@perf.invalid`, role:i===1 ? "engineer" : "analyst", team:i===1 ? "Design & Automation" : "SOC · L1", passwordHash }));
const [one,two,inactive] = people;
db.prepare("UPDATE users SET active=0 WHERE id=?").run(inactive.id);
const now = repo.today(), yesterday = addDays(now,-1);
const log = db.prepare("INSERT INTO shift_logs (user_id,date,data,completed_at,shift_type,team) VALUES (?,?,?,?,?,?)");
log.run(one.id,now,JSON.stringify([{kind:"misp",iocs:3,done:true},{kind:"basic",done:false}]),`${now}T17:00:00Z`,"morning",one.team);
log.run(two.id,now,JSON.stringify([{kind:"misp",iocs:4,done:true}]),null,"evening",two.team);
log.run(one.id,yesterday,JSON.stringify([{kind:"misp",iocs:2,done:true}]),`${yesterday}T17:00:00Z`,"morning",one.team);
log.run(inactive.id,now,JSON.stringify([{kind:"misp",iocs:99,done:true}]),`${now}T17:00:00Z`,"morning",inactive.team);
const ticket = db.prepare("INSERT INTO tickets (user_id,date,number) VALUES (?,?,?)");
ticket.run(one.id,now,"SOC-1"); ticket.run(two.id,now,"SOC-2"); ticket.run(two.id,now,"SOC-3"); ticket.run(inactive.id,now,"OTHER-1"); ticket.run(one.id,yesterday,"SOC-4");

test("dashboard aggregates preserve metrics without per-person daily database queries", () => {
  const original = db.prepare; let queries = 0;
  db.prepare = (...args) => { queries += 1; return original(...args); };
  let result;
  try { result = dashboardStats(admin); } finally { db.prepare = original; }
  const yesterdayInMonth = yesterday >= resolvePeriod({period:"this"}).from;
  assert.equal(result.soc.iocs, yesterdayInMonth ? 9 : 7);
  assert.equal(result.soc.tickets, yesterdayInMonth ? 4 : 3);
  assert.equal(result.soc.shiftCompletion, 67);
  assert.deepEqual(result.soc.iocSeries.slice(-2), [2,7]);
  assert.deepEqual(result.soc.ticketSeries.slice(-2), [1,4]);
  assert.equal(result.department.shiftCompliance, yesterdayInMonth ? 67 : 50);
  assert.ok(queries <= 20, `Dashboard made ${queries} database queries for 9 eligible staff`);
});

test("individual dashboard figures and an empty SOC roster keep their existing meaning", () => {
  const individual = dashboardStats(repo.getUser(one.id));
  const yesterdayInMonth = yesterday >= resolvePeriod({period:"this"}).from;
  assert.equal(individual.my.iocs, yesterdayInMonth ? 5 : 3);
  assert.equal(individual.my.tickets, yesterdayInMonth ? 2 : 1);
  for (const person of people) db.prepare("UPDATE users SET active=0 WHERE id=?").run(person.id);
  const empty = dashboardStats(admin);
  assert.equal(empty.soc.iocs,0);
  assert.equal(empty.soc.tickets,0);
  assert.equal(empty.soc.shiftCompletion,0);
  assert.deepEqual(empty.soc.iocSeries,Array(7).fill(0));
  assert.deepEqual(empty.soc.ticketSeries.slice(-2),[1,4]);
  assert.equal(empty.department.shiftCompliance,0);
});

test("team overdue totals omit manager review but retain unfinished analyst work", () => {
  const review = repo.createTask({ title: "Waiting for manager", a: one.id, prio: "high", cx: 2, due: yesterday }, admin.id);
  repo.updateTask(review.id, { status: "review" }, one.id);
  const active = repo.createTask({ title: "Unfinished", a: one.id, prio: "high", cx: 2, due: yesterday }, admin.id);
  repo.updateTask(active.id, { status: "progress" }, one.id);
  const soc = teamStats(resolvePeriod({ period: "this" })).find((row) => row.team === "SOC");
  assert.equal(soc.overdue, 1);
});
