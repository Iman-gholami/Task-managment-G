import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
process.env.ADMIN_EMAIL = "monthly-report-admin@local.invalid";
process.env.ADMIN_PASSWORD = "Monthly-Report-Test-2026!";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-monthly-report-"));
process.env.DATABASE_PATH = path.join(directory, "monthly.db");
test.after(() => { globalThis.__sentinelDb?.close(); fs.rmSync(directory, { recursive:true, force:true }); });
const repo = await import("@/lib/server/repo");
const { db } = await import("@/lib/server/db");
const { hashPassword } = await import("@/lib/server/password");
const { saveAnalyzedTicket } = await import("@/lib/server/l2-analyzed-tickets");
const { jalaliMonthKey } = await import("@/lib/analytics/calendar");
const { factsFor } = await import("@/lib/server/analytics");
const { canReviewMonth, stats } = await import("@/lib/analytics/metrics");
const { applyFilters, parseFilters } = await import("@/lib/analytics/filters");
const { buildMonthlyReport, createMonthlyWorkbook, renderMonthlyHtml, renderMonthlyComparisonHtml, createMonthlyBundle } = await import("@/lib/server/monthly-report");
const admin = repo.listUsers().find((u) => u.role === "security_manager");
const passwordHash = hashPassword("Monthly-Fixture-2026!");
const add = (name,role,team,email) => repo.createMember({ name,role,team,email,passwordHash });
const manager = add("SOC Manager","soc_manager","SOC","soc@monthly.invalid");
const l2 = add("SOC L2 Analyst","analyst","SOC · L2","l2@monthly.invalid");
const ti = add("TI Analyst","analyst","Threat Intelligence","ti@monthly.invalid");
const observer = add("Observer","observer","Security Department","observer@monthly.invalid");
const date = repo.today(), month = jalaliMonthKey(date);
const task = repo.createTask({ title:"<script>alert('unsafe')</script>", description:"Investigated suspicious activity", a:l2.id, prio:"high", cx:2, due:date }, admin.id);
repo.updateTask(task.id, { status:"done", hours:3.5, quality:"good" }, admin.id);
db.prepare("INSERT INTO task_work_reports (task_id, work_performed, outcome, hours_recorded, updated_by) VALUES (?, ?, ?, 1, ?)").run(task.id,"Reviewed events and evidence","Confirmed false positive",l2.id);
db.prepare("INSERT INTO task_review_returns (task_id, user_id, reason) VALUES (?, ?, ?)").run(task.id,manager.id,"Please add the investigation evidence");
repo.createTask({ title:"TI private task", description:"Different team", a:ti.id, prio:"normal", cx:1, due:date }, admin.id);
repo.setShiftSchedule(l2.id,date,"morning",admin.id); repo.getShiftLog(l2.id,date);
saveAnalyzedTicket(l2.id,date,{ ticketNumber:"INC-001", verdict:"false_positive" });
saveAnalyzedTicket(l2.id,date,{ ticketNumber:"INC-002", verdict:"true_positive" });
repo.setShiftCompleted(l2.id,true,date);

