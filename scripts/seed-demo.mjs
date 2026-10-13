// Fills an EMPTY database with a realistic, fictional Security Department for demos and local testing:
//   DATABASE_PATH=./data/demo.db npm run seed:demo
//
// - The schema is created by the app's own code (lib/server/db.js), exactly as on first start.
// - It refuses to run when the database already has anyone but the bootstrap administrator, or any task,
//   so it can never mix fictional records into real data.
// - Every account uses the fictional domain @demo.invalid (never @corp.local, which the app purges on start).
// - Dates are relative to today (Tehran), so the demo always looks current.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const DEFAULT_ADMIN = { email: "admin@demo.invalid", password: "Demo-Admin-2026!", name: "بهنام فراهانی" };
const PASSWORD = "Demo-2026!";

// The bootstrap administrator is created by the app when the file is new; give it demo credentials unless the
// caller set their own.
process.env.ADMIN_EMAIL ||= DEFAULT_ADMIN.email;
process.env.ADMIN_PASSWORD ||= DEFAULT_ADMIN.password;
process.env.ADMIN_NAME ||= DEFAULT_ADMIN.name;
process.env.DATABASE_PATH ||= path.join(process.cwd(), "data", "sentinel.db");

const { db } = await import("@/lib/server/db");
const { hashPassword } = await import("@/lib/server/password");
const { activeChecklistFor } = await import("@/lib/server/shift-checklists");
const { activitiesForShift } = await import("@/lib/checklists");
const { tehranDate } = await import("@/lib/shifts");
const { uploadDir } = await import("@/lib/server/uploads");

// ---- Safety ------------------------------------------------------------------------------------------------

const others = db.prepare("SELECT COUNT(*) AS n FROM users WHERE id != 'admin'").get().n;
const tasks = db.prepare("SELECT COUNT(*) AS n FROM tasks").get().n;
if (others > 0 || tasks > 0) {
  console.error(`Refusing to seed ${process.env.DATABASE_PATH}: it already has ${others} member(s) besides the administrator and ${tasks} task(s).`);
  console.error("Use a new file, e.g. DATABASE_PATH=./data/demo.db npm run seed:demo");
  process.exit(1);
}
const admin = db.prepare("SELECT id, name, email FROM users WHERE id = 'admin'").get();
if (!admin) {
  console.error("The bootstrap administrator is missing; this database was not created by Sentinel Ops.");
  process.exit(1);
}

// ---- Helpers -----------------------------------------------------------------------------------------------

/** Deterministic PRNG so every seeded database looks the same for a given day. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = prng(1405);
const pick = (list) => list[Math.floor(rand() * list.length)];
const chance = (p) => rand() < p;
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

const TODAY = tehranDate();
const pad = (n) => String(n).padStart(2, "0");
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 Sunday … 5 Friday
/** Tehran local time (UTC+03:30) on a day `offset` days from today → stored UTC "YYYY-MM-DD HH:MM:SS". */
function at(offset, hour = 10, minute = 0) {
  const local = Date.parse(`${addDays(TODAY, offset)}T${pad(hour)}:${pad(minute)}:00Z`);
  const utc = new Date(local - 210 * 60e3);
  const now = Date.now();
  return new Date(Math.min(utc.getTime(), now - 60e3)).toISOString().replace("T", " ").slice(0, 19);
}
const iso = (ts) => ts.replace(" ", "T") + "Z";

// ---- People ------------------------------------------------------------------------------------------------

