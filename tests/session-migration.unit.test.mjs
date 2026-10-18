import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-session-migration-"));
const databasePath = path.join(directory, "old.db");

// Simulate an existing installation created before the idle tracking column.
const legacy = new DatabaseSync(databasePath);
legacy.exec("CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)");
legacy.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
  .run("legacy-weeklong-token", "some-user", Date.now() + 7 * 864e5);
legacy.close();

process.env.DATABASE_PATH = databasePath;
process.env.ADMIN_NAME = "Session Migration Admin";
process.env.ADMIN_EMAIL = "session-migration-admin@local.invalid";
process.env.ADMIN_PASSWORD = "Session-Migration-Test-Password";

const { db } = await import("@/lib/server/db");

test("legacy seven-day sessions are revoked during database migration", () => {
  const columns = db.prepare("PRAGMA table_info(sessions)").all().map((column) => column.name);
  assert.ok(columns.includes("last_activity_at"));
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count, 0);
});

test("new sessions can store activity timestamps without affecting users", () => {
  const admin = db.prepare("SELECT id FROM users WHERE role = 'security_manager'").get();
  assert.ok(admin);
  const now = Date.now();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at, last_activity_at) VALUES (?, ?, ?, ?)")
    .run("new-token", admin.id, now + 12 * 60 * 60 * 1000, now);
  const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get("new-token");
  assert.equal(row.last_activity_at, now);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM users").get().count, 1);
});

test.after(() => {
  globalThis.__sentinelDb?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
