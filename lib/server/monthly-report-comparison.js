import { teamLabel, roleLabel } from "@/lib/i18n/labels";
import { monthlyComparisonStyles } from "@/lib/server/monthly-report-comparison-styles";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const positive = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const number = (value, locale) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
  maximumFractionDigits: 2,
}).format(value);
const width = (value, max) => Math.min(100, Math.max(0, Math.round(positive(value) / max * 1000) / 10));
const scheduledHours = (p) => positive(p.stats.socShiftHours) + positive(p.stats.engineeringShiftHours);
const scheduledShifts = (p) => positive(p.stats.socShifts) + positive(p.stats.engineeringShifts);
const completedTasks = (p, r) => (p.tasks ?? []).filter((t) =>
  t.closed && t.closed.slice(0, 10) >= r.from && t.closed.slice(0, 10) <= r.to);

const COPY = {
  fa: {
    title: "مقایسه فعالیت افراد", subtitle: "مقایسه شیفت‌ها، تسک‌ها و کارهای ثبت‌شده در ماه",
    document: "نمای مدیریتی افراد", scope: "دامنه گزارش", people: "افراد", teams: "تیم‌ها",
    shiftHours: "ساعت شیفت برنامه‌ریزی‌شده", taskHours: "ساعت تسک‌های تکمیل‌شده",
    shiftCount: "تعداد شیفت کاری", taskCount: "تسک تکمیل‌شده", hourChart: "مقایسه ساعت‌ها",
    countChart: "مقایسه تعداد فعالیت‌ها", hourCaption: "دو نوع ساعت مستقل، با مقیاس یکسان",
    countCaption: "شیفت‌های کاری و تسک‌های تکمیل‌شده", team: "تیم", chartAxis: "بیشترین مقدار در دامنه",
    tasks: "تسک‌های انجام‌شده", open: "تسک باز", socDone: "شیفت‌لاگ SOC تکمیل‌شده",
    socPending: "شیفت‌لاگ ناقص یا ثبت‌نشده", analyzed: "تیکت تحلیل‌شده", fpRate: "نرخ FP",
    details: "گزارش تفصیلی", comparison: "مقایسه افراد", showTasks: "نمایش عنوان تسک‌ها",
    noCompleted: "تسک تکمیل‌شده‌ای در این ماه ثبت نشده است.", noPeople: "فردی در دامنه انتخاب‌شده وجود ندارد.",
    hoursUnit: "ساعت", period: "بازه گزارش", byPerson: "به تفکیک نفر", ledger: "پرونده فعالیت افراد",
    logCoverage: "پوشش شیفت‌لاگ SOC", record: "جزئیات فعالیت", logged: "ثبت‌شده از",
    whatDone: "کارهایی که در ماه تکمیل شده‌اند", comparisonNote: "مقیاس نمودار بین همه تیم‌ها ثابت است.",
    notes: "ساعت شیفت براساس برنامه است، نه حضور واقعی. ساعت تسک، کل ساعت ثبت‌شده برای تسک‌هایی است که این ماه تکمیل شده‌اند و ممکن است بخشی از آن مربوط به ماه‌های قبل باشد. این دو مقدار می‌توانند هم‌پوشانی داشته باشند و با هم جمع نمی‌شوند. تعداد فعالیت‌ها به‌تنهایی معیار کیفیت کار نیست.",
    sample: "نمونه آزمایشی — همه اطلاعات ساختگی است", partial: "تا امروز", generated: "زمان تهیه",
  },
  en: {
    title: "People activity comparison", subtitle: "Compare scheduled shifts, completed tasks and recorded work for the month",
    document: "People comparison", scope: "Report scope", people: "People", teams: "Teams",
    shiftHours: "Scheduled shift hours", taskHours: "Hours on completed tasks",
    shiftCount: "Working shifts", taskCount: "Completed tasks", hourChart: "Hours by person",
    countChart: "Activity counts", hourCaption: "Two distinct hour measures on a shared scale",
    countCaption: "Working shifts and completed tasks", team: "Team", chartAxis: "Highest value in scope",
    tasks: "Completed work", open: "Open tasks", socDone: "Completed SOC shift logs",
    socPending: "Missing or incomplete SOC logs", analyzed: "Analyzed tickets", fpRate: "FP rate",
    details: "Detailed report", comparison: "Compare people", showTasks: "Show task titles",
    noCompleted: "No tasks were completed this month.", noPeople: "No people in the selected scope.",
    hoursUnit: "hours", period: "Report period", byPerson: "Person-by-person", ledger: "Individual activity records",
    logCoverage: "SOC shift log completion", record: "Activity details", logged: "completed of",
    whatDone: "Work completed during this month", comparisonNote: "Chart scales are consistent across teams.",
    notes: "Shift hours are scheduled, not actual attendance. Task hours are total recorded hours on tasks completed this month and may include previous work. They can overlap and must not be added together. Counts alone do not measure work quality.",
    sample: "TEST EXAMPLE — ALL DATA IS FICTIONAL", partial: "through today", generated: "Generated",
  },
};

