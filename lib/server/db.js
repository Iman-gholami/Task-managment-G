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
  migrate(db);
  seed(db);
  return db;
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
  db.exec("UPDATE tasks SET completed_at = due || ' 16:00:00', started_at = date(due, '-4 days') || ' 09:00:00' WHERE status = 'done' AND due GLOB '[0-9]*'");
  db.exec("UPDATE tasks SET started_at = datetime('now', '-3 days') WHERE status IN ('progress', 'review', 'returned', 'blocked')");
  const addItem = db.prepare("INSERT INTO checklist_items (task_id, label, done, position) VALUES ('T-1042', ?, ?, ?)");
  [["Pull 30 days of VPN auth logs", 1], ["Baseline normal login geography per user", 1], ["Draft SPL with risk scoring", 1], ["Validate against last month's true positives", 0], ["Peer review with L2", 0]]
    .forEach(([label, done], i) => addItem.run(label, done, i));
  db.prepare("INSERT INTO comments (task_id, user_id, body, created_at) VALUES ('T-1042', 'ln', ?, datetime('now', '-1 day'))")
    .run("Please coordinate with @Arash Moradi before enabling in production — L2 owns the escalation path.");
  db.prepare("INSERT INTO task_events (task_id, user_id, text, created_at) VALUES ('T-1042', 'ln', 'created the task', datetime('now', '-4 days'))").run();
  seedHistory(db);
  db.prepare("UPDATE tasks SET description = ? WHERE id = ?").run(
    "Current rule fires on every login from a new country, producing ~40 false positives/day. Add per-user baselining and a risk score so only logins that combine new geography with an unusual time window or ASN reach the analyst queue.",
    "T-1042"
  );
  const today = new Date().toISOString().slice(0, 10);
  db.prepare("INSERT INTO shift_logs (user_id, date, data) VALUES (?, ?, ?)").run("sr", today, JSON.stringify(initialActivities));
  const insertTicket = db.prepare("INSERT INTO tickets (user_id, date, number, ref, description) VALUES (?, ?, ?, ?, ?)");
  for (const t of initialTickets) insertTicket.run("sr", today, t.no, t.ref, t.desc);
}

/** Deterministic sample shift history for the SOC analysts (previous 25 weekdays). */
function seedHistory(db) {
  let x = 7;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const insertLog = db.prepare("INSERT OR IGNORE INTO shift_logs (user_id, date, data, completed_at) VALUES (?, ?, ?, ?)");
  const insertTicket = db.prepare("INSERT INTO tickets (user_id, date, number, ref, description) VALUES (?, ?, ?, ?, ?)");
  let ticketNo = 4300;
  for (const user of ["sr", "am", "nk", "rj"]) {
    const d = new Date();
    let n = 0;
    while (n < 25) {
      d.setUTCDate(d.getUTCDate() - 1);
      if (d.getUTCDay() === 5 || d.getUTCDay() === 6) continue; // weekend (Fri/Sat)
      n++;
      const date = d.toISOString().slice(0, 10);
      const acts = initialActivities.map((a) => ({ ...a, issue: undefined, done: rnd() > 0.04 }));
      acts[7].iocs = Math.floor(rnd() * 11);
      if (rnd() > 0.85) acts[2].issue = { summary: "Sensor reporting gap", description: "", ref: "" };
      const complete = acts.every((a) => a.done);
      insertLog.run(user, date, JSON.stringify(acts), complete ? `${date}T14:50:00.000Z` : null);
      const t = Math.floor(rnd() * 3);
      for (let i = 0; i < t; i++) insertTicket.run(user, date, `INC-2026-${ticketNo++}`, `Splunk NE #${87000 + ticketNo}`, "Escalated from incident review");
    }
  }
}

// Opened lazily on first query (not at import, so `next build` never touches it)
// and reused across hot reloads in dev.
const g = globalThis;
const getDb = () => g.__sentinelDb ?? (g.__sentinelDb = open());
export const db = { prepare: (sql) => getDb().prepare(sql), exec: (sql) => getDb().exec(sql) };
