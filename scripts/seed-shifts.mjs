import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "sentinel.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

db.exec(`
  CREATE TABLE IF NOT EXISTS shift_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    shift_type TEXT NOT NULL CHECK (shift_type IN ('morning','evening','night')),
    created_by TEXT REFERENCES users(id),
    updated_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_shift_schedules_date ON shift_schedules(date);
`);

const analysts = db.prepare(`
  SELECT id, name, team
  FROM users
  WHERE active = 1
    AND role = 'analyst'
    AND team IN ('SOC · L1', 'SOC · L2', 'SOC · L3')
  ORDER BY name
`).all();

if (!analysts.length) {
  console.error("No active SOC L1/L2/L3 analysts were found. Existing users were not changed.");
  process.exit(1);
}

const manager = db.prepare(`
  SELECT id FROM users
  WHERE active = 1 AND role IN ('soc_manager', 'security_manager')
  ORDER BY CASE role WHEN 'soc_manager' THEN 0 ELSE 1 END, name
  LIMIT 1
`).get();

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d, amount) => new Date(d.getTime() + amount * 864e5);

// Mehr 1405 is 2026-09-23 through 2026-10-22. Seed from today forward, never into the past.
const mehrStart = new Date("2026-09-23T00:00:00Z");
const mehrEnd = new Date("2026-10-22T00:00:00Z");
const today = new Date();
const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
const start = todayUtc > mehrStart ? todayUtc : mehrStart;

if (start > mehrEnd) {
  console.log("Mehr 1405 has already ended; nothing was seeded.");
  process.exit(0);
}

const insert = db.prepare(`
  INSERT INTO shift_schedules (user_id, date, shift_type, created_by, updated_by)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id, date) DO NOTHING
`);

let inserted = 0;
let kept = 0;
let dayIndex = 0;

db.exec("BEGIN IMMEDIATE");
try {
  for (let day = start; day <= mehrEnd; day = addDays(day, 1), dayIndex += 1) {
    const date = iso(day);
    const rotated = analysts.map((_, i) => analysts[(i + dayIndex) % analysts.length]);

    // Balanced test rota: roughly 40% morning, 30% until-20:00, 30% night.
    const morningCount = Math.max(1, Math.ceil(rotated.length * 0.4));
    const eveningCount = rotated.length >= 2 ? Math.max(1, Math.ceil(rotated.length * 0.3)) : 0;

    rotated.forEach((person, index) => {
      let shiftType = "night";
      if (index < morningCount) shiftType = "morning";
      else if (index < morningCount + eveningCount) shiftType = "evening";

      const result = insert.run(person.id, date, shiftType, manager?.id ?? null, manager?.id ?? null);
      if (Number(result.changes) > 0) inserted += 1;
      else kept += 1;
    });
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

console.log(`Database: ${dbPath}`);
console.log(`Analysts: ${analysts.length}`);
console.log(`Seeded ${inserted} test assignments through 30 Mehr 1405 (2026-10-22).`);
console.log(`Kept ${kept} existing assignments unchanged.`);
console.log("No users were created or replaced.");
