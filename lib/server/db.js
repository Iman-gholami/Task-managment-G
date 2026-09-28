import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "@/lib/server/password";

function open() {
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "sentinel.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL, team TEXT NOT NULL, color TEXT NOT NULL,
      assist TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      assignee TEXT NOT NULL REFERENCES users(id), team TEXT NOT NULL, status TEXT NOT NULL, prio TEXT NOT NULL,
      cx INTEGER NOT NULL, due TEXT NOT NULL, hours REAL NOT NULL DEFAULT 0, quality TEXT,
      created_by TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS shift_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id), date TEXT NOT NULL,
      data TEXT NOT NULL, completed_at TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id, date)
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id), date TEXT NOT NULL,
      number TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES tasks(id), label TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES tasks(id), user_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), edited_at TEXT
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES tasks(id), user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL, size INTEGER NOT NULL, mime TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS task_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES tasks(id), user_id TEXT, text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  transaction(db, () => {
    migrate(db);
    purgeSampleData(db);
    ensureAdmin(db);
  });
  return db;
}

function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    fn();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Additive migrations for databases created by earlier versions. */
function migrate(db) {
  const cols = db.prepare("PRAGMA table_info(tasks)").all().map((c) => c.name);
  if (!cols.includes("started_at")) db.exec("ALTER TABLE tasks ADD COLUMN started_at TEXT");
  if (!cols.includes("completed_at")) {
    db.exec("ALTER TABLE tasks ADD COLUMN completed_at TEXT");
    db.exec("UPDATE tasks SET completed_at = CASE WHEN due GLOB '[0-9]*' THEN due || ' 16:00:00' ELSE updated_at END WHERE status = 'done'");
  }
}

/**
 * Earlier versions seeded demo people (…@corp.local), tasks, shift logs and tickets.
 * Remove them once, together with everything attached to them. Real data is kept.
 */
function purgeSampleData(db) {
  if (db.prepare("SELECT value FROM meta WHERE key = 'sample_data_purged'").get()) return;
  const demo = db.prepare(
    "SELECT id FROM users WHERE id IN ('sr','am','nk','rj','ms','hb','ln','kf') AND email LIKE '%@corp.local'"
  ).all().map((u) => u.id);
  if (demo.length) {
    const ids = demo.map((id) => `'${id}'`).join(",");
    const tasks = `(SELECT id FROM tasks WHERE assignee IN (${ids}) OR id IN ('T-1025','T-1027','T-1028','T-1030','T-1031','T-1033','T-1035','T-1036','T-1038','T-1039','T-1040','T-1041','T-1042'))`;
    for (const table of ["checklist_items", "comments", "attachments", "task_events"]) db.exec(`DELETE FROM ${table} WHERE task_id IN ${tasks}`);
    db.exec(`DELETE FROM tasks WHERE id IN ${tasks}`);
    for (const table of ["comments", "attachments", "sessions", "tickets", "shift_logs"]) db.exec(`DELETE FROM ${table} WHERE user_id IN (${ids})`);
    db.exec(`UPDATE task_events SET user_id = NULL WHERE user_id IN (${ids})`);
    db.exec(`UPDATE tasks SET created_by = NULL WHERE created_by IN (${ids})`);
    db.exec(`DELETE FROM users WHERE id IN (${ids})`);
  }
  db.prepare("INSERT INTO meta (key, value) VALUES ('sample_data_purged', datetime('now'))").run();
}

/**
 * The only built-in account: an administrator (Security Manager), created when no active
 * Security Manager exists. Set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD before the first start.
 */
function ensureAdmin(db) {
  if (db.prepare("SELECT 1 FROM users WHERE role = 'security_manager' AND active = 1").get()) return;
  const email = process.env.ADMIN_EMAIL || "admin@local";
  if (db.prepare("SELECT 1 FROM users WHERE id = 'admin' OR email = ?").get(email)) return;
  db.prepare("INSERT INTO users (id, name, email, password_hash, role, team, color) VALUES ('admin', ?, ?, ?, 'security_manager', 'Security Department', '#5B6CF0')")
    .run(process.env.ADMIN_NAME || "Administrator", email, hashPassword(process.env.ADMIN_PASSWORD || "ChangeMe123!"));
}

// Opened lazily on first query (not at import, so `next build` never touches it)
// and reused across hot reloads in dev.
const g = globalThis;
const getDb = () => g.__sentinelDb ?? (g.__sentinelDb = open());
export const db = { prepare: (sql) => getDb().prepare(sql), exec: (sql) => getDb().exec(sql) };