const COLORS = ["#5B6CF0", "#2F9E79", "#C0703A", "#8A5BD6", "#3A8FC4", "#B0506A", "#4F7A3A", "#9A7B2F"];
const PEOPLE = [
  ["ln", "لیلا نوری", "leila.nouri", "soc_manager", "SOC"],
  ["sr", "سارا رحیمی", "sara.rahimi", "analyst", "SOC · L1"],
  ["am", "آرش مرادی", "arash.moradi", "analyst", "SOC · L1"],
  ["nh", "نگار حسینی", "negar.hosseini", "analyst", "SOC · L1"],
  ["pk", "پویا کریمی", "pouya.karimi", "analyst", "SOC · L1"],
  ["ba", "بهاره احمدی", "bahareh.ahmadi", "analyst", "SOC · L2"],
  ["kr", "کاوه رضایی", "kaveh.rezaei", "analyst", "SOC · L2"],
  ["eq", "الهام قاسمی", "elham.ghasemi", "analyst", "SOC · L2"],
  ["nz", "نیما زارعی", "nima.zarei", "analyst", "SOC · L3"],
  ["sk", "شیرین کاظمی", "shirin.kazemi", "analyst", "SOC · L3"],
  ["ms", "مینا صادقی", "mina.sadeghi", "engineer", "Design & Automation"],
  ["ar", "علی رستمی", "ali.rostami", "engineer", "Design & Automation"],
  ["yt", "یاسمن طاهری", "yasaman.taheri", "analyst", "Threat Intelligence"],
  ["bs", "بابک شریفی", "babak.sharifi", "analyst", "Threat Intelligence"],
].map(([id, name, mail, role, team], i) => ({ id: `d${id}`, name, email: `${mail}@demo.invalid`, role, team, color: COLORS[i % COLORS.length] }));
const byId = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));
const SOC_L = PEOPLE.filter((p) => p.team.startsWith("SOC ·"));
const MANAGER = byId.dln;

// ---- Accounts ------------------------------------------------------------------------------------------------