function chartLane(person, label, value, max, tone, locale) {
  const safe = positive(value);
  return `<div class="comparison-lane"><div class="lane-label"><span>${esc(label)}</span><strong>${esc(number(safe, locale))}</strong></div><div class="data-track" role="meter" aria-label="${esc(`${person.name}: ${label}`)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${safe}"><span class="data-fill ${tone}" style="width:${width(safe, max)}%"></span></div></div>`;
}

function comparisonChart(people, type, max, copy, locale) {
  const hours = type === "hours";
  const heading = hours ? copy.hourChart : copy.countChart;
  const caption = hours ? copy.hourCaption : copy.countCaption;
  const metrics = hours
    ? [[copy.shiftHours, scheduledHours, "shift"], [copy.taskHours, (p) => positive(p.stats.hours), "task"]]
    : [[copy.shiftCount, scheduledShifts, "shift"], [copy.taskCount, (p) => positive(p.stats.completed), "task"]];
  const rows = people.map((p) => `<div class="chart-person"><div class="chart-person-name"><span class="person-mark" aria-hidden="true">${esc(Array.from(p.name || "?")[0])}</span><div><strong>${esc(p.name)}</strong><small>${esc(roleLabel(p.role, locale))}</small></div></div><div class="chart-lanes">${metrics.map(([label, get, tone]) =>
    chartLane(p, label, get(p), max, tone, locale)).join("")}</div></div>`).join("");
  return `<section class="chart-panel ${hours ? "is-hours" : "is-counts"}"><header class="chart-panel-head"><div><span class="section-eyebrow">${esc(copy.byPerson)}</span><h3>${esc(heading)}</h3><p>${esc(caption)}</p></div><div class="chart-legend"><span class="legend-shift">${esc(metrics[0][0])}</span><span class="legend-task">${esc(metrics[1][0])}</span></div></header><div class="chart-rows">${rows}</div><div class="chart-axis"><span>${esc(number(0, locale))}</span><span>${esc(copy.chartAxis)} ${esc(number(max, locale))}${hours ? ` ${esc(copy.hoursUnit)}` : ""}</span></div></section>`;
}

function activityCard(p, report, copy, locale) {
  const done = completedTasks(p, report);
  const socTotal = positive(p.stats.socShifts), socDone = positive(p.stats.completedSocShifts);
  const analyzed = positive(p.stats.analyzed);
  const fpRate = analyzed ? `${number(positive(p.stats.falsePositive) / analyzed * 100, locale)}${locale === "fa" ? "٪" : "%"}` : null;
  const progress = socTotal ? Math.min(100, Math.round(socDone / socTotal * 100)) : 0;
  const list = done.map((t) => `<li><span class="task-label" dir="auto">${esc(t.title)}</span><small>${esc(number(positive(t.hours), locale))} ${esc(copy.hoursUnit)}</small></li>`).join("");
  const logs = socTotal ? `<div class="log-coverage"><div class="log-ring" role="img" aria-label="${esc(`${copy.logCoverage}: ${progress}%`)}" style="--progress:${progress}%"><span>${esc(number(progress, locale))}${locale === "fa" ? "٪" : "%"}</span></div><div><strong>${esc(copy.logCoverage)}</strong><p>${esc(copy.socDone)}: <b>${esc(number(socDone, locale))}</b> / ${esc(number(socTotal, locale))}</p><p class="${positive(p.stats.pendingSocShifts) ? "pending" : ""}">${esc(copy.socPending)}: ${esc(number(positive(p.stats.pendingSocShifts), locale))}</p></div></div>` : "";
  const ticket = analyzed ? `<div class="ticket-strip"><span>${esc(copy.analyzed)} <b>${esc(number(analyzed, locale))}</b></span><span>${esc(copy.fpRate)} <b>${esc(fpRate)}</b></span></div>` : "";
  return `<article class="activity-card"><div class="activity-identity"><span class="activity-initial" aria-hidden="true">${esc(Array.from(p.name || "?")[0])}</span><div><h4>${esc(p.name)}</h4><p>${esc(roleLabel(p.role, locale))} · ${esc(teamLabel(p.team, locale))}</p></div></div><div class="outcome-grid"><div class="outcome-main"><strong>${esc(number(positive(p.stats.completed), locale))}</strong><span>${esc(copy.taskCount)}</span></div><div><strong>${esc(number(positive(p.stats.hours), locale))}</strong><span>${esc(copy.taskHours)}</span></div><div><strong>${esc(number(scheduledShifts(p), locale))}</strong><span>${esc(copy.shiftCount)}</span></div><div><strong>${esc(number(positive(p.stats.open), locale))}</strong><span>${esc(copy.open)}</span></div></div>${logs}${ticket}<details class="task-list"><summary><span>${esc(copy.showTasks)} <b>${esc(number(done.length, locale))}</b></span><span class="chevron" aria-hidden="true"></span></summary>${done.length ? `<div class="task-list-head">${esc(copy.whatDone)}</div><ul>${list}</ul>` : `<p class="empty">${esc(copy.noCompleted)}</p>`}</details></article>`;
}

