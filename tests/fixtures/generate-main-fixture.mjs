// Writes main-d725b91.sql: a database created and used by Sentinel Ops as released on `main` (d725b91), written
// entirely by main's own code and dumped as SQL. tests/migrations.unit.test.mjs opens it with the current code to
// prove the upgrade is additive, idempotent and keeps every row.
//
// Run it from a checkout of that commit outside this working tree, with main's module hooks:
//   git worktree add --detach "$TMP/main" d725b91 && ln -s "$PWD/node_modules" "$TMP/main/node_modules"
//   (cd "$TMP/main" && node --disable-warning=ExperimentalWarning --conditions=react-server \
//     --import ./tests/support/server-modules.mjs "$OLDPWD/tests/fixtures/generate-main-fixture.mjs" "$OLDPWD/tests/fixtures/main-d725b91.sql")
//   git worktree remove --force "$TMP/main"
//
// Every person and record is fictional (@fixture.invalid).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const out = process.argv[2];
if (!out) {
  console.error("Usage: generate-main-fixture.mjs <out.sql> (run inside a checkout of main, see the header)");
  process.exit(1);
}
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-main-fixture-"));
process.env.DATABASE_PATH = path.join(dir, "sentinel.db");
process.env.ADMIN_NAME = "بهنام فراهانی";
process.env.ADMIN_EMAIL = "admin@fixture.invalid";
process.env.ADMIN_PASSWORD = "Fixture-Admin-2026!";

const { db } = await import("@/lib/server/db");
const repo = await import("@/lib/server/repo");
const checklists = await import("@/lib/server/shift-checklists");
const { managerCompleteShiftLog, managerUpdateShiftActivity } = await import("@/lib/server/shift-log-admin");
const { hashPassword } = await import("@/lib/server/password");

const today = repo.today();
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// ---- People (Members page: createMember / deactivateMember) ------------------------------------------------

const member = (name, email, role, team) =>
  repo.createMember({ name, email, role, team, passwordHash: hashPassword("Fixture-Member-2026!") });
const admin = repo.getUser("admin");
const manager = member("لیلا نوری", "leila.nouri@fixture.invalid", "soc_manager", "SOC");
const sara = member("Sara Rahimi", "sara.rahimi@fixture.invalid", "analyst", "SOC · L1");
const amir = member("امیر کاظمی", "amir.kazemi@fixture.invalid", "analyst", "SOC · L1");
const reza = member("Reza Moradi", "reza.moradi@fixture.invalid", "analyst", "SOC · L2");
const nima = member("نیما جعفری", "nima.jafari@fixture.invalid", "engineer", "Design & Automation");
// "kf" is also one of the legacy demo ids; a real member with that id must survive every upgrade.
const former = member("Kian Farzad", "kian.farzad@fixture.invalid", "analyst", "SOC · L3");
repo.deactivateMember(former.id);

// A signed-in session, written exactly like login() in lib/server/auth.js (which needs Next.js to load).
db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
  .run(randomBytes(32).toString("hex"), sara.id, Date.now() + 7 * 864e5);

// ---- Tasks (the same calls and activity texts as app/api/tasks/[id]/route.js) ------------------------------

const move = (id, status, by, text, extra = {}) => {
  repo.updateTask(id, { status, ...extra }, by);
  repo.addEvent(id, by, text);
};

const t1 = repo.createTask({
  title: "بررسی تلاش ورود ناموفق به AD",
  description: "Repeated failed logins for svc-backup from 10.20.4.17 between 02:00 and 03:00.\nCheck whether the password expired.",
  a: sara.id, prio: "high", cx: 2, due: addDays(today, 2),
}, manager.id);
repo.addChecklistItem(t1.id, "Collect 4625 events from the domain controllers");
repo.addChecklistItem(t1.id, "Check the source host in EDR");
for (const item of repo.getTaskDetails(t1.id).checklist) repo.updateChecklistItem(item.id, { done: true });
move(t1.id, "progress", sara.id, "started the task");
repo.updateTask(t1.id, { hours: 3.5 }, sara.id);
repo.addComment(t1.id, sara.id, "Source is the backup server; its service password expired yesterday.");
repo.addComment(t1.id, manager.id, "@Sara Rahimi تیکت تغییر رمز را هم ثبت کن.");
const draft = repo.addComment(t1.id, sara.id, "duplicate note");
repo.deleteComment(Number(draft.lastInsertRowid));
repo.addAttachment({ taskId: t1.id, userId: sara.id, name: "4625-events.csv", size: 18432, mime: "text/csv", path: randomBytes(16).toString("hex") });
move(t1.id, "review", sara.id, "submitted it for review");
move(t1.id, "done", manager.id, "approved it · quality: Good", { quality: "good" });

