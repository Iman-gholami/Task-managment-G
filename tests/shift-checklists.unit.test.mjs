// Server-level tests for configurable Shift Log checklists: migration of an existing database, checklist
// versioning, group assignment, and per-analyst / per-shift completion. They run the real server modules
// against temporary SQLite files (see tests/support/server-modules.mjs for how they load outside Next.js).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { STANDARD_CHECKLIST } from "../lib/checklists.js";

process.env.ADMIN_NAME = "Unit Administrator";
process.env.ADMIN_EMAIL = "unit-admin@local.invalid";
process.env.ADMIN_PASSWORD = "Unit-Only-Admin-2026!";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-checklists-"));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Points the server modules at a database file (the connection is opened lazily on first use). */
function useDatabase(name) {
  globalThis.__sentinelDb?.close();
  globalThis.__sentinelDb = undefined;
  process.env.DATABASE_PATH = path.join(dir, name);
  return process.env.DATABASE_PATH;
}

const { db } = await import("@/lib/server/db");
const repo = await import("@/lib/server/repo");
const checklists = await import("@/lib/server/shift-checklists");
const { routineStats } = await import("@/lib/server/stats");
const { managerUpdateShiftActivity } = await import("@/lib/server/shift-log-admin");
const { hashPassword } = await import("@/lib/server/password");

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const legacyActivities = (numbers) =>
  STANDARD_CHECKLIST.items.filter((it) => numbers.includes(it.legacyN)).map((it) => ({
    n: it.legacyN, title: it.title, kind: it.kind, done: false, ...(it.kind === "misp" ? { iocs: 0, bale: false, mispRef: "" } : {}),
  }));
const L2_ITEMS = [
  { title: "Review escalated incidents", kind: "basic" },
  { title: "Investigate unresolved alerts", kind: "monitor", hint: "Escalate to L3 when blocked" },
  { title: "Review detection and correlation rules", kind: "basic", shiftTypes: ["morning", "evening"] },
  { title: "Complete technical shift handover", kind: "basic" },
];