// Static, offline HTML using the existing scoped report.people dataset.
export function renderMonthlyComparisonPage(report, { font = "", detailsHref = null } = {}) {
  const locale = report.locale === "en" ? "en" : "fa", copy = COPY[locale];
  const people = report.people ?? [], teams = report.teams ?? [], dir = locale === "fa" ? "rtl" : "ltr";
  const sum = (get) => people.reduce((total, p) => total + get(p), 0);
  const maxHours = Math.max(1, ...people.flatMap((p) => [scheduledHours(p), positive(p.stats.hours)]));
  const maxCounts = Math.max(1, ...people.flatMap((p) => [scheduledShifts(p), positive(p.stats.completed)]));
  const navigation = detailsHref ? `<nav class="report-switch" aria-label="${esc(copy.details)}"><a href="${esc(detailsHref)}">${esc(copy.details)}</a><span aria-current="page">${esc(copy.comparison)}</span></nav>` : "";
  const sections = teams.map((team, i) => {
    const members = people.filter((p) => p.group === team.name).sort((a,b) => a.name.localeCompare(b.name, locale));
    const teamShiftHours = members.reduce((s, p) => s + scheduledHours(p), 0);
    const teamTaskHours = members.reduce((s, p) => s + positive(p.stats.hours), 0);
    return `<section class="comparison-team" id="team-${i}"><header class="team-head"><div class="team-heading"><span class="team-index" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div><span class="section-eyebrow">${esc(copy.team)}</span><h2>${esc(teamLabel(team.name, locale))}</h2><p>${esc(number(members.length, locale))} ${esc(copy.people)}</p></div></div><div class="team-rollup"><span><b>${esc(number(teamShiftHours, locale))}</b> ${esc(copy.shiftHours)}</span><span><b>${esc(number(teamTaskHours, locale))}</b> ${esc(copy.taskHours)}</span></div></header><div class="comparison-grid">${comparisonChart(members, "hours", maxHours, copy, locale)}${comparisonChart(members, "counts", maxCounts, copy, locale)}</div><div class="activity-heading"><div><span class="section-eyebrow">${esc(copy.ledger)}</span><h3>${esc(copy.tasks)}</h3></div><p>${esc(copy.comparisonNote)}</p></div><div class="activity-grid">${members.map((p) => activityCard(p, report, copy, locale)).join("")}</div></section>`;
  }).join("");
  const scope = report.personName || (report.filters?.team && teams[0] ? teamLabel(teams[0].name, locale) : locale === "fa" ? "افراد انتخاب‌شده" : "Selected people");
  return `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(copy.title)} · ${esc(report.label)}</title><style>${monthlyComparisonStyles(font)}</style></head><body><header class="comparison-cover"><div class="wrap"><div class="cover-nav"><div class="brand"><span class="brand-symbol" aria-hidden="true">S<span class="brand-dot"></span></span><div><strong>SENTINEL <span>OPS</span></strong><small>SECURITY OPERATIONS / MONTHLY INTELLIGENCE</small></div></div>${navigation}</div><div class="cover-body"><div class="cover-intro"><span class="section-eyebrow">${esc(copy.document)}</span><h1>${esc(copy.title)}<span class="title-accent" aria-hidden="true">.</span></h1><p>${esc(copy.subtitle)}</p>${report.sample ? `<div class="sample">${esc(copy.sample)}</div>` : ""}</div><div class="cover-period"><span>${esc(copy.period)}</span><strong>${esc(report.label)}</strong><small dir="ltr">${esc(report.from)} — ${esc(report.to)}</small>${report.partial ? `<em>${esc(copy.partial)}</em>` : ""}</div></div><section class="comparison-summary" aria-label="${esc(copy.scope)}"><div class="scope"><span>${esc(copy.scope)}</span><strong>${esc(scope)}</strong></div><div class="summary-figures"><div><span>${esc(copy.people)}</span><b>${esc(number(people.length, locale))}</b></div><div><span>${esc(copy.shiftHours)}</span><b>${esc(number(sum(scheduledHours), locale))}</b><small>${esc(copy.hoursUnit)}</small></div><div><span>${esc(copy.taskHours)}</span><b>${esc(number(sum((p) => positive(p.stats.hours)), locale))}</b><small>${esc(copy.hoursUnit)}</small></div><div><span>${esc(copy.taskCount)}</span><b>${esc(number(sum((p) => positive(p.stats.completed)), locale))}</b></div></div></section></div></header><main class="wrap"><nav class="team-navigation" aria-label="${esc(copy.teams)}"><span>${esc(copy.teams)}</span>${teams.map((t, i) => `<a href="#team-${i}">${esc(teamLabel(t.name, locale))}</a>`).join("")}</nav>${sections || `<p class="no-people">${esc(copy.noPeople)}</p>`}<aside class="comparison-notes"><span class="note-symbol" aria-hidden="true">i</span><div><strong>${esc(copy.scope)} / ${esc(copy.record)}</strong><p>${esc(copy.notes)}</p></div></aside><footer><span>SENTINEL OPS / MONTHLY PEOPLE INTELLIGENCE</span><span>${esc(copy.generated)} ${esc(report.generatedAt)}</span></footer></main></body></html>`;
}