const t2 = repo.createTask({ title: "Tune Splunk correlation rule for VPN brute force", a: reza.id, prio: "normal", cx: 3, due: addDays(today, 5) }, manager.id);
move(t2.id, "progress", reza.id, "started the task");
repo.updateTask(t2.id, { hours: 1.5 }, reza.id);
move(t2.id, "blocked", reza.id, "marked it blocked");

const t3 = repo.createTask({ title: "به‌روزرسانی فهرست IOCهای MISP", description: "IOCهای کمپین فیشینگ هفتهٔ گذشته", a: amir.id, prio: "critical", cx: 1, due: today }, manager.id);
for (const label of ["Export IOCs from the last report", "Remove expired domains", "Share the list via Bale"]) repo.addChecklistItem(t3.id, label);
repo.updateChecklistItem(repo.getTaskDetails(t3.id).checklist[0].id, { done: true });
const note = repo.addComment(t3.id, amir.id, "Started with the domains from INC-2026-4471.");
repo.editComment(Number(note.lastInsertRowid), "Started with the domains and IPs from INC-2026-4471.");

const t4 = repo.createTask({ title: "Automate weekly firewall rule review", a: nima.id, prio: "low", cx: 4, due: addDays(today, 10) }, admin.id);
move(t4.id, "progress", nima.id, "started the task");
repo.updateTask(t4.id, { prio: "normal" }, admin.id);
repo.addEvent(t4.id, admin.id, "priority Low → Normal");
repo.updateTask(t4.id, { due: addDays(today, 14) }, admin.id);
repo.addEvent(t4.id, admin.id, `deadline → ${addDays(today, 14)}`);

const t5 = repo.createTask({ title: "Duplicate: phishing report from finance", a: amir.id, prio: "normal", cx: 1, due: "" }, manager.id);
move(t5.id, "cancelled", manager.id, "cancelled the task");

const t6 = repo.createTask({ title: "Document the escalation path for ransomware alerts", a: reza.id, prio: "high", cx: 3, due: addDays(today, 1) }, manager.id);
move(t6.id, "progress", reza.id, "started the task");
move(t6.id, "review", reza.id, "submitted it for review");
move(t6.id, "returned", manager.id, "returned it for changes");
repo.addComment(t6.id, manager.id, "Add the on-call numbers for L3.");

// ---- Shift Log checklists (a second checklist for L2, saved twice) ------------------------------------------

const l2 = checklists.createChecklist({
  name: "L2 investigation routine",
  description: "Escalations and rule review for SOC · L2.",
  items: [
    { title: "Review escalated incidents", kind: "basic" },
    { title: "Investigate unresolved alerts", kind: "monitor", hint: "Escalate to L3 when blocked" },
    { title: "Complete technical shift handover", kind: "basic" },
  ],
}, manager.id);
checklists.saveChecklist(l2.id, {
  name: l2.name, description: l2.description, version: l2.version,
  items: [...l2.items, { title: "Review detection and correlation rules", kind: "basic", shiftTypes: ["morning", "evening"] }],
}, manager.id);
checklists.setAssignment("SOC · L2", { checklistId: l2.id }, manager.id);

// ---- Shift schedule, Shift Logs and tickets ------------------------------------------------------------------

const yesterday = addDays(today, -1);
repo.setShiftSchedule(sara.id, yesterday, "morning", manager.id);
for (const act of repo.getShiftLog(sara.id, yesterday).activities) {
  managerUpdateShiftActivity(sara.id, yesterday, act.n, { done: true }, act.itemId, manager.id);
}
managerCompleteShiftLog(sara.id, yesterday);

