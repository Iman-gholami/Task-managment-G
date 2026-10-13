// Upgrade safety: a database created and used by `main` (d725b91) opens with the current code, gains the new
// columns and tables, keeps every row exactly as it was and migrates idempotently. The fixture was written by
// main's own code (tests/fixtures/generate-main-fixture.mjs), not by hand. Also covers display preferences.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PREF_COOKIE_MAX_AGE } from "../lib/i18n/config.js";

// The fixture has an active Security Manager, so an upgrade must never need the bootstrap settings.
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;
delete process.env.COOKIE_SECURE;

const FIXTURE = fs.readFileSync(new URL("./fixtures/main-d725b91.sql", import.meta.url), "utf8");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-migrations-"));
test.after(() => {
  globalThis.__sentinelDb?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Closes the app's connection; the next query opens (and migrates) the database at DATABASE_PATH again. */
function reopen() {
  globalThis.__sentinelDb?.close();
  globalThis.__sentinelDb = undefined;
}

/** A fresh copy of main's database in its own file, used by the app from the next query on. */
function loadFixture(name) {
  reopen();
  process.env.DATABASE_PATH = path.join(dir, name);
  const raw = new DatabaseSync(process.env.DATABASE_PATH);
  raw.exec(FIXTURE);
  raw.close();
}

const { db } = await import("@/lib/server/db");
const { getPreferences, savePreferences, setPreferenceCookies } = await import("@/lib/server/preferences");

// What main left behind, read from an untouched copy.
const reference = new DatabaseSync(":memory:");
reference.exec(FIXTURE);
const OLD_TABLES = reference.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
const NEW_TABLES = ["notifications", "saved_views", "user_flags"];
const NEW_COLUMNS = { users: ["locale", "density"] };
const NO_PREFS = { locale: null, density: null };

const plain = (rows) => rows.map((r) => ({ ...r }));
const columnsOf = (conn, table) => conn.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
const rowsOf = (conn, table, cols) => plain(conn.prepare(`SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM "${table}" ORDER BY rowid`).all());
const schemaOf = (conn) => plain(conn.prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_autoindex%' ORDER BY type, name").all());
const sequenceOf = (conn) => plain(conn.prepare("SELECT name, seq FROM sqlite_sequence ORDER BY name").all());
const countsOf = (conn) => Object.fromEntries([...OLD_TABLES, ...NEW_TABLES].map((t) => [t, conn.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n]));

test("main's fixture is a real, populated database", () => {
  assert.ok(OLD_TABLES.length >= 18, `expected main's full schema, got ${OLD_TABLES.join(", ")}`);
  for (const t of ["users", "tasks", "task_transitions", "task_events", "comments", "shift_schedules", "shift_logs", "tickets", "shift_change_requests", "sessions"]) {
    assert.ok(reference.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n > 0, `${t} has rows`);
  }
  assert.deepEqual(columnsOf(reference, "users").filter((c) => NEW_COLUMNS.users.includes(c)), []);
  for (const t of NEW_TABLES) assert.equal(OLD_TABLES.includes(t), false);
});

test("the app opens main's database, adds the new columns and tables, and keeps every row", () => {
  loadFixture("upgrade.db");
  assert.deepEqual(db.prepare("PRAGMA integrity_check").all().map((r) => r.integrity_check), ["ok"]);

  // Additive only: every old table keeps its columns (same order) and its exact rows; only users gains columns.
  for (const table of OLD_TABLES) {
    const old = columnsOf(reference, table);
    assert.deepEqual(columnsOf(db, table), [...old, ...(NEW_COLUMNS[table] ?? [])], `${table} columns`);
    assert.deepEqual(rowsOf(db, table, old), rowsOf(reference, table, old), `${table} rows`);
  }
  // Nothing in main's schema was rewritten: same table and index definitions (users only gained two columns).
  const now = new Map(schemaOf(db).map((o) => [o.name, o.sql]));
  for (const { name, sql } of schemaOf(reference)) {
    assert.equal(now.get(name), name === "users" ? `${sql.slice(0, -1)}, locale TEXT, density TEXT)` : sql, `${name} definition`);
  }
  // AUTOINCREMENT counters are kept, so deleted ids (comment 3) are never reused.
  assert.deepEqual(sequenceOf(db), sequenceOf(reference));

  assert.deepEqual(plain(db.prepare("SELECT DISTINCT locale, density FROM users").all()), [NO_PREFS]);
  for (const table of NEW_TABLES) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0, `${table} starts empty`);
  assert.deepEqual(columnsOf(db, "notifications"), ["id", "user_id", "type", "params", "actor_id", "target", "created_at", "read_at"]);
  assert.deepEqual(columnsOf(db, "saved_views"), ["id", "user_id", "scope", "name", "state", "position", "created_at", "updated_at"]);
  assert.deepEqual(columnsOf(db, "user_flags"), ["user_id", "key", "value", "updated_at"]);
  const indexes = plain(db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('notifications', 'saved_views') ORDER BY name").all());
  assert.deepEqual(indexes, [
    { name: "idx_notifications_unread", tbl_name: "notifications" },
    { name: "idx_notifications_user", tbl_name: "notifications" },
    { name: "idx_saved_views_user", tbl_name: "saved_views" },
  ]);

  // Spot checks of what people would see: Persian text, workflow history, shift records.
  const admin = db.prepare("SELECT name, role, active FROM users WHERE id = 'admin'").get();
  assert.deepEqual({ ...admin }, { name: "بهنام فراهانی", role: "security_manager", active: 1 });
  assert.equal(db.prepare("SELECT active FROM users WHERE id = 'kf'").get().active, 0, "deactivated member with a legacy demo id is kept");
  const t1 = db.prepare("SELECT title, status, quality, hours, assignee FROM tasks WHERE id = 'T-1001'").get();
  assert.deepEqual({ ...t1 }, { title: "بررسی تلاش ورود ناموفق به AD", status: "done", quality: "good", hours: 3.5, assignee: "sr" });
  assert.deepEqual(
    db.prepare("SELECT to_status FROM task_transitions WHERE task_id = 'T-1001' ORDER BY id").all().map((r) => r.to_status),
    ["todo", "progress", "review", "done"],
  );
  assert.deepEqual(db.prepare("SELECT id FROM comments ORDER BY id").all().map((r) => r.id), [1, 2, 4, 5]);
  const log = db.prepare("SELECT data, checklist_name FROM shift_logs WHERE user_id = 'sr' AND completed_at IS NULL").get();
  assert.equal(log.checklist_name, "Standard SOC routine");
  assert.equal(JSON.parse(log.data).find((a) => a.kind === "misp").iocs, 12);
  assert.deepEqual(db.prepare("SELECT status FROM shift_change_requests ORDER BY id").all().map((r) => r.status), ["pending_manager", "approved", "rejected"]);
  assert.equal(db.prepare("SELECT description FROM tickets WHERE number = 'INC-2026-4471'").get().description, "گزارش فیشینگ از واحد مالی");

  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("opening the upgraded database again changes nothing", () => {
  loadFixture("twice.db");
  const first = { schema: schemaOf(db), counts: countsOf(db), sequence: sequenceOf(db), meta: plain(db.prepare("SELECT * FROM meta ORDER BY key").all()) };
  assert.deepEqual(first.meta, plain(reference.prepare("SELECT * FROM meta ORDER BY key").all()), "no migration bookkeeping is redone");

  for (let i = 0; i < 2; i++) {
    reopen();
    assert.deepEqual(
      { schema: schemaOf(db), counts: countsOf(db), sequence: sequenceOf(db), meta: plain(db.prepare("SELECT * FROM meta ORDER BY key").all()) },
      first,
    );
  }
  for (const table of OLD_TABLES) {
    const cols = columnsOf(reference, table);
    assert.deepEqual(rowsOf(db, table, cols), rowsOf(reference, table, cols), `${table} rows after reopening`);
  }
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("preferences are saved per person, validated, and survive a restart", () => {
  loadFixture("prefs.db");
  assert.deepEqual(getPreferences("sr"), NO_PREFS);
  assert.deepEqual(savePreferences("sr", { locale: "en", density: "compact" }), { locale: "en", density: "compact" });
  assert.deepEqual(getPreferences("sr"), { locale: "en", density: "compact" });

  // Unsupported or missing values leave the saved ones alone.
  assert.deepEqual(savePreferences("sr", { locale: "de", density: "tiny" }), { locale: "en", density: "compact" });
  assert.deepEqual(savePreferences("sr", { density: "comfortable" }), { locale: "en", density: "comfortable" });
  assert.deepEqual(savePreferences("sr", {}), { locale: "en", density: "comfortable" });
  assert.deepEqual(savePreferences("sr"), { locale: "en", density: "comfortable" });

  // Persian ids work; nobody else changes; an unknown person has none.
  assert.deepEqual(savePreferences("اک", { locale: "fa" }), { locale: "fa", density: null });
  assert.deepEqual(getPreferences("rm"), NO_PREFS);
  assert.deepEqual(getPreferences("nobody"), NO_PREFS);
  assert.deepEqual(savePreferences("nobody", { locale: "en" }), NO_PREFS);

  reopen();
  assert.deepEqual(getPreferences("sr"), { locale: "en", density: "comfortable" });
  // A value the app no longer supports reads as "never chosen".
  db.prepare("UPDATE users SET locale = 'ar' WHERE id = 'rm'").run();
  assert.deepEqual(getPreferences("rm"), NO_PREFS);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("preference cookies mirror only valid values", () => {
  const jar = [];
  const store = { set: (name, value, options) => jar.push({ name, value, options }) };
  setPreferenceCookies(store, { locale: "en", density: "huge" });
  assert.deepEqual(jar, [{ name: "so_lang", value: "en", options: { path: "/", sameSite: "lax", maxAge: PREF_COOKIE_MAX_AGE, httpOnly: false, secure: false } }]);

  process.env.COOKIE_SECURE = "true";
  try {
    setPreferenceCookies(store, { density: "compact" });
  } finally {
    delete process.env.COOKIE_SECURE;
  }
  assert.equal(jar.length, 2);
  assert.equal(jar[1].name, "so_density");
  assert.equal(jar[1].value, "compact");
  assert.equal(jar[1].options.secure, true);

  setPreferenceCookies(store, {});
  setPreferenceCookies(store);
  assert.equal(jar.length, 2);
});

test("the one-time demo purge is never blocked by the new tables", () => {
  loadFixture("purge.db");
  // An old demo account (…@corp.local) that somehow has notifications, a saved view and a flag, and a real
  // person with a notification from it; then pretend the purge has not run yet.
  db.prepare("INSERT INTO users (id, name, email, password_hash, role, team, color) VALUES ('ms', 'Demo Analyst', 'ms@corp.local', 'x', 'analyst', 'SOC · L1', '#5B6CF0')").run();
  db.prepare("INSERT INTO notifications (user_id, type, actor_id, target) VALUES ('ms', 'mention', 'sr', 'T-1001')").run();
  db.prepare("INSERT INTO notifications (user_id, type, actor_id, target) VALUES ('sr', 'mention', 'ms', 'T-1001')").run();
  db.prepare("INSERT INTO saved_views (user_id, scope, name, state) VALUES ('ms', 'tasks', 'Mine', '{}')").run();
  db.prepare("INSERT INTO user_flags (user_id, key, value) VALUES ('ms', 'welcome', 'dismissed'), ('sr', 'welcome', 'dismissed')").run();
  db.prepare("DELETE FROM meta WHERE key = 'sample_data_purged'").run();

  reopen();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE id = 'ms'").get().n, 0);
  assert.deepEqual(plain(db.prepare("SELECT user_id, actor_id FROM notifications").all()), [{ user_id: "sr", actor_id: null }]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM saved_views").get().n, 0);
  assert.deepEqual(plain(db.prepare("SELECT user_id, key FROM user_flags").all()), [{ user_id: "sr", key: "welcome" }]);
  // Real people are kept, including one whose id happens to match a demo id.
  for (const table of OLD_TABLES) {
    const cols = columnsOf(reference, table);
    if (table !== "meta") assert.deepEqual(rowsOf(db, table, cols), rowsOf(reference, table, cols), `${table} rows after the purge`);
  }
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
