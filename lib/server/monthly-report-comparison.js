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
    notes: "Shift hours are scheduled, not actual attendance. Task hours are total recorded hours on tasks completed this month and may include previous work. They can overlap and must not be added together. Counts alone do not measure work quality.",
    sample: "TEST EXAMPLE — ALL DATA IS FICTIONAL", partial: "through today", generated: "Generated",
  },
};

function track(person, label, value, max, tone, locale) {
  const shortLabel = tone === "shift" ? (locale === "fa" ? "شیفت" : "Shift") : (locale === "fa" ? "تسک" : "Task");
  return `<div class="chart-track-row"><span class="track-label">${esc(shortLabel)}</span><div class="track" role="img" aria-label="${esc(`${person.name}: ${label} — ${number(value, locale)}`)}"><span class="track-fill ${tone}" style="width:${width(value, max)}%"></span></div><strong class="track-value">${esc(number(value, locale))}</strong></div>`;
}

function comparisonChart(people, type, max, copy, locale) {
  const hours = type === "hours";
  const heading = hours ? copy.hourChart : copy.countChart;
  const caption = hours ? copy.hourCaption : copy.countCaption;
  const metrics = hours
    ? [[copy.shiftHours, scheduledHours, "shift"], [copy.taskHours, (p) => positive(p.stats.hours), "task"]]
    : [[copy.shiftCount, scheduledShifts, "shift"], [copy.taskCount, (p) => positive(p.stats.completed), "task"]];
  const rows = people.map((p) => `<div class="chart-person"><span class="person-key">${esc(p.name)}</span><div class="track-pair">${metrics.map(([label, get, tone]) =>
    track(p, label, get(p), max, tone, locale)).join("")}</div></div>`).join("");
  return `<section class="chart-panel"><header class="chart-panel-head"><h3>${esc(heading)}</h3><p>${esc(caption)}</p></header><div class="chart-legend"><span class="legend-shift">${esc(metrics[0][0])}</span><span class="legend-task">${esc(metrics[1][0])}</span></div><div class="chart-rows">${rows}</div><div class="chart-axis"><span>${esc(number(0, locale))}</span><span>${esc(copy.chartAxis)}: ${esc(number(max, locale))}</span></div></section>`;
}

function activityCard(p, report, copy, locale) {
  const done = completedTasks(p, report), socTotal = positive(p.stats.socShifts);
  const analyzed = positive(p.stats.analyzed);
  const rate = analyzed ? `${number(positive(p.stats.falsePositive) / analyzed * 100, locale)}${locale === "fa" ? "٪" : "%"}` : null;
  const list = done.map((t) => `<li><span dir="auto">${esc(t.title)}</span><small>${esc(number(positive(t.hours), locale))} ${locale === "fa" ? "ساعت" : "h"}</small></li>`).join("");
  const tags = [
    `${copy.shiftCount}: ${number(scheduledShifts(p), locale)}`,
    `${copy.taskCount}: ${number(positive(p.stats.completed), locale)}`,
    `${copy.open}: ${number(positive(p.stats.open), locale)}`,
    ...(socTotal ? [`${copy.socDone}: ${number(positive(p.stats.completedSocShifts), locale)}`, `${copy.socPending}: ${number(positive(p.stats.pendingSocShifts), locale)}`] : []),
    ...(analyzed ? [`${copy.analyzed}: ${number(analyzed, locale)}`, `${copy.fpRate}: ${rate}`] : []),
  ];
  return `<article class="activity-card"><div class="activity-identity"><span class="activity-initial" aria-hidden="true">${esc(Array.from(p.name || "?")[0])}</span><div><h4>${esc(p.name)}</h4><p>${esc(roleLabel(p.role, locale))} · ${esc(teamLabel(p.team, locale))}</p></div></div><div class="activity-tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div><details class="task-list"><summary>${esc(copy.showTasks)} <b>${esc(number(done.length, locale))}</b></summary>${done.length ? `<ul>${list}</ul>` : `<p class="empty">${esc(copy.noCompleted)}</p>`}</details></article>`;
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
    return `<section class="comparison-team" id="team-${i}"><header class="team-head"><div><span class="kicker">${esc(copy.team)}</span><h2>${esc(teamLabel(team.name, locale))}</h2></div><span class="team-count">${esc(number(members.length, locale))} ${esc(copy.people)}</span></header><div class="comparison-grid">${comparisonChart(members, "hours", maxHours, copy, locale)}${comparisonChart(members, "counts", maxCounts, copy, locale)}</div><div class="activity-heading"><h3>${esc(copy.tasks)}</h3><p>${esc(copy.showTasks)}</p></div><div class="activity-grid">${members.map((p) => activityCard(p, report, copy, locale)).join("")}</div></section>`;
  }).join("");
  const scope = report.personName || (report.filters?.team && teams[0] ? teamLabel(teams[0].name, locale) : locale === "fa" ? "افراد انتخاب‌شده" : "Selected people");
  return `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(copy.title)} · ${esc(report.label)}</title><style>${monthlyComparisonStyles(font)}</style></head><body><header class="comparison-cover"><div class="wrap"><div class="cover-nav"><div class="brand">SENTINEL <span>OPS</span><small>PEOPLE / MONTHLY</small></div>${navigation}</div><div class="cover-body"><span class="kicker">${esc(copy.document)}</span><h1>${esc(copy.title)}</h1><p>${esc(copy.subtitle)}</p><div class="cover-period"><strong>${esc(report.label)}${report.partial ? ` · ${esc(copy.partial)}` : ""}</strong><span>${esc(report.from)} — ${esc(report.to)}</span></div>${report.sample ? `<div class="sample">${esc(copy.sample)}</div>` : ""}</div></div></header><main class="wrap"><section class="comparison-summary" aria-label="${esc(copy.scope)}"><div class="scope"><span>${esc(copy.scope)}</span><strong>${esc(scope)}</strong></div><div class="summary-figures"><div><span>${esc(copy.people)}</span><b>${esc(number(people.length, locale))}</b></div><div><span>${esc(copy.shiftHours)}</span><b>${esc(number(sum(scheduledHours), locale))}</b></div><div><span>${esc(copy.taskHours)}</span><b>${esc(number(sum((p) => positive(p.stats.hours)), locale))}</b></div><div><span>${esc(copy.taskCount)}</span><b>${esc(number(sum((p) => positive(p.stats.completed)), locale))}</b></div></div></section><nav class="team-navigation" aria-label="${esc(copy.teams)}">${teams.map((t, i) => `<a href="#team-${i}">${esc(teamLabel(t.name, locale))}</a>`).join("")}</nav>${sections || `<p class="no-people">${esc(copy.noPeople)}</p>`}<aside class="comparison-notes"><strong>${esc(copy.scope)}</strong><p>${esc(copy.notes)}</p></aside><footer>${esc(copy.generated)} ${esc(report.generatedAt)} · SENTINEL OPS</footer></main></body></html>`;
}