repo.setShiftSchedule(sara.id, today, "evening", manager.id);
for (const act of repo.getShiftLog(sara.id).activities.slice(0, 4)) repo.updateActivity(sara.id, act.n, { done: true }, act.itemId);
const misp = repo.getShiftLog(sara.id).activities.find((a) => a.kind === "misp");
repo.updateActivity(sara.id, misp.n, { done: true, iocs: 12, bale: true, mispRef: "MISP-EVT-3391" }, misp.itemId);
const grafana = repo.getShiftLog(sara.id).activities.find((a) => a.kind === "monitor" && !a.done);
repo.updateActivity(sara.id, grafana.n, { issue: { summary: "پنل Grafana پورتال از دسترس خارج است", description: "", ref: "INC-2026-4471" } }, grafana.itemId);
repo.addTicket(sara.id, { no: "INC-2026-4471", ref: "SIEM-88213", desc: "گزارش فیشینگ از واحد مالی" });
repo.addTicket(sara.id, { no: "INC-2026-4472", ref: "", desc: "Blocked IP 185.220.101.4 at the edge firewall" });

repo.setShiftSchedule(amir.id, today, "morning", manager.id);
const first = repo.getShiftLog(amir.id).activities[0];
repo.updateActivity(amir.id, first.n, { done: true, note: "No new incidents overnight." }, first.itemId);

repo.setShiftSchedule(reza.id, today, "night", manager.id);
const l2First = repo.getShiftLog(reza.id).activities[0];
repo.updateActivity(reza.id, l2First.n, { done: true }, l2First.itemId);

// ---- Shift changes: one waiting for the manager, one approved (same-day swap), one rejected -----------------

const [d2, d3, d5, d6] = [2, 3, 5, 6].map((n) => addDays(today, n));
repo.setShiftSchedule(sara.id, d2, "morning", manager.id);
repo.setShiftSchedule(amir.id, d3, "evening", manager.id);
const waiting = repo.createShiftChangeRequest(sara.id, amir.id, d2, d3, "Family appointment that morning");
repo.actOnShiftChange(waiting.id, repo.getUser(amir.id), "accept");

repo.setShiftSchedule(sara.id, d5, "morning", manager.id);
repo.setShiftSchedule(amir.id, d5, "night", manager.id);
const swap = repo.createShiftChangeRequest(amir.id, sara.id, d5, d5, "کلاس دانشگاه دارم");
repo.actOnShiftChange(swap.id, repo.getUser(sara.id), "accept");
repo.actOnShiftChange(swap.id, repo.getUser(manager.id), "approve");

repo.setShiftSchedule(reza.id, d6, "morning", manager.id);
repo.setShiftSchedule(amir.id, d6, "evening", manager.id);
const refused = repo.createShiftChangeRequest(reza.id, amir.id, d6, d6, "");
repo.actOnShiftChange(refused.id, repo.getUser(amir.id), "reject");

// ---- Dump (like `sqlite3 .dump`: schema in creation order, rows as SQL literals from quote()) ----------------

globalThis.__sentinelDb.close();
const src = new DatabaseSync(process.env.DATABASE_PATH, { readOnly: true });
const objects = src.prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY rowid").all();
const lines = [
  `-- Sentinel Ops database created and used by main @ ${commit} (lib/server/db.js and the repo functions of that`,
  `-- commit), generated by tests/fixtures/generate-main-fixture.mjs on ${today}. Fictional data. Do not edit by hand.`,
  "PRAGMA foreign_keys=OFF;",
  "BEGIN TRANSACTION;",
];
for (const { name, sql } of objects.filter((o) => o.type === "table" && !o.name.startsWith("sqlite_"))) {
  lines.push(`${sql};`);
  const cols = src.prepare(`PRAGMA table_info("${name}")`).all().map((c) => c.name);
  const select = `SELECT ${cols.map((c, i) => `quote("${c}") AS c${i}`).join(", ")} FROM "${name}" ORDER BY rowid`;
  for (const row of src.prepare(select).all()) lines.push(`INSERT INTO "${name}" VALUES(${cols.map((_, i) => row[`c${i}`]).join(",")});`);
}
lines.push("DELETE FROM sqlite_sequence;");
for (const s of src.prepare("SELECT name, seq FROM sqlite_sequence ORDER BY name").all()) lines.push(`INSERT INTO sqlite_sequence VALUES('${s.name}',${s.seq});`);
for (const { sql } of objects.filter((o) => o.type !== "table")) lines.push(`${sql};`);
lines.push("COMMIT;", "");
src.close();
fs.writeFileSync(out, lines.join("\n"));
fs.rmSync(dir, { recursive: true, force: true });
console.error(`Wrote ${out} from main @ ${commit}.`);
