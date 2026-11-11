// Build an isolated, fictional database and report. This script never opens DATABASE_PATH
// from the calling environment and never overwrites an existing database.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const parent = path.join(process.cwd(), "test-data");
fs.mkdirSync(parent, { recursive: true });
const directory = fs.mkdtempSync(path.join(parent, "monthly-demo-"));
const dbPath = path.join(directory, "sentinel.db");
const email = "demo.manager@local.invalid", password = "Demo-Only-2026!";
process.env.DATABASE_PATH = dbPath;
process.env.ADMIN_NAME = "مدیر نمونه";
process.env.ADMIN_EMAIL = email;
process.env.ADMIN_PASSWORD = password;

const repo = await import("@/lib/server/repo");
const { db } = await import("@/lib/server/db");
const { hashPassword } = await import("@/lib/server/password");
const { saveAnalyzedTicket } = await import("@/lib/server/l2-analyzed-tickets");
const { addDays, jMonthStart, jalaliMonthBounds, jalaliMonthKey } = await import("@/lib/analytics/calendar");
const { buildMonthlyReport, createMonthlyWorkbook, renderMonthlyHtml } = await import("@/lib/server/monthly-report");

const admin = repo.listUsers().find((u) => u.role === "security_manager");
db.prepare("INSERT INTO meta (key, value) VALUES ('monthly_report_demo', '1')").run();
const memberPassword = hashPassword(password);
const month = jalaliMonthKey(addDays(jMonthStart(repo.today()), -1));
const from = jalaliMonthBounds(month).from;
const teams = [
  { name:"آرش نمونه", email:"arash@local.invalid", role:"engineer", team:"Design & Automation", province:"قم", hours:[10,10,10,10,10,10,10,10,10,10], titles:["خودکارسازی بررسی هشدارهای ورود", "رفع خطای جمع‌آوری لاگ", "ساخت گردش‌کار بررسی IOC", "بهبود گزارش پایان شیفت", "پایش سلامت سرویس‌ها", "تکمیل مستندات پیکربندی", "بازبینی دسترسی سرویس‌ها", "بهبود اسکریپت پشتیبان‌گیری", "آزمون ارسال تیکت", "اصلاح پردازش رویدادها"] },
  { name:"نگار نمونه", email:"negar@local.invalid", role:"engineer", team:"Design & Automation", province:"تهران", hours:[8,6,12,4,7], titles:["بهبود پایش سرویس", "ساخت داشبورد رخدادها", "اصلاح گردش‌کار اعلان", "آزمون اتصال سامانه", "مستندسازی سناریوها"] },
  { name:"ندا نمونه", email:"neda@local.invalid", role:"analyst", team:"SOC · L2", province:"تهران", hours:[4,7,6,5], titles:["بررسی هشدار ورود ناموفق", "تحلیل رفتار مشکوک شبکه", "بازبینی تیکت‌های ارجاعی", "مستندسازی نتیجه بررسی"] },
  { name:"علی نمونه", email:"ali@local.invalid", role:"analyst", team:"SOC · L1", province:"قم", hours:[3,5,4,6], titles:["بررسی صف رخدادها", "پایش دسترس‌پذیری سرویس‌ها", "ثبت شاخص‌های تهدید", "تهیه گزارش ترافیک"] },
  { name:"هانیه نمونه", email:"hanieh@local.invalid", role:"analyst", team:"SOC · L3", province:"تهران", hours:[8,5,9,6], titles:["بازبینی تنظیمات SIEM", "رفع اشکال جمع‌آوری لاگ", "بهینه‌سازی قانون تشخیص", "آزمون سناریوی امنیتی"] },
  { name:"سارا نمونه", email:"sara@local.invalid", role:"analyst", team:"Threat Intelligence", province:"اصفهان", hours:[6,5,7,4], titles:["جمع‌آوری شاخص‌های تهدید", "اعتبارسنجی دامنه‌های مشکوک", "تهیه گزارش اطلاعات تهدید", "به‌روزرسانی منابع اطلاعاتی"] },
  { name:"رضا نمونه", email:"reza@local.invalid", role:"analyst", team:"Threat Intelligence", province:"فارس", hours:[4,6,5], titles:["بررسی اعتبار IPهای مشکوک", "تکمیل اطلاعات رخداد", "دسته‌بندی شاخص‌های جدید"] },
  { name:"سامان نمونه", email:"saman@local.invalid", role:"soc_manager", team:"SOC", province:"تهران", hours:[3,4], titles:["بازبینی گزارش ماهانه تیم", "بررسی صف تسک‌های باز"] },
];

