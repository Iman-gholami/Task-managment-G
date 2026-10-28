const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, randomUUID, scryptSync, timingSafeEqual } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

if (process.argv.length !== 3 || process.argv[2] !== "--apply") {
  throw new Error("Use --apply and provide the preview password on standard input.");
}
const password = fs.readFileSync(0, "utf8");
const target = path.resolve(process.cwd(), "test-data/sentinel.db");
if (path.resolve(process.env.DATABASE_PATH || "") !== target || !fs.existsSync(target)) {
  throw new Error("The preview database was not found at test-data/sentinel.db.");
}
const file = fs.lstatSync(target);
if (!file.isFile() || file.nlink !== 1 || fs.realpathSync(target) !== target) {
  throw new Error("The preview database must be a regular, unlinked file.");
}
if (password.length < 8) throw new Error("The password must be at least 8 characters.");

const db = new DatabaseSync(target);
let transaction = false;
try {
  db.exec("PRAGMA busy_timeout = 5000");
  const lookup = db.prepare("SELECT id, role, active, password_hash FROM users WHERE email = ?");
  let user = lookup.get("admin@local");
  if (user && (user.role !== "security_manager" || user.active !== 1)) {
    throw new Error("admin@local already exists but is not an active Security Manager; no account was changed.");
  }
  let matches = false;
  if (user) {
    const [salt, stored] = user.password_hash.split(":");
    if (/^[a-f0-9]{32}$/i.test(salt || "") && /^[a-f0-9]{128}$/i.test(stored || "")) {
      const actual = scryptSync(password, Buffer.from(salt, "hex"), 64);
      matches = timingSafeEqual(actual, Buffer.from(stored, "hex"));
    }
  }
  if (matches) {
    console.log("The preview admin account is already configured.");
  } else {
    const backup = path.join(path.dirname(target), `sentinel-before-admin-${Date.now()}-${randomBytes(3).toString("hex")}.db`);
    const previousUmask = process.umask(0o077);
    try { db.prepare("VACUUM INTO ?").run(backup); }
    finally { process.umask(previousUmask); }
    fs.chmodSync(backup, 0o600);
    const salt = randomBytes(16);
    const hash = `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
    db.exec("BEGIN IMMEDIATE");
    transaction = true;
    user = lookup.get("admin@local");
    if (user && (user.role !== "security_manager" || user.active !== 1)) {
      throw new Error("admin@local already exists but is not an active Security Manager; no account was changed.");
    }
    const id = user?.id || `preview-${randomUUID()}`;
    if (user) db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
    else db.prepare("INSERT INTO users (id, name, email, password_hash, role, team, color) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, "Preview Administrator", "admin@local", hash, "security_manager", "Security Department", "#5B6CF0");
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    db.exec("COMMIT");
    transaction = false;
    console.log(`Preview admin account ready. Database backup: ${backup}`);
  }
} catch (error) {
  if (transaction) db.exec("ROLLBACK");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
