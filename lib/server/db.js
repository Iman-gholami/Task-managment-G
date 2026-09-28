import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "@/lib/server/password";
import { initialActivities, initialTasks, initialTickets, people } from "@/lib/data";

const ROLE_KEYS = { Analyst: "analyst", Engineer: "engineer", "SOC Manager": "soc_manager", "Security Manager": "security_manager" };

function open() {
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "sentinel.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(`
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
  `);
  seed(db);
  return db;
}

function seed(db) {
  db.exec("BEGIN IMMEDIATE");
  try {
    if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n === 0) insertSeed(db);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function insertSeed(db) {
  const password = hashPassword(process.env.SEED_PASSWORD || "ChangeMe123!");
  const insertUser = db.prepare("INSERT INTO users (id, name, email, password_hash, role, team, color, assist) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const p of people) {
    const email = `${p.name.split(" ")[0].toLowerCase()}@corp.local`;
    insertUser.run(p.id, p.name, email, password, ROLE_KEYS[p.role], p.team, p.color, p.assist ?? null);
  }
  const insertTask = db.prepare("INSERT INTO tasks (id, title, assignee, team, status, prio, cx, due, hours, quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const t of initialTasks) insertTask.run(t.id, t.title, t.a, t.team, t.status, t.prio, t.cx, t.due, t.hours, t.quality);
  db.prepare("UPDATE tasks SET description = ? WHERE id = ?").run(
    "Current rule fires on every login from a new country, producing ~40 false positives/day. Add per-user baselining and a risk score so only logins that combine new geography with an unusual time window or ASN reach the analyst queue.",
    "T-1042"
  );
  const today = new Date().toISOString().slice(0, 10);
  db.prepare("INSERT INTO shift_logs (user_id, date, data) VALUES (?, ?, ?)").run("sr", today, JSON.stringify(initialActivities));
  const insertTicket = db.prepare("INSERT INTO tickets (user_id, date, number, ref, description) VALUES (?, ?, ?, ?, ?)");
  for (const t of initialTickets) insertTicket.run("sr", today, t.no, t.ref, t.desc);
}

// Opened lazily on first query (not at import, so `next build` never touches it)
// and reused across hot reloads in dev.
const g = globalThis;
const getDb = () => g.__sentinelDb ?? (g.__sentinelDb = open());
export const db = { prepare: (sql) => getDb().prepare(sql), exec: (sql) => getDb().exec(sql) };