const people = teams.map((p) => ({ ...p, member: repo.createMember({ name:p.name, email:p.email, role:p.role, team:p.team, province:p.province, passwordHash:memberPassword }) }));
for (const [personIndex,p] of people.entries()) {
  for (const [i,title] of p.titles.entries()) {
    const date = addDays(from, (i * 2 + personIndex) % 26);
    const task = repo.createTask({ title, description:"این فعالیت و همه اطلاعات آن صرفاً برای آزمایش گزارش ساخته شده است.", a:p.member.id, prio:i % 3 === 0 ? "high" : "normal", cx:(i % 3) + 1, due:date }, admin.id);
    repo.updateTask(task.id, { status:"progress" }, p.member.id);
    repo.updateTask(task.id, { status:"done", hours:p.hours[i], quality:i % 4 === 0 ? "excellent" : "good" }, admin.id);
    db.prepare("UPDATE tasks SET created_at=?, started_at=?, completed_at=?, updated_at=? WHERE id=?")
      .run(`${date} 05:00:00`,`${date} 06:00:00`,`${date} 14:00:00`,`${date} 14:00:00`,task.id);
    db.prepare("UPDATE task_transitions SET at=? WHERE task_id=?").run(`${date} 14:00:00`,task.id);
    db.prepare("INSERT INTO task_work_reports (task_id,work_performed,outcome,hours_recorded,updated_by) VALUES (?,?,?,1,?)")
      .run(task.id,`بررسی و اجرای فعالیت «${title}» انجام و نتیجه آزمایش ثبت شد.`,"فعالیت نمونه تکمیل و مستندسازی شد.",p.member.id);
  }
}

function addShift(person, dayOffset, type, { completed = true, ticketVerdicts = [] } = {}) {
  const date = addDays(from, dayOffset);
  repo.setShiftSchedule(person.member.id, date, type, admin.id);
  const log = repo.getShiftLog(person.member.id, date);
  const activities = log.activities.map((a) => ({ ...a, done:completed, ...(a.kind === "misp" ? { iocs:3 } : {}) }));
  db.prepare("UPDATE shift_logs SET data=? WHERE user_id=? AND date=?").run(JSON.stringify(activities),person.member.id,date);
  for (const [i,verdict] of ticketVerdicts.entries()) saveAnalyzedTicket(person.member.id,date,{ ticketNumber:`DEMO-${String(i+1).padStart(3,"0")}`, verdict });
  if (completed) repo.setShiftCompleted(person.member.id,true,date);
}
const [automation, secondAutomation, l2, l1, l3] = people;
for (let i = 0; i < 6; i++) addShift(automation, i * 2, "night"); // 6 × 12 = 72 hours
addShift(automation, 13, "morning"); // Engineering time is separate from SOC time.
addShift(secondAutomation, 2, "night"); addShift(secondAutomation, 5, "evening"); addShift(secondAutomation, 9, "morning");
addShift(l2, 1, "morning", { ticketVerdicts:["false_positive","false_positive","false_positive","true_positive","true_positive","true_positive","true_positive","true_positive","true_positive","true_positive"] });
addShift(l2, 4, "evening"); addShift(l2, 8, "night");
addShift(l1, 0, "morning"); addShift(l1, 3, "evening"); addShift(l1, 7, "night", { completed:false });
addShift(l3, 2, "morning"); addShift(l3, 6, "night");

const report = buildMonthlyReport(admin, { month });
const example = report.people.find((p) => p.id === automation.member.id);
assert.deepEqual([example.stats.completedSocShifts,example.stats.completedSocShiftHours,example.stats.completed,example.stats.hours], [6,72,10,100]);
const l2Report = report.people.find((p) => p.id === l2.member.id);
assert.deepEqual([l2Report.stats.analyzed,l2Report.stats.falsePositive,l2Report.stats.truePositive], [10,3,7]);
assert.equal(report.sample, true);
fs.writeFileSync(path.join(directory, "Sentinel_Demo.html"),renderMonthlyHtml(report));
fs.writeFileSync(path.join(directory, "Sentinel_Demo.xlsx"),await createMonthlyWorkbook(report));
// A checkpoint makes the single .db portable; no WAL file is needed for transfer.
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
globalThis.__sentinelDb.close();
console.log(`\nDemo files: ${directory}\nJalali month: ${month}\nDemo login: ${email}\nDemo password: ${password}\n\nStart with the isolated database:\nDATABASE_PATH='${dbPath.replaceAll("'", "'\\''")}' npm run start -- -H 0.0.0.0 -p 3113\n`);