test("both managers can export each department while analysts and observers are denied", () => {
  const report = buildMonthlyReport(manager,{month});
  assert.ok(report.people.some((p) => p.id === l2.id)); assert.ok(report.people.some((p) => p.id === ti.id));
  const p = report.people.find((p) => p.id === l2.id);
  assert.equal(p.tasks[0].description,"Investigated suspicious activity"); assert.equal(p.tasks[0].workPerformed,"Reviewed events and evidence");
  assert.equal(p.tasks[0].hours,3.5); assert.equal(p.tasks[0].returnReasons[0].reason,"Please add the investigation evidence");
  assert.ok(p.tasks[0].history.some((h) => h.to_status === "done"));
  assert.deepEqual([p.stats.analyzed,p.stats.falsePositive,p.stats.truePositive],[2,1,1]);
  assert.equal(buildMonthlyReport(manager,{month,person:ti.id}).people[0].tasks[0].title,"TI private task");
  assert.ok(buildMonthlyReport(manager,{month,team:"ti"}).people.every((person) => person.group === "Threat Intelligence"));
  assert.throws(() => buildMonthlyReport(manager,{month,person:"missing"}), (e) => e.status === 404);
  assert.ok(!factsFor(manager,{}).people.some((person) => person.id === ti.id));
  assert.ok(buildMonthlyReport(admin,{month,team:"ti"}).people.every((p) => p.group === "Threat Intelligence"));
  assert.ok(buildMonthlyReport(admin,{month,team:"soc",level:"L2"}).people.every((p) => p.level === "L2"));
  assert.throws(() => buildMonthlyReport(observer,{month}), (e) => e.status === 403);
  assert.throws(() => buildMonthlyReport(l2,{month}), (e) => e.status === 403);
  assert.throws(() => buildMonthlyReport(admin,{month:"1405-99"}), (e) => e.status === 400);
});
test("analytics scopes L2 verdicts and reviews L2 logs without a checklist", () => {
  const facts = factsFor(admin,{}), selected = applyFilters(facts,parseFilters({team:"soc",level:"L2",shift:"morning"}));
  const cur = stats(selected,[l2.id],{from:date,end:date});
  assert.deepEqual([cur.analyzed,cur.falsePositive,cur.truePositive,cur.fpRate],[2,1,1,0.5]);
  assert.ok(canReviewMonth({id:l2.id,level:"L2"},facts.shifts,date,date));
  assert.equal(canReviewMonth({id:l2.id,level:"L1"},facts.shifts,date,date),false);
  assert.equal(stats(applyFilters(facts,parseFilters({team:"soc",level:"L2",shift:"night"})),[l2.id],{from:date,end:date}).analyzed,0);
});
test("bundle contains a readable workbook and offline HTML, escaping user content", async () => {
  const report = buildMonthlyReport(admin,{month,person:l2.id});
  const workbook = await new ExcelJS.Workbook().xlsx.load(await createMonthlyWorkbook(report));
  const values = []; workbook.eachSheet((s) => s.eachRow((r) => r.eachCell((c) => values.push(String(c.value ?? "")))));
  const text = values.join("\n");
  for (const word of ["Reviewed events and evidence","Please add the investigation evidence","INC-001","INC-002"]) assert.ok(text.includes(word));
  const html = renderMonthlyHtml(report);
  assert.match(html,/Reviewed events and evidence/); assert.match(html,/&lt;script&gt;alert/); assert.doesNotMatch(html,/<script>alert/); assert.doesNotMatch(html,/https?:\/\//);
  assert.match(html, /نمای کلی گزارش/);
  assert.match(html, /ساعت ثبت‌شده/);
  assert.match(html, /data:font\/woff2;base64,/);
  assert.match(html, /INC-001/);
  assert.match(html, /نرخ FP/);
  assert.match(html, /<details class="task"/);
  assert.match(html, /<html lang="fa" dir="rtl">/);
  assert.match(renderMonthlyHtml(buildMonthlyReport(admin,{month,person:l2.id,locale:"en"})),/<html lang="en" dir="ltr">/);
  const comparison = renderMonthlyComparisonHtml(report);
  assert.match(comparison, /مقایسه فعالیت افراد/);
  assert.match(comparison, /ساعت شیفت برنامه‌ریزی‌شده/);
  assert.match(comparison, /ساعت تسک‌های تکمیل‌شده/);
  assert.match(comparison, /تسک‌های انجام‌شده/);
  assert.match(comparison, /class="comparison-team"/);
  assert.match(comparison, /class="chart-lanes"/);
  assert.match(comparison, /role="meter"/);
  assert.match(comparison, /class="log-ring"/);
  assert.match(comparison, /class="outcome-grid"/);
  assert.match(comparison, /@media\(max-width:730px\)/);
  assert.match(comparison, /@media print/);
  assert.match(comparison, /&lt;script&gt;alert/);
  assert.doesNotMatch(comparison, /<script>alert/);
  assert.doesNotMatch(comparison, /https?:\/\//);
  assert.match(comparison, /<html lang="fa" dir="rtl">/);
  assert.match(renderMonthlyComparisonHtml(buildMonthlyReport(admin,{month,person:l2.id,locale:"en"})),/<html lang="en" dir="ltr">/);
  assert.doesNotMatch(renderMonthlyComparisonHtml({...report,people:[],teams:[]}), /NaN|Infinity/);
  const zip = await JSZip.loadAsync(await createMonthlyBundle(report));
  assert.equal(Object.keys(zip.files).filter((n) => n.endsWith(".xlsx")).length,1);
  assert.equal(Object.keys(zip.files).filter((n) => n.endsWith(".html")).length,2);
  const comparisonName = `Sentinel_Monthly_${month}_Compare.html`, detailsName = `Sentinel_Monthly_${month}.html`;
  assert.match(await zip.file(detailsName).async("string"), new RegExp(comparisonName));
  assert.match(await zip.file(comparisonName).async("string"), new RegExp(detailsName.replace(".", "\\.")));
});

test("report section checkboxes limit Excel sheets and both HTML views", async () => {
  const completed = buildMonthlyReport(admin, { month, person: l2.id, sections: "completed" });
  assert.deepEqual(completed.sections, ["completed"]);
  assert.equal(completed.people[0].tasks.length, 1);
  assert.equal(completed.people[0].shifts.length, 0);
  assert.equal(completed.people[0].analyzedTickets.length, 0);
  const workbook = await new ExcelJS.Workbook().xlsx.load(await createMonthlyWorkbook(completed));
  assert.ok(workbook.getWorksheet("جزئیات تسک‌ها"));
  for (const name of ["جزئیات شیفت", "تیکت‌ها", "ارزیابی شیفت"]) assert.equal(workbook.getWorksheet(name), undefined);
  const details = renderMonthlyHtml(completed), comparison = renderMonthlyComparisonHtml(completed);
  assert.match(details, /Reviewed events and evidence/);
  assert.doesNotMatch(details, /INC-001|<details class="data-section">/);
  assert.doesNotMatch(comparison, /class="log-ring"|<span>ساعت شیفت برنامه‌ریزی‌شده<\/span>/);
  assert.match(comparison, /ساعت تسک‌های تکمیل‌شده/);

  const schedule = buildMonthlyReport(admin, { month, person: l2.id, sections: "shiftSchedules" });
  const shiftBook = await new ExcelJS.Workbook().xlsx.load(await createMonthlyWorkbook(schedule));
  assert.ok(shiftBook.getWorksheet("جزئیات شیفت"));
  assert.equal(shiftBook.getWorksheet("جزئیات تسک‌ها"), undefined);
  assert.ok(!shiftBook.getWorksheet("جزئیات شیفت").getRow(1).values.includes("شیفت‌لاگ"));
  assert.doesNotMatch(renderMonthlyHtml(schedule), /Reviewed events and evidence/);
  assert.doesNotMatch(renderMonthlyComparisonHtml(schedule), /class="log-ring"|<span>ساعت تسک‌های تکمیل‌شده<\/span>/);

  const tickets = buildMonthlyReport(admin, { month, person: l2.id, sections: "tickets" });
  const ticketBook = await new ExcelJS.Workbook().xlsx.load(await createMonthlyWorkbook(tickets));
  assert.ok(ticketBook.getWorksheet("تیکت‌ها"));
  assert.equal(ticketBook.getWorksheet("جزئیات تسک‌ها"), undefined);
  assert.match(renderMonthlyHtml(tickets), /INC-001/);
  assert.doesNotMatch(renderMonthlyComparisonHtml(tickets), /class="chart-panel"|class="log-ring"/);
  assert.throws(() => buildMonthlyReport(admin, { month, sections: "" }), { status: 400 });
  assert.throws(() => buildMonthlyReport(admin, { month, sections: "shiftLogs" }), { status: 400 });
  assert.throws(() => buildMonthlyReport(admin, { month, sections: "evidence" }), { status: 400 });
  assert.throws(() => buildMonthlyReport(admin, { month, sections: "completed,unknown" }), { status: 400 });
});

test("report links are preserved as safe clickable evidence", async () => {
  db.prepare("UPDATE task_work_reports SET links = ? WHERE task_id = ?").run(JSON.stringify(["https://example.com/evidence?a=1&b=2"]), task.id);
  try {
    const report = buildMonthlyReport(admin, { month, person: l2.id, sections: "completed" });
    assert.deepEqual(report.people[0].tasks[0].links, ["https://example.com/evidence?a=1&b=2"]);
    const html = renderMonthlyHtml(report);
    assert.match(html, /href="https:\/\/example.com\/evidence\?a=1&amp;b=2"/);
    const workbook = await new ExcelJS.Workbook().xlsx.load(await createMonthlyWorkbook(report));
    const text = workbook.getWorksheet("جزئیات تسک‌ها").getRow(2).values.join(" ");
    assert.match(text, /https:\/\/example.com\/evidence/);
  } finally { db.prepare("UPDATE task_work_reports SET links = '[]' WHERE task_id = ?").run(task.id); }
});

test("monthly report separates automation SOC shift hours from completed task hours", async () => {
  const { addDays, jMonthStart, jalaliMonthBounds, jalaliMonthKey } = await import("@/lib/analytics/calendar");
  const reportMonth = jalaliMonthKey(addDays(jMonthStart(date), -1));
  const from = jalaliMonthBounds(reportMonth).from;
  const automation = add("Automation Analyst", "engineer", "Design & Automation", "automation@monthly.invalid");
  for (let i = 0; i < 6; i++) {
    const shiftDate = addDays(from, i);
    repo.setShiftSchedule(automation.id, shiftDate, "night", admin.id);
    assert.equal(repo.getShiftLog(automation.id, shiftDate), null);
  }
  const pending = addDays(from, 6), engineering = addDays(from, 7), leave = addDays(from, 8);
  repo.setShiftSchedule(automation.id, pending, "evening", admin.id);
  repo.setShiftSchedule(automation.id, engineering, "morning", admin.id);
  assert.equal(repo.getShiftLog(automation.id, engineering), null);
  repo.setDayStatus(automation.id, leave, "leave", admin.id);
  for (let i = 0; i < 10; i++) {
    const taskDate = addDays(from, i);
    const item = repo.createTask({ title:`Automation task ${i+1}`, description:"Investigation work", a:automation.id, prio:"normal", cx:2, due:taskDate }, admin.id);
    repo.updateTask(item.id, { status:"done", hours:10, quality:"good" }, admin.id);
    db.prepare("UPDATE tasks SET created_at=?, started_at=?, completed_at=?, updated_at=? WHERE id=?")
      .run(`${taskDate} 08:00:00`,`${taskDate} 09:00:00`,`${taskDate} 12:00:00`,`${taskDate} 12:00:00`,item.id);
    db.prepare("UPDATE task_transitions SET at=? WHERE task_id=?").run(`${taskDate} 12:00:00`,item.id);
  }
  const report = buildMonthlyReport(admin, { month:reportMonth, team:"da", person:automation.id });
  const socManagerReport = buildMonthlyReport(manager, { month:reportMonth, team:"da", person:automation.id });
  const p = report.people[0];
  assert.equal(p.stats.completed,10);
  assert.equal(p.stats.hours,100);
  assert.equal(p.stats.socShifts,1);
  assert.equal(p.stats.socShiftHours,12.5);
  assert.equal(p.stats.completedSocShifts,0);
  assert.equal(p.stats.completedSocShiftHours,0);
  assert.equal(p.stats.pendingSocShifts,1);
  assert.equal(p.stats.pendingSocShiftHours,12.5);
  assert.equal(p.stats.engineeringShifts,7);
  assert.equal(p.stats.engineeringShiftHours,79.75);
  assert.equal(socManagerReport.people[0].stats.completedSocShiftHours,0);
  assert.equal(socManagerReport.people[0].stats.hours,100);
  assert.equal(p.shifts.find((s) => s.date === engineering).workType,"engineering");
  assert.equal(p.shifts.find((s) => s.date === leave).hours,0);
  const workbook = await new ExcelJS.Workbook().xlsx.load(await createMonthlyWorkbook(report));
  const sheet = workbook.getWorksheet("خلاصه افراد");
  const headers = sheet.getRow(1).values;
  const row = sheet.getRow(2).values;
  for (const [label,value] of [["ساعت شیفت SOC (تکمیل‌شده)",0],["ساعت تسک‌های تکمیل‌شده",100]]) {
    const col = headers.indexOf(label); assert.ok(col > 0, `${label} column is missing`); assert.equal(row[col],value);
  }
  const html = renderMonthlyHtml(report);
  assert.match(html,/ساعت شیفت SOC/); assert.match(html,/>۰</); assert.match(html,/>۱۰۰</);
  assert.match(html,/۷٫۷۵/);
});

test("exports from a demo database are clearly labelled as fictional", async () => {
  assert.equal(buildMonthlyReport(admin,{month}).sample, false);
  db.prepare("INSERT INTO meta (key,value) VALUES ('monthly_report_demo','1')").run();
  try {
    const report = buildMonthlyReport(admin,{month,person:l2.id});
    assert.equal(report.sample,true);
    assert.match(renderMonthlyHtml(report), /نمونه آزمایشی • تمام اطلاعات ساختگی است/);
    assert.match(renderMonthlyComparisonHtml(report), /نمونه آزمایشی — همه اطلاعات ساختگی است/);
    const workbook = await new ExcelJS.Workbook().xlsx.load(await createMonthlyWorkbook(report));
    const guide = workbook.getWorksheet("راهنما");
    assert.equal(guide.getCell("A2").value,"نمونه آزمایشی");
    assert.match(guide.getCell("B2").value,/ساختگی/);
  } finally {
    db.prepare("DELETE FROM meta WHERE key='monthly_report_demo'").run();
  }
});