test("an existing database is migrated without changing any recorded shift log", () => {
  const file = useDatabase("legacy.db");
  const today = repo.today();
  const yesterday = addDays(today, -1);

  // A database as written by the previous version: hard-coded routine, no checklist tables or columns.
  const old = new DatabaseSync(file);
  old.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL, team TEXT NOT NULL, color TEXT NOT NULL,
      assist TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE shift_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id), date TEXT NOT NULL,
      shift_type TEXT NOT NULL CHECK (shift_type IN ('morning','evening','night')), created_by TEXT, updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id, date)
    );
    CREATE TABLE shift_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id), date TEXT NOT NULL,
      data TEXT NOT NULL, completed_at TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')), shift_type TEXT, UNIQUE(user_id, date)
    );
    CREATE TABLE tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id), date TEXT NOT NULL,
      number TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO meta VALUES ('sample_data_purged', '2026-01-01'), ('transitions_backfilled', '2026-01-01');
  `);
  const user = old.prepare("INSERT INTO users (id, name, email, password_hash, role, team, color) VALUES (?, ?, ?, ?, ?, ?, '#5B6CF0')");
  user.run("boss", "Old Boss", "boss@corp.test", hashPassword("Old-Boss-Password-1"), "security_manager", "Security Department");
  user.run("l1", "Layla One", "l1@corp.test", hashPassword("x"), "analyst", "SOC · L1");
  user.run("l2", "Liam Two", "l2@corp.test", hashPassword("x"), "analyst", "SOC · L2");
  const schedule = old.prepare("INSERT INTO shift_schedules (user_id, date, shift_type) VALUES (?, ?, ?)");
  schedule.run("l1", yesterday, "evening");
  schedule.run("l1", today, "morning");
  schedule.run("l2", today, "evening");
  const log = old.prepare("INSERT INTO shift_logs (user_id, date, data, completed_at, shift_type) VALUES (?, ?, ?, ?, ?)");
  const history = JSON.stringify(legacyActivities([1, 2, 3, 4, 5, 6, 7, 8]).map((a) => ({ ...a, done: a.n !== 4, ...(a.kind === "misp" ? { iocs: 9 } : {}) })));
  log.run("l1", yesterday, history, "2026-10-11T18:00:00.000Z", "evening");
  log.run("l1", today, JSON.stringify(legacyActivities([1, 3, 5, 6, 7])), null, "morning");
  log.run("l2", today, JSON.stringify(legacyActivities([1, 2, 3, 4, 5, 6, 7, 8]).map((a) => ({ ...a, done: a.n === 1 }))), null, "evening");
  old.close();

  // First access runs the migration.
  const [standard] = checklists.listChecklists();
  assert.equal(standard.name, "Standard SOC routine");
  assert.equal(standard.version, 1);
  assert.deepEqual(standard.items.map(({ title, kind, shiftTypes, legacyN, active }) => ({ title, kind, shiftTypes, legacyN, active })),
    STANDARD_CHECKLIST.items.map(({ title, kind, shiftTypes, legacyN }) => ({ title, kind, shiftTypes, legacyN, active: true })));
  assert.deepEqual(checklists.listAssignments().map((g) => [g.team, g.checklistId, g.enabled]), [
    ["SOC · L1", standard.id, true], ["SOC · L2", standard.id, true], ["SOC · L3", standard.id, true],
  ]);
  assert.equal(checklists.listVersions(standard.id).length, 1);

  // Recorded history is byte-for-byte unchanged and still reads as the built-in routine.
  const stored = db.prepare("SELECT data, completed_at, checklist_id, checklist_version FROM shift_logs WHERE user_id = 'l1' AND date = ?").get(yesterday);
  assert.equal(stored.data, history);
  assert.equal(stored.completed_at, "2026-10-11T18:00:00.000Z");
  assert.equal(stored.checklist_version, null);
  assert.equal(repo.findShiftLog("l1", yesterday).checklist.builtIn, true);

  // Today's untouched log follows the configured checklist; numbering of the standard routine is preserved.
  const fresh = repo.getShiftLog("l1", today);
  assert.deepEqual(fresh.checklist, { id: standard.id, name: "Standard SOC routine", version: 1 });
  assert.deepEqual(fresh.activities.map((a) => a.legacyN), [1, 3, 5, 6, 7]);
  assert.ok(fresh.activities.every((a) => Number.isInteger(a.itemId) && a.done === false));

  // A log the analyst already started keeps exactly what they were working on.
  const started = repo.getShiftLog("l2", today);
  assert.equal(started.checklist.builtIn, true);
  assert.equal(started.activities.length, 8);
  assert.equal(started.activities[0].done, true);
  assert.equal(started.activities[0].itemId, undefined);

  // Per-activity statistics for the old log are unchanged (activity 4 not done, the rest done).
  const stats = routineStats("l1", { from: yesterday, to: yesterday });
  assert.deepEqual(stats.perActivity, [100, 100, 100, 0, 100, 100, 100, 100]);
  assert.equal(stats.iocs, 9);

  // Migrating twice is a no-op.
  globalThis.__sentinelDb.close();
  globalThis.__sentinelDb = undefined;
  assert.equal(checklists.listChecklists().length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM shift_checklist_versions").get().n, 1);
});

test("managers give Layer 3 its own checklist; each group sees its own and completion stays per analyst and per shift", () => {
  useDatabase("fresh.db");
  const today = repo.today();
  const tomorrow = addDays(today, 1);
  const member = (name, team, role = "analyst") => repo.createMember({ name, email: `${name.split(" ")[0].toLowerCase()}@corp.test`, role, team, passwordHash: hashPassword("x") });
  const manager = member("Mona Manager", "SOC", "soc_manager");
  const a1 = member("Ali First", "SOC · L1");
  const a2 = member("Ava Second", "SOC · L1");
  const b1 = member("Bita First", "SOC · L3");
  const b2 = member("Babak Second", "SOC · L3");
  for (const u of [a1, a2]) repo.setShiftSchedule(u.id, today, "evening", manager.id);
  for (const u of [b1, b2]) repo.setShiftSchedule(u.id, today, "morning", manager.id);
  repo.setShiftSchedule(b1.id, tomorrow, "morning", manager.id);

  // Before anything is configured, Layer 3 keeps the routine it used before (no regression).
  assert.equal(repo.getShiftLog(b2.id).checklist.name, "Layer 3 · Engineering daily work");

  const l2 = checklists.createChecklist({ name: "Layer 3 technical routine", items: L2_ITEMS }, manager.id);
  assert.equal(l2.version, 1);
  assert.deepEqual(l2.groups, [], "a new checklist is not used until it is assigned");
  checklists.setAssignment("SOC · L3", { checklistId: l2.id }, manager.id);

  // Correct checklist per group.
  const logA1 = repo.getShiftLog(a1.id);
  const logB1 = repo.getShiftLog(b1.id);
  assert.equal(logA1.checklist.name, "Standard SOC routine");
  assert.equal(logA1.activities.length, 8);
  assert.deepEqual(logB1.checklist, { id: l2.id, name: "Layer 3 technical routine", version: 1 });
  assert.deepEqual(logB1.activities.map((a) => a.title), L2_ITEMS.map((it) => it.title));
  assert.equal(logB1.activities[1].hint, "Escalate to L3 when blocked");
  assert.equal(repo.getShiftLog(b2.id).checklist.id, l2.id, "an unstarted log follows the new assignment");

  // Individual completion: one analyst's tick never reaches a colleague or another shift.
  const first = logB1.activities[0];
  const after = repo.updateActivity(b1.id, first.n, { done: true }, first.itemId);
  assert.equal(after[0].done, true);
  assert.match(after[0].doneAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(repo.getShiftLog(b1.id).activities[0].done, true, "persists across reads");
  assert.equal(repo.getShiftLog(b2.id).activities[0].done, false, "not shared with another analyst");
  assert.equal(repo.getShiftLog(a1.id).activities[0].done, false, "not shared with another group");
  const nextShift = repo.getShiftLog(b1.id, tomorrow);
  assert.ok(nextShift.activities.every((a) => !a.done), "never carried into a future shift");
  repo.updateActivity(b1.id, first.n, { done: false }, first.itemId);
  assert.equal(repo.getShiftLog(b1.id).activities[0].doneAt, undefined, "unchecking clears the timestamp");
  repo.updateActivity(b1.id, first.n, { done: true }, first.itemId);

  // Editing the checklist creates version 2; started logs keep version 1, unstarted ones move to version 2.
  const draft = {
    version: 1,
    name: l2.name,
    description: "Layer 3 analysts",
    items: [
      { ...l2.items[3] },
      { ...l2.items[0], title: "Review escalated incidents (P1 first)" },
      { ...l2.items[2], active: false },
      { title: "Check SOAR playbook runs", kind: "basic" },
    ],
  };
  const { checklist: v2, changes } = checklists.saveChecklist(l2.id, draft, manager.id);
  assert.equal(v2.version, 2);
  assert.deepEqual(changes, { added: 1, removed: 1, edited: 2, reordered: true, details: true, any: true });
  assert.deepEqual(checklists.listVersions(l2.id).map((v) => [v.version, v.items, v.activeItems]), [[2, 4, 3], [1, 4, 4]]);
  assert.ok(checklists.listEvents(l2.id).some((e) => e.action === "saved" && /^Version 2 · /.test(e.detail)));

  const kept = repo.getShiftLog(b1.id);
  assert.equal(kept.checklist.version, 1);
  assert.equal(kept.activities[0].title, "Review escalated incidents");
  const moved = repo.getShiftLog(b2.id);
  assert.equal(moved.checklist.version, 2);
  assert.deepEqual(moved.activities.map((a) => a.title), ["Complete technical shift handover", "Review escalated incidents (P1 first)", "Check SOAR playbook runs"]);

  // A client still showing version 1 cannot tick the wrong item.
  assert.throws(() => repo.updateActivity(b2.id, 2, { done: true }, l2.items[1].id), (e) => e.status === 409 && e.stale === true);
  assert.ok(repo.getShiftLog(b2.id).activities.every((a) => !a.done));

  // Two managers editing at once: the second save is refused instead of overwriting the first.
  assert.throws(() => checklists.saveChecklist(l2.id, { ...draft, name: "Other name" }, manager.id), (e) => e.status === 409 && e.conflict);
  assert.throws(() => checklists.saveChecklist(l2.id, { version: 2, name: "", items: [] }, manager.id), (e) => e.status === 400);
  assert.throws(() => checklists.saveChecklist(l2.id, { version: 2, name: l2.name, items: [] }, manager.id), /Keep at least one active item/);
  assert.throws(() => checklists.saveChecklist(l2.id, { version: 2, name: "Standard SOC routine", items: v2.items }, manager.id), /already has this name/);
  assert.throws(() => checklists.saveChecklist(l2.id, { version: 2, name: l2.name, items: [{ id: 1, title: "Foreign item" }] }, manager.id), (e) => e.status === 409);

  // Manager corrections are stamped and never reopen the log.
  const corrected = managerUpdateShiftActivity(b1.id, today, 2, { note: "Checked with L3" }, kept.activities[1].itemId, manager.id);
  assert.equal(corrected.activities[1].note, "Checked with L3");
  assert.equal(corrected.activities[1].correctedBy, manager.id);

  // Submitting today's log does not complete tomorrow's.
  for (const a of repo.getShiftLog(b1.id).activities) repo.updateActivity(b1.id, a.n, { done: true }, a.itemId);
  repo.setShiftCompleted(b1.id, true);
  assert.ok(repo.getShiftLog(b1.id).completedAt);
  assert.equal(repo.getShiftLog(b1.id, tomorrow).completedAt, null);

  // Custom items count toward completion but are never reported as one of the eight standard activities.
  const stats = routineStats(b1.id, { from: today, to: today });
  assert.equal(stats.completion, 100);
  assert.deepEqual(stats.perActivity, [0, 0, 0, 0, 0, 0, 0, 0]);
});

test("turning a group's checklist off, reassigning and archiving", () => {
  useDatabase("assign.db");
  const today = repo.today();
  const boss = repo.listUsers().find((u) => u.role === "security_manager");
  const analyst = repo.createMember({ name: "Lena One", email: "lena@corp.test", role: "analyst", team: "SOC · L1", passwordHash: hashPassword("x") });
  repo.setShiftSchedule(analyst.id, today, "night", boss.id);
  const [standard] = checklists.listChecklists();

  checklists.setAssignment("SOC · L1", { enabled: false }, boss.id);
  const off = repo.getShiftLog(analyst.id);
  assert.equal(off.checklist, null);
  assert.deepEqual(off.activities, []);
  assert.deepEqual(checklists.listEvents(standard.id).map((e) => e.action).slice(0, 1), ["disabled"]);

  checklists.setAssignment("SOC · L1", { enabled: true }, boss.id);
  assert.equal(repo.getShiftLog(analyst.id).activities.length, 5, "turning it back on applies to logs not yet started");

  const empty = checklists.createChecklist({ name: "Empty draft" }, boss.id);
  assert.throws(() => checklists.setAssignment("SOC · L1", { checklistId: empty.id }, boss.id), /no active items/);
  assert.throws(() => checklists.setAssignment("Threat Intelligence", { checklistId: standard.id }, boss.id), (e) => e.status === 400);

  const copy = checklists.createChecklist({ name: "L1 routine", copyFrom: standard.id }, boss.id);
  assert.equal(copy.items.length, 8);
  assert.ok(copy.items.every((it) => it.legacyN === undefined), "copies are not counted as standard activities");
  assert.throws(() => checklists.createChecklist({ name: "l1 ROUTINE" }, boss.id), /already has this name/);
  checklists.setAssignment("SOC · L1", { checklistId: copy.id }, boss.id);
  assert.equal(checklists.listAssignments().find((g) => g.team === "SOC · L1").checklistName, "L1 routine");
  assert.ok(checklists.listEvents(standard.id).some((e) => e.action === "unassigned" && e.team === "SOC · L1"));

  assert.throws(() => checklists.archiveChecklist(copy.id, boss.id), /still uses this checklist/);
  checklists.archiveChecklist(empty.id, boss.id);
  assert.deepEqual(checklists.listChecklists().map((c) => c.name), ["L1 routine", "Standard SOC routine"]);

  checklists.setAssignment("SOC · L1", { checklistId: null }, boss.id);
  assert.equal(checklists.listAssignments().find((g) => g.team === "SOC · L1").checklistId, null);
  assert.equal(repo.getShiftLog(analyst.id).checklist, null);
});
