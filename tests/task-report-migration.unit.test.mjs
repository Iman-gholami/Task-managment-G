import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-report-migration-"));
const databasePath = path.join(directory, "legacy.db");
const legacy = new DatabaseSync(databasePath);
legacy.exec(`
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
  INSERT INTO meta VALUES ('sample_data_purged', 'yes');
  CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL, team TEXT NOT NULL, color TEXT NOT NULL,
    assist TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  INSERT INTO users (id, name, email, password_hash, role, team, color) VALUES
    ('admin', 'Existing manager', 'existing@example.invalid', 'unused', 'security_manager', 'Security Department', '#999999');
  CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    assignee TEXT NOT NULL REFERENCES users(id), team TEXT NOT NULL, status TEXT NOT NULL, prio TEXT NOT NULL,
    cx INTEGER NOT NULL, due TEXT NOT NULL, hours REAL NOT NULL DEFAULT 0, quality TEXT, created_by TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')), review_required INTEGER NOT NULL DEFAULT 1,
    deleted_at TEXT, deleted_by TEXT, started_at TEXT, completed_at TEXT, created_at TEXT);
  INSERT INTO tasks (id, title, assignee, team, status, prio, cx, due, hours, created_by, created_at)
    VALUES ('T-9001', 'Existing review', 'admin', 'Security Department', 'review', 'normal', 2, '—', 7.5, 'admin', datetime('now'));
  CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES tasks(id),
    user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), edited_at TEXT);
  INSERT INTO comments (task_id, user_id, body) VALUES ('T-9001', 'admin', 'Existing investigation notes');
`);
legacy.close();
process.env.DATABASE_PATH = databasePath;
const repo = await import("@/lib/server/repo");

test("migration leaves previous tasks, hours and comments intact without inventing a report", () => {
  const task = repo.getTask("T-9001");
  const details = repo.getTaskDetails("T-9001");
  assert.equal(task.status, "review");
  assert.equal(task.hours, 7.5);
  assert.equal(details.comments[0].body, "Existing investigation notes");
  assert.deepEqual(details.report, { workPerformed: "", outcome: "", hoursRecorded: false, revision: 0 });
  assert.deepEqual(details.reviewReturns, []);
});

test("report and return evidence are committed together and stale writes change nothing", () => {
  const returned = repo.commitTaskUpdate("T-9001", { status: "returned" }, "admin", {
    expectedStatus: "review", expectedAssignee: "admin", returnReason: "Add source evidence", events: ["returned it for changes"],
  });
  assert.equal(returned.status, "returned");
  assert.equal(repo.getTaskDetails("T-9001").currentReturn.reason, "Add source evidence");
  const report = { workPerformed: "Inspected logs", outcome: "Completed", hoursRecorded: true };
  assert.ok(repo.commitTaskUpdate("T-9001", { hours: 8 }, "admin", {
    expectedStatus: "returned", expectedAssignee: "admin", expectedRevision: 0, report,
  }));
  const stale = repo.commitTaskUpdate("T-9001", { status: "progress", hours: 99 }, "admin", {
    expectedStatus: "returned", expectedAssignee: "admin", expectedRevision: 0,
    report: { ...report, outcome: "stale" }, events: ["should not be recorded"],
  });
  assert.equal(stale, null);
  assert.equal(repo.getTask("T-9001").status, "returned");
  assert.equal(repo.getTask("T-9001").hours, 8);
  assert.equal(repo.getTaskDetails("T-9001").report.outcome, "Completed");
  assert.ok(!repo.getTaskDetails("T-9001").events.some((event) => event.text === "should not be recorded"));
});

test.after(() => { globalThis.__sentinelDb?.close(); fs.rmSync(directory, { recursive: true, force: true }); });