db.exec("BEGIN IMMEDIATE");
const insertUser = db.prepare("INSERT INTO users (id, name, email, password_hash, role, team, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
const hash = hashPassword(PASSWORD);
for (const p of PEOPLE) insertUser.run(p.id, p.name, p.email, hash, p.role, p.team, p.color, at(-150, 9));

// ---- Tasks -------------------------------------------------------------------------------------------------

// [title, description, complexity, priority] per team. Titles are typed the way the team writes them.
const TEMPLATES = {
  SOC: [
    ["بررسی هشدار نفوذ روی سرور ایمیل", "هشدار IDS روی mail-gw-02 از ساعت ۰۳:۱۰ فعال است. لاگ‌های Splunk و ترافیک خروجی بررسی شود.", 2, "high"],
    ["تحلیل لاگ فایروال شعبه مرکزی", "ترافیک مسدودشده هفته گذشته را دسته‌بندی کنید و موارد تکراری را گزارش دهید.", 2, "normal"],
    ["به‌روزرسانی Use Case شناسایی Brute-force", "آستانه هشدار روی VPN با تعداد ورود ناموفق فعلی هم‌خوان نیست.", 3, "normal"],
    ["بررسی رخداد فیشینگ گزارش‌شده", "سه کاربر واحد مالی ایمیل مشکوک دریافت کرده‌اند؛ IOCها استخراج و در MISP ثبت شود.", 2, "high"],
    ["Tune Splunk correlation rule for anomalous VPN logins", "Current rule fires on every login from a new ASN. Reduce noise without losing true positives.", 3, "high"],
    ["تحلیل ترافیک مشکوک DNS", "درخواست‌های DNS با طول غیرعادی از 10.20.4.0/24 دیده شده است.", 3, "critical"],
    ["بررسی دسترسی غیرعادی VPN", "ورود از دو کشور در فاصله ۲۰ دقیقه برای یک حساب.", 2, "high"],
    ["مستندسازی رخداد بدافزار ایستگاه کاری", "گزارش کامل رخداد WS-114 با خط زمانی و اقدام‌های انجام‌شده.", 2, "normal"],
    ["بازبینی هشدارهای مثبت کاذب IDS", "فهرست امضاهای پرتکرار با نرخ مثبت کاذب بالا تهیه شود.", 1, "low"],
    ["تحلیل Beaconing از شبکه داخلی", "ارتباط دوره‌ای هر ۶۰ ثانیه از 10.20.7.31 به یک دامنه تازه ثبت‌شده.", 4, "critical"],
    ["بررسی تلاش ورود ناموفق به AD", "افزایش ورود ناموفق روی حساب‌های سرویس در شب گذشته.", 2, "normal"],
    ["تکمیل گزارش رخداد هفتگی", "جمع‌بندی رخدادهای هفته برای جلسه شنبه.", 1, "normal"],
    ["Review EDR exclusions on finance endpoints", "Several exclusions were added during the migration; confirm each still has an owner.", 2, "normal"],
    ["پیگیری آسیب‌پذیری Log4j در سرورهای قدیمی", "سه سرور legacy هنوز نسخه آسیب‌پذیر دارند.", 3, "high"],
  ],
  "Design & Automation": [
    ["اتوماسیون گزارش ترافیک روزانه", "خروجی Grafana هر روز ساعت ۸ به‌صورت خودکار ساخته و در بله ارسال شود.", 3, "normal"],
    ["توسعه اسکریپت جمع‌آوری IOC", "جمع‌آوری IOC از فیدهای داخلی و حذف موارد تکراری پیش از ثبت در MISP.", 3, "high"],
    ["یکپارچه‌سازی MISP با SIEM", "رویدادهای جدید MISP هر ۱۵ دقیقه به Splunk منتقل شوند.", 4, "high"],
    ["طراحی داشبورد پایش در Grafana", "داشبورد یکپارچه وضعیت سنسورها و اسکنرها.", 2, "normal"],
    ["Build internal blocklist API", "A small authenticated API so the website team can pull the malicious IP list.", 3, "normal"],
    ["مهاجرت Cron Jobها به Scheduler مرکزی", "هفت job روی سرور قدیمی باید منتقل شوند.", 2, "low"],
    ["افزودن تست به ماژول پارسر لاگ", "پوشش تست برای فرمت‌های جدید Fortigate.", 2, "normal"],
    ["توسعه ربات اعلان در بله", "اعلان هشدارهای بحرانی در گروه SOC.", 2, "normal"],
  ],
  "Threat Intelligence": [
    ["گزارش تهدید گروه APT34", "جمع‌بندی TTPهای جدید و ارتباط با بخش انرژی.", 4, "high"],
    ["تحلیل کمپین باج‌افزار جدید", "نمونه‌های دریافتی از CERT تحلیل و IOCها استخراج شود.", 3, "critical"],
    ["پایش فروم‌های زیرزمینی", "جست‌وجوی نام سازمان و دامنه‌ها در فروم‌های شناخته‌شده.", 2, "normal"],
    ["استخراج IOC از گزارش CERT", "۴۲ شاخص جدید در گزارش هفته جاری.", 1, "normal"],
    ["Update MITRE ATT&CK coverage matrix", "Map the new detection rules to techniques and highlight gaps.", 3, "normal"],
    ["تهیه بولتن تهدید ماهانه", "بولتن ماه جاری برای مدیران واحد.", 2, "normal"],
  ],
};
const teamKey = (team) => (team.startsWith("SOC") ? "SOC" : team);
const QUALITIES = ["excellent", "good", "good", "acceptable", "excellent", "needs"];
const QUAL_EN = { excellent: "Excellent", good: "Good", acceptable: "Acceptable", needs: "Needs Improvement" };
const STATUS_EN = { backlog: "Backlog", todo: "To Do", progress: "In Progress", review: "Review", done: "Done", blocked: "Blocked", returned: "Returned", cancelled: "Cancelled" };

// How many tasks of each status, and how far back they were created.
const PLAN = [
  ...Array(34).fill("done"),
  ...Array(11).fill("progress"),
  ...Array(9).fill("todo"),
  ...Array(4).fill("backlog"),
  ...Array(7).fill("review"),
  ...Array(3).fill("blocked"),
  ...Array(3).fill("returned"),
  ...Array(2).fill("cancelled"),
];
const assignees = PEOPLE.filter((p) => p.role !== "soc_manager");
// Sara (the demo analyst) always has a full queue.
const sara = byId.dsr;

const insertTask = db.prepare(`INSERT INTO tasks (id, title, description, assignee, team, status, prio, cx, due, hours, quality, created_by, updated_at, started_at, completed_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertTransition = db.prepare("INSERT INTO task_transitions (task_id, from_status, to_status, user_id, at) VALUES (?, ?, ?, ?, ?)");
const insertEvent = db.prepare("INSERT INTO task_events (task_id, user_id, text, created_at) VALUES (?, ?, ?, ?)");
const insertComment = db.prepare("INSERT INTO comments (task_id, user_id, body, created_at) VALUES (?, ?, ?, ?)");
const insertChecklist = db.prepare("INSERT INTO checklist_items (task_id, label, done, position) VALUES (?, ?, ?, ?)");

const COMMENTS = [
  (a, m) => [m, `@${a.name} لطفاً خلاصه یافته‌ها را تا پایان شیفت اینجا بنویس.`],
  (a) => [a, "لاگ‌های ۳۰ روز اخیر استخراج شد؛ مورد مشکوک جدیدی پیدا نشد."],
  (a, m) => [a, `@${m.name} برای ادامه به دسترسی read-only روی سرور نیاز دارم.`],
  (a) => [a, "IOCها در MISP ثبت شد (event 5534) و در گروه بله اشتراک‌گذاری شد."],
  (a, m) => [m, "Please coordinate with the network team before changing the rule threshold."],
  (a) => [a, "Draft is ready for review. Testing notes are in the checklist."],
];
const CHECKLISTS = [
  ["استخراج لاگ‌های مرتبط از Splunk", "بررسی ترافیک خروجی", "ثبت IOCها در MISP", "تهیه گزارش نهایی"],
  ["Pull 30 days of VPN auth logs", "Validate against last month's true positives", "Update the rule in staging", "Document the change"],
  ["جمع‌آوری نمونه‌ها", "تحلیل ایستا", "تحلیل پویا در sandbox"],
];

let seq = 1000;
const taskIds = { sara: [] };
const counters = { comments: 0, checklist: 0 };
PLAN.forEach((status, i) => {
  // About a third of the work belongs to Sara; the rest is spread across the department.
  const a = i % 3 === 0 && status !== "cancelled" ? sara : pick(assignees);
  const team = teamKey(a.team);
  const [title, description, cx, prio] = TEMPLATES[team][i % TEMPLATES[team].length];
  const creator = a.team.startsWith("SOC") ? MANAGER : chance(0.25) ? a : { id: admin.id, name: admin.name };
  const reviewer = a.team.startsWith("SOC") ? MANAGER : { id: admin.id, name: admin.name };
  const id = `T-${++seq}`;

  // Timeline (days relative to today). Completed work spreads over ~4 months so trends have history.
  const age = status === "done" ? between(2, 120) : status === "backlog" || status === "todo" ? between(0, 14) : between(2, 25);
  const created = -age;
  const started = status === "todo" || status === "backlog" ? null : Math.min(0, created + between(0, 2));
  const reviewAt = ["review", "done", "returned"].includes(status) ? Math.min(0, started + between(1, Math.max(1, age - 2))) : null;
  const doneAt = status === "done" ? Math.min(0, reviewAt + between(0, 2)) : null;
  const dueOffset = chance(0.85) ? created + between(3, 21) : null;
  const due = dueOffset === null ? "—" : addDays(TODAY, dueOffset);
  const hours = status === "done" ? Math.round((cx * 2 + rand() * 6) * 2) / 2 : status === "todo" || status === "backlog" ? 0 : Math.round(rand() * 6 * 2) / 2;
  const quality = status === "done" ? pick(QUALITIES) : null;
  const returnedOnce = status === "done" && chance(0.18);

  const tCreated = at(created, between(8, 11), between(0, 59));
  const transitions = [[null, "todo", creator.id, tCreated]];
  const events = [[creator.id, "created the task", tCreated]];
  if (status === "backlog") {
    const ts = at(created, 12, 10);
    transitions.push(["todo", "backlog", MANAGER.id, ts]);
    events.push([MANAGER.id, "moved it to Backlog", ts]);
  }
  if (started !== null) {
    const ts = at(started, 9, between(5, 55));
    transitions.push(["todo", "progress", a.id, ts]);
    events.push([a.id, "started the task", ts]);
  }
  if (status === "blocked") {
    const ts = at(Math.min(0, started + 1), 14, 20);
    transitions.push(["progress", "blocked", a.id, ts]);
    events.push([a.id, "marked it blocked", ts]);
  }
  if (status === "cancelled") {
    const ts = at(Math.min(0, created + 2), 16, 0);
    transitions.push([started === null ? "todo" : "progress", "cancelled", MANAGER.id, ts]);
    events.push([MANAGER.id, "cancelled the task", ts]);
  }
  if (reviewAt !== null) {
    if (returnedOnce || status === "returned") {
      const ts1 = at(reviewAt, 11, 30);
      const ts2 = at(reviewAt, 15, 10);
      transitions.push(["progress", "review", a.id, ts1], ["review", "returned", reviewer.id, ts2]);
      events.push([a.id, "submitted it for review", ts1], [reviewer.id, "returned it for changes", ts2]);
      if (status === "done") {
        const ts3 = at(Math.min(0, reviewAt + 1), 9, 40);
        const ts4 = at(Math.min(0, reviewAt + 1), 13, 5);
        transitions.push(["returned", "progress", a.id, ts3], ["progress", "review", a.id, ts4]);
        events.push([a.id, "resumed work", ts3], [a.id, "submitted it for review", ts4]);
      }
    } else {
      const ts = at(reviewAt, 11, 30);
      transitions.push(["progress", "review", a.id, ts]);
      events.push([a.id, "submitted it for review", ts]);
    }
  }
  let completedTs = null;
  if (doneAt !== null) {
    completedTs = at(doneAt, 16, between(0, 50));
    transitions.push(["review", "done", reviewer.id, completedTs]);
    events.push([reviewer.id, `approved it · quality: ${QUAL_EN[quality]}`, completedTs]);
  }
  const updated = transitions.at(-1)[3];
  const startedTs = started === null ? null : transitions.find((t) => t[1] === "progress")?.[3] ?? null;
  insertTask.run(id, title, description, a.id, a.team, status, prio, cx, due, hours, quality, creator.id, updated, startedTs, completedTs, tCreated);
  for (const [from, to, by, ts] of transitions) insertTransition.run(id, from, to, by, ts);
  for (const [by, text, ts] of events) insertEvent.run(id, by, text, ts);

  // Conversation and checklists on a share of the tasks.
  if (status !== "backlog" && (chance(0.55) || a === sara)) {
    const n = between(1, 3);
    for (let c = 0; c < n; c += 1) {
      const [who, body] = COMMENTS[(i + c) % COMMENTS.length](a, a.team.startsWith("SOC") ? MANAGER : { id: admin.id, name: admin.name });
      insertComment.run(id, who.id, body, at(Math.min(0, (started ?? created) + c), 10 + c * 2, 15));
      counters.comments += 1;
    }
  }
  if (cx >= 2 && chance(0.5)) {
    const list = CHECKLISTS[i % CHECKLISTS.length];
    list.forEach((label, k) => {
      const done = status === "done" || (started !== null && k < list.length / 2);
      insertChecklist.run(id, label, done ? 1 : 0, k);
      counters.checklist += 1;
    });
  }
  if (a === sara) taskIds.sara.push(id);
});

// A couple of small text attachments, stored the way uploads are (random file names next to the database).
const insertAttachment = db.prepare("INSERT INTO attachments (task_id, user_id, name, size, mime, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
const files = [
  ["vpn_logins_sample.csv", "text/csv", "user,src_ip,asn,country,time\nsara.r,185.51.200.12,AS44244,IR,2026-10-01T09:12:00Z\n"],
  ["malicious_ips.txt", "text/plain", "185.220.101.4\n45.137.21.9\n91.92.109.43\n"],
];
files.forEach(([name, mime, content], k) => {
  const taskId = taskIds.sara[k];
  if (!taskId) return;
  const stored = randomBytes(16).toString("hex");
  fs.writeFileSync(path.join(uploadDir(), stored), content);
  insertAttachment.run(taskId, sara.id, name, Buffer.byteLength(content), mime, stored, at(-1, 11, 0));
  insertEvent.run(taskId, sara.id, `attached ${name}`, at(-1, 11, 0));
});

// ---- Shift schedules and shift logs ------------------------------------------------------------------------

const insertSchedule = db.prepare("INSERT INTO shift_schedules (user_id, date, shift_type, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
const insertLog = db.prepare(`INSERT INTO shift_logs (user_id, date, data, completed_at, updated_at, shift_type, checklist_id, checklist_version, checklist_name, team)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertTicket = db.prepare("INSERT INTO tickets (user_id, date, number, ref, description, created_at) VALUES (?, ?, ?, ?, ?, ?)");
const ROTA = ["morning", "morning", "evening", "night", "morning", "evening", "night"];
const ISSUES = [
  ["Sensor S-04 stopped reporting at 06:40", "سنسور شعبه شمال از ساعت ۶:۴۰ گزارشی ارسال نکرده است.", "TKT-SENS-0412"],
  ["صفحه ورود وب‌سایت مرکز امنیت خطای 502 داد", "بین ۱۴:۱۰ تا ۱۴:۲۵ در دسترس نبود.", ""],
  ["Grafana panel for the main website shows no data", "", "GRF-221"],
];
const TICKET_TEXT = ["Repeated failed admin logins on vpn-gw", "ایمیل فیشینگ با پیوست ماکرودار", "Port scan from 45.137.21.9 blocked by WAF", "دسترسی مشکوک به share مالی", "Malware alert on WS-114 quarantined"];
let ticketSeq = 4400;
const counts = { schedules: 0, logs: 0, tickets: 0, missed: 0 };

SOC_L.forEach((p, idx) => {
  for (let d = -35; d <= 21; d += 1) {
    const date = addDays(TODAY, d);
    // Everyone gets about five shifts a week; Fridays are lighter.
    if ((d + idx) % 7 === 6 || (weekday(date) === 5 && idx % 2)) continue;
    // Sara works the extended (Until 20:00) shift today, so every standard item appears in her log.
    const type = p.id === "dsr" && d === 0 ? "evening" : ROTA[(d + idx * 3 + 70) % 7];
    insertSchedule.run(p.id, date, type, MANAGER.id, MANAGER.id, at(-40, 9, 0), at(-40, 9, 0));
    counts.schedules += 1;
    if (d > 0) continue;

    const checklist = activeChecklistFor(p.team);
    const activities = activitiesForShift(checklist.items, type);
    const today = d === 0;
    // Today: some have started, one finished, Sara is half-way. Past days: mostly complete, a few gaps.
    const missed = !today && d > -12 && (idx * 7 + d) % 17 === 0;
    if (missed) { counts.missed += 1; continue; }
    const share = today ? (p.id === "dsr" ? 0.5 : idx % 3 === 0 ? 1 : idx % 3 === 1 ? 0.3 : 0) : chance(0.85) ? 1 : 0.6 + rand() * 0.3;
    const doneCount = Math.round(activities.length * share);
    const doneTs = (k) => new Date(Date.parse(iso(at(d, type === "night" ? 21 : 8, 0))) + (k + 1) * 50 * 60e3).toISOString();
    activities.forEach((act, k) => {
      if (k >= doneCount) return;
      act.done = true;
      act.doneAt = doneTs(k);
      if (act.kind === "misp") { act.iocs = between(2, 14); act.bale = chance(0.9); act.mispRef = String(5400 + between(1, 300)); }
    });
    // An issue on a monitoring item roughly once a week per person.
    const monitor = activities.find((x) => x.kind === "monitor" && x.done);
    if (monitor && chance(0.14)) {
      const [summary, description, ref] = pick(ISSUES);
      monitor.issue = { summary, description, ref };
    }
    const complete = !today ? share === 1 || chance(0.4) : share === 1;
    const completedAt = complete && doneCount === activities.length ? doneTs(activities.length) : null;
    const updated = activities.some((x) => x.done) ? at(d, type === "night" ? 23 : 14, 30) : at(d, 8, 0);
    insertLog.run(p.id, date, JSON.stringify(activities), completedAt, updated, type, checklist.id, checklist.version, checklist.name, p.team);
    counts.logs += 1;
    const tickets = today && share === 0 ? 0 : between(0, 3);
    for (let k = 0; k < tickets; k += 1) {
      insertTicket.run(p.id, date, `INC-2026-${++ticketSeq}`, chance(0.5) ? `Splunk NE #${88000 + between(1, 999)}` : "", pick(TICKET_TEXT), at(d, 11 + k, 20));
      counts.tickets += 1;
    }
  }
});

// ---- Shift change requests -----------------------------------------------------------------------------------

const scheduleOf = (userId, date) => db.prepare("SELECT shift_type FROM shift_schedules WHERE user_id = ? AND date = ?").get(userId, date)?.shift_type;
const insertChange = db.prepare(`INSERT INTO shift_change_requests (requester_id, target_id, date, target_date, requester_shift, target_shift, reason, status,
  target_approved_at, target_approved_by, manager_approved_at, manager_approved_by, resolved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const requests = [
  // Arash asks Sara to swap: waiting for Sara.
  ["dam", "dsr", 3, 5, "مراسم خانوادگی", "pending_target"],
  // Negar and Pouya agreed; waiting for a manager.
  ["dnh", "dpk", 4, 6, "Medical appointment", "pending_manager"],
  ["dba", "dkr", 8, 9, "مأموریت اداری", "pending_target"],
];
let changeCount = 0;
/** First pair of future shifts the API would accept as a swap: each person is free on the other's day. */
function swapPair(from, to, d1, d2) {
  for (let a = d1; a <= 21; a += 1) {
    for (let b = d2; b <= 21; b += 1) {
      const date = addDays(TODAY, a), targetDate = addDays(TODAY, b);
      const mine = scheduleOf(from, date), theirs = scheduleOf(to, targetDate);
      if (!mine || !theirs) continue;
      if (date !== targetDate && (scheduleOf(from, targetDate) || scheduleOf(to, date))) continue;
      return { mine: { date, type: mine }, theirs: { date: targetDate, type: theirs } };
    }
  }
  return null;
}
for (const [from, to, d1, d2, reason, status] of requests) {
  const pair = swapPair(from, to, d1, d2);
  if (!pair) continue;
  const accepted = status === "pending_manager";
  insertChange.run(from, to, pair.mine.date, pair.theirs.date, pair.mine.type, pair.theirs.type, reason, status,
    accepted ? at(-1, 10) : null, accepted ? to : null, null, null, null, at(-1, 9, 30));
  changeCount += 1;
}
// A resolved one in the past for history.
insertChange.run("dnz", "dsk", addDays(TODAY, -6), addDays(TODAY, -6), "morning", "night", "تعویض شیفت شب", "rejected", null, null, null, null, at(-8, 12), at(-9, 10));
changeCount += 1;

const broken = db.prepare("PRAGMA foreign_key_check").all();
if (broken.length) {
  db.exec("ROLLBACK");
  console.error("Seed produced inconsistent references; nothing was written.", broken.slice(0, 5));
  process.exit(1);
}

// Optional extras (newer schema): notifications and other per-user data, when the tables exist.
const hasTable = (name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
let notificationCount = 0;
if (hasTable("notifications")) {
  const { seedDemoNotifications } = await import("./seed-demo-extras.mjs");
  notificationCount = seedDemoNotifications(db, { at, people: PEOPLE, admin, manager: MANAGER, sara });
}
db.exec("COMMIT");

// ---- Summary -----------------------------------------------------------------------------------------------

const shown = (file) => { const rel = path.relative(process.cwd(), file); return rel && !rel.startsWith("..") ? `./${rel}` : file; };
const line = (label, value) => console.log(`  ${label.padEnd(22)} ${value}`);
console.log(`\nSentinel Ops demo department seeded into ${process.env.DATABASE_PATH}\n`);
line("People", `${PEOPLE.length + 1} (incl. the administrator)`);
line("Tasks", `${PLAN.length} in every status · ${counters.comments} comments · ${counters.checklist} checklist items`);
line("Shift schedules", `${counts.schedules} (${SOC_L.length} SOC analysts, 5 weeks back and 3 weeks ahead)`);
line("Shift logs", `${counts.logs} · ${counts.missed} missed on purpose · ${counts.tickets} tickets`);
line("Swap requests", `${changeCount}`);
if (notificationCount) line("Notifications", `${notificationCount}`);
console.log("\nSign in (every password is shown here; the domain is fictional):\n");
line("Security Manager", `${admin.email}  /  ${process.env.ADMIN_PASSWORD === DEFAULT_ADMIN.password ? DEFAULT_ADMIN.password : "(the ADMIN_PASSWORD you set)"}`);
line("SOC Manager", `${MANAGER.email}  /  ${PASSWORD}`);
line("Analyst (SOC · L1)", `${sara.email}  /  ${PASSWORD}`);
line("Engineer", `${byId.dms.email}  /  ${PASSWORD}`);
line("Threat Intelligence", `${byId.dyt.email}  /  ${PASSWORD}`);
console.log(`\nEvery other demo member also uses ${PASSWORD}. Start the app with the same DATABASE_PATH, e.g.\n  DATABASE_PATH=${shown(process.env.DATABASE_PATH)} npm start\n`);
