import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { hashPassword, verifyPassword } from "../lib/server/password.js";

const script = fileURLToPath(new URL("../scripts/configure-preview-admin.cjs", import.meta.url));
const original = "Preview-Only-2026!%^&";
const replacement = "Another-Preview-2026!";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-preview-admin-"));
  fs.mkdirSync(path.join(root, "test-data"));
  const file = path.join(root, "test-data", "sentinel.db");
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE COLLATE NOCASE, password_hash TEXT, role TEXT, team TEXT, color TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE sessions (token TEXT, user_id TEXT);
    CREATE TABLE records (description TEXT);
    INSERT INTO records VALUES ('preserve this');`);
  const run = (password, database = file, args = ["--apply"]) => spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", script, ...args], {
    cwd: root, env: { ...process.env, DATABASE_PATH: database }, input: password, encoding: "utf8",
  });
  return { root, file, db, run, close: () => { db.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}

test("preview admin creation and password change preserve data and produce restorable backups", () => {
  const f = fixture();
  try {
    const created = f.run(original);
    assert.equal(created.status, 0, created.stderr);
    assert.ok(!created.stdout.includes(original));
    const user = f.db.prepare("SELECT * FROM users WHERE email = ?").get("admin@local");
    assert.equal(user.role, "security_manager");
    assert.ok(verifyPassword(original, user.password_hash));
    f.db.prepare("INSERT INTO sessions VALUES (?, ?)").run("preview-session", user.id);
    const backups = () => fs.readdirSync(path.join(f.root, "test-data")).filter((name) => name.startsWith("sentinel-before-admin-"));
    const beforeSame = backups();
    const same = f.run(original);
    assert.equal(same.status, 0, same.stderr);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 1);
    assert.deepEqual(backups(), beforeSame);

    const changed = f.run(replacement);
    assert.equal(changed.status, 0, changed.stderr);
    assert.ok(!changed.stdout.includes(replacement));
    assert.ok(verifyPassword(replacement, f.db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id).password_hash));
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 0);
    assert.equal(f.db.prepare("SELECT description FROM records").get().description, "preserve this");
    const newBackup = backups().find((name) => !beforeSame.includes(name));
    assert.ok(newBackup);
    const backup = new DatabaseSync(path.join(f.root, "test-data", newBackup));
    try {
      assert.ok(verifyPassword(original, backup.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id).password_hash));
      assert.equal(backup.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 1);
    } finally { backup.close(); }
  } finally { f.close(); }
});

test("preview admin setup refuses a different role or a different database", () => {
  const f = fixture();
  try {
    const oldHash = hashPassword("Existing-Password-2026!");
    f.db.prepare("INSERT INTO users (id, name, email, password_hash, role, team, color) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("other", "Other User", "admin@local", oldHash, "analyst", "SOC · L1", "#000000");
    const conflict = f.run(original);
    assert.notEqual(conflict.status, 0);
    assert.ok(!conflict.stderr.includes(original));
    assert.equal(f.db.prepare("SELECT password_hash FROM users WHERE id = ?").get("other").password_hash, oldHash);
    assert.notEqual(f.run(original, path.join(f.root, "other.db")).status, 0);
    assert.equal(fs.existsSync(path.join(f.root, "other.db")), false);
    assert.notEqual(f.run(original, f.file, []).status, 0);
    const linkedRoot = path.join(f.root, "linked-preview");
    fs.mkdirSync(linkedRoot);
    fs.symlinkSync(path.join(f.root, "test-data"), path.join(linkedRoot, "test-data"));
    const linked = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", script, "--apply"], {
      cwd: linkedRoot, env: { ...process.env, DATABASE_PATH: path.join(linkedRoot, "test-data", "sentinel.db") }, input: original, encoding: "utf8",
    });
    assert.notEqual(linked.status, 0);
    assert.match(linked.stderr, /regular, unlinked file/);
  } finally { f.close(); }
});
