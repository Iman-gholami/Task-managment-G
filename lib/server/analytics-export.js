import "server-only";
import ExcelJS from "exceljs";
import { toJalali, WEEKDAYS, weekdayIndex } from "@/lib/analytics/calendar";
import { buildAlerts, LEVELS as ALERT_LEVELS } from "@/lib/analytics/alerts";
import { buildInsights } from "@/lib/analytics/insights";
import { ADVANCED_FILTERS } from "@/lib/analytics/filters";
import { isNum } from "@/lib/analytics/format";
import {
  CX_FA, GROUP_BY_KEY, OPEN_STATUSES, PRIO_FA, QUAL_FA, QUAL_KEYS, ROLE_FA, SHIFT_FA, STATUS_FA, groupFa,
} from "@/lib/analytics/labels";
import { METRICS, backlogSeries, bucketStats, levelRows, openStats, peerMedian, peopleRows, stats, teamRows } from "@/lib/analytics/metrics";
import { autoGranularity, buckets, COMPARISONS, GRAN_LABEL, PRESET_LABEL } from "@/lib/analytics/periods";

const pad = (n) => String(n).padStart(2, "0");
/** Jalali date with Latin digits ("1405/07/14"): sorts and filters correctly in Excel. */
const jl = (iso) => { if (!iso) return ""; const j = toJalali(iso); return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`; };
const FMT = { int: "#,##0", dec: "#,##0.0", pct: "0%", text: "@" };
const KIND_FMT = { count: "int", rate: "pct", days: "dec", avg: "dec" };
const v = (x) => (isNum(x) ? x : null);

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EEF0" } };
const TITLE_FONT = { bold: true, size: 14 };

function addTable(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1, rightToLeft: true }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(10, c.header.length + 4) }));
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.fill = HEADER_FILL;
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 30;
  rows.forEach((r) => ws.addRow(r));
  columns.forEach((c, i) => { if (c.fmt) ws.getColumn(i + 1).numFmt = FMT[c.fmt]; });
  if (columns.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

function addKeyValue(wb, name, title, pairs, widths = [34, 70]) {
  const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true }] });
  ws.getColumn(1).width = widths[0];
  ws.getColumn(2).width = widths[1];
  ws.addRow([title]).font = TITLE_FONT;
  ws.addRow([]);
  for (const [k, val] of pairs) {
    const row = ws.addRow([k, val]);
    row.getCell(1).font = { bold: true };
    row.alignment = { wrapText: true, vertical: "top" };
  }
  return ws;
}

function guideSheet(wb) {
  const ws = addKeyValue(wb, "راهنما", "راهنمای فایل و تعریف شاخص‌ها", [
    ["این فایل", "خروجی داشبورد مدیریتی Sentinel Ops. شیت «خلاصه» و «تیم‌ها» و «کارشناسان» جمع‌بندی‌اند؛ شیت‌های «(خام)» داده رکورد به رکورد برای تحلیل بیشتر."],
    ["دوره", "به وقت تهران و تقویم شمسی. دوره جاری تا امروز شمرده می‌شود و با همان تعداد روز از دوره قبل مقایسه می‌شود."],
    ["جامعه آماری", "تحلیلگران و مهندسان. مدیران در شیت کارشناسان نیستند ولی کارشان در جمع تیم حساب شده است. سرانه = جمع ÷ کارشناسان تیم در دوره."],
    ["ارزیابی", "این گزارش فقط آماری است و امتیاز یا رتبه ندارد."],
    ["نرخ‌ها", "نرخ و میانه وقتی نمونه کمتر از ۵ باشد خالی می‌ماند. تغییر نرخ‌ها به واحد درصد است."],
    ["", ""],
    ...Object.values(METRICS).map((m) => [m.label, m.hint ?? ""]),
    ["صف باز (اکنون)", "همه تسک‌های انجام‌نشده و لغونشده، در لحظه تهیه فایل"],
    ["معوق (اکنون)", "تسک باز با ددلاین گذشته"],
  ]);
  ws.getRow(1).font = TITLE_FONT;
}

function filtersSheet(wb, { filters, range, cmp, facts, viewer, gran }) {
  const scopeFa = { department: "کل واحد", soc: "SOC", self: "شخصی" }[facts.scope?.kind] ?? "—";
  const pairs = [
    ["دوره", `${PRESET_LABEL[range.preset]} — ${range.label}`],
    ["از تا", `${jl(range.from)} تا ${jl(range.end)} (${range.from} … ${range.end})`],
    ["مقایسه با", cmp ? `${cmp.label} (${jl(cmp.from)} تا ${jl(cmp.to)})` : COMPARISONS.find(([k]) => k === "none")[1]],
    ["واحد زمانی روند", GRAN_LABEL[gran]],
    ["دامنه داده", scopeFa],
    ["تیم", filters.team ? GROUP_BY_KEY[filters.team].fa : "همه"],
    ["سطح", filters.level || "همه"],
    ...ADVANCED_FILTERS.map((k) => [
      { role: "نقش", prio: "اولویت", cx: "پیچیدگی", q: "کیفیت", shift: "نوع شیفت" }[k],
      !filters[k] ? "همه" : k === "role" ? ROLE_FA[filters[k]] : k === "prio" ? PRIO_FA[filters[k]] : k === "cx" ? CX_FA[filters[k] - 1] : k === "q" ? QUAL_FA[filters[k]] : SHIFT_FA[filters[k]],
    ]),
    ["داده", facts.demo ? "نمایشی (ساختگی) — برای ارائه، نه تصمیم‌گیری" : "واقعی"],
    ["زمان تهیه", `${jl(facts.today)} — ${new Date().toISOString().slice(11, 16)} UTC`],
    ["تهیه‌کننده", viewer?.name ?? ""],
  ];
  addKeyValue(wb, "فیلترها", "فیلترها و دوره این خروجی", pairs);
}

const SUMMARY_KEYS = Object.keys(METRICS);

function changeOf(now, before, kind) {
  if (!isNum(now) || !isNum(before)) return null;
  if (kind === "rate") return now - before;
  if (kind === "days" || kind === "avg") return before > 0 ? (now - before) / before : null;
  return before >= 5 ? (now - before) / before : null;
}

function summarySheet(wb, facts, range, cmp, extra = {}) {
  const cur = stats(facts, extra.ids ?? null, range);
  const prev = cmp ? stats(facts, extra.ids ?? null, cmp) : null;
  const rows = SUMMARY_KEYS.map((k) => {
    const m = METRICS[k];
    return { metric: m.label, cur: v(cur[k]), prev: prev ? v(prev[k]) : null, change: prev ? changeOf(cur[k], prev[k], m.kind) : null, unit: m.kind === "rate" ? "واحد درصد" : "درصد", median: extra.medians ? v(extra.medians[k]) : undefined, kind: m.kind };
  });
  const cols = [
    { header: "شاخص", key: "metric", width: 30 },
    { header: "این دوره", key: "cur", width: 14 },
    { header: "دوره مقایسه", key: "prev", width: 14 },
    { header: "تغییر", key: "change", width: 12, fmt: "pct" },
    { header: "نوع تغییر", key: "unit", width: 12 },
    ...(extra.medians ? [{ header: "میانه تیم", key: "median", width: 12 }] : []),
  ];
  const ws = addTable(wb, "خلاصه", cols, rows);
  rows.forEach((r, i) => {
    const f = FMT[KIND_FMT[r.kind]];
    ws.getCell(i + 2, 2).numFmt = f;
    ws.getCell(i + 2, 3).numFmt = f;
    if (extra.medians) ws.getCell(i + 2, 6).numFmt = f;
  });
  const open = openStats(facts, extra.ids ?? null);
  ws.addRow([]);
  ws.addRow(["وضعیت کار باز (اکنون)"]).font = { bold: true };
  [["صف باز", open.open], ["معوق", open.overdue], ["معوق با اولویت بالا یا بحرانی", open.overdueHigh], ["مسدود", open.blocked], ["در انتظار بازبینی", open.review], ["بک‌لاگ", open.backlog]]
    .forEach((r) => ws.addRow(r));
}

const metricCols = (prefix = "") => [
  { header: `${prefix}تسک تکمیل‌شده`, key: "completed", fmt: "int" },
  { header: `${prefix}حجم کار وزن‌دار`, key: "units", fmt: "int" },
  { header: `${prefix}ساعت ثبت‌شده`, key: "hours", fmt: "dec" },
  { header: "ساعت به ازای تسک", key: "hoursPerTask", fmt: "dec" },
  { header: "تسک ایجادشده", key: "created", fmt: "int" },
  { header: "تحویل به‌موقع", key: "onTimeRate", fmt: "pct" },
  { header: "تسک‌های دارای ددلاین", key: "onTimeN", fmt: "int" },
  { header: "میانه زمان انجام (روز)", key: "cycleMedian", fmt: "dec" },
  { header: "سهم برگشتی", key: "returnShare", fmt: "pct" },
  { header: "سهم عالی و خوب", key: "highQualityShare", fmt: "pct" },
  ...CX_FA.map((c, i) => ({ header: `پیچیدگی: ${c}`, key: `cx${i}`, fmt: "int" })),
  ...QUAL_KEYS.map((q, i) => ({ header: `کیفیت: ${QUAL_FA[q]}`, key: `q${i}`, fmt: "int" })),
  { header: "شیفت", key: "shifts", fmt: "int" },
  { header: "ساعت شیفت", key: "shiftHours", fmt: "dec" },
  { header: "بسته‌شدن شیفت‌لاگ", key: "closureRate", fmt: "pct" },
  { header: "شیفت‌لاگ جامانده", key: "missed", fmt: "int" },
  { header: "انجام روتین", key: "routineRate", fmt: "pct" },
  { header: "IOC", key: "iocs", fmt: "int" },
  { header: "IOC به ازای شیفت", key: "iocPerShift", fmt: "dec" },
  { header: "تیکت (تعداد)", key: "tickets", fmt: "int" },
  { header: "گزارش ترافیک", key: "reports", fmt: "int" },
  { header: "Issue", key: "issues", fmt: "int" },
];
const openCols = [
  { header: "صف باز (اکنون)", key: "open", fmt: "int" },
  { header: "معوق (اکنون)", key: "overdue", fmt: "int" },
  { header: "مسدود (اکنون)", key: "blocked", fmt: "int" },
  { header: "در انتظار بازبینی (اکنون)", key: "review", fmt: "int" },
];
const flat = (s) => ({
  ...Object.fromEntries(Object.keys(METRICS).map((k) => [k, v(s[k])])),
  onTimeN: s.onTimeN, shiftHours: s.shiftHours, missed: s.missed,
  ...Object.fromEntries(s.cx.map((n, i) => [`cx${i}`, n])),
  ...Object.fromEntries(s.quality.map((n, i) => [`q${i}`, n])),
});
const flatOpen = (o) => ({ open: o.open, overdue: o.overdue, blocked: o.blocked, review: o.review });

function teamsSheet(wb, facts, range, cmp) {
  const rows = teamRows(facts, range, cmp).map((t) => ({
    team: t.fa, headcount: t.headcount, ...flat(t.cur), ...flatOpen(t.open),
    pcCompleted: v(t.pc.completed), pcUnits: v(t.pc.units), pcHours: v(t.pc.hours),
    prevCompleted: t.prev?.completed ?? null, change: t.prev ? changeOf(t.cur.completed, t.prev.completed, "count") : null,
  }));
  addTable(wb, "تیم‌ها", [
    { header: "تیم", key: "team", width: 20 }, { header: "کارشناسان", key: "headcount", fmt: "int" },
    { header: "سرانه تکمیل‌شده", key: "pcCompleted", fmt: "dec" }, { header: "سرانه حجم وزن‌دار", key: "pcUnits", fmt: "dec" }, { header: "سرانه ساعت", key: "pcHours", fmt: "dec" },
    { header: "تکمیل‌شده دوره مقایسه", key: "prevCompleted", fmt: "int" }, { header: "تغییر تکمیل‌شده", key: "change", fmt: "pct" },
    ...metricCols(), ...openCols,
  ], rows);
}

function levelsSheet(wb, facts, range, cmp) {
  const levels = levelRows(facts, range, cmp);
  if (!levels.length) return;
  addTable(wb, "سطح‌های SOC", [
    { header: "سطح", key: "level", width: 10 }, { header: "کارشناسان", key: "headcount", fmt: "int" }, { header: "سرانه تکمیل‌شده", key: "pcCompleted", fmt: "dec" },
    ...metricCols(), ...openCols,
  ], levels.map((l) => ({ level: l.level, headcount: l.headcount, pcCompleted: v(l.pc.completed), ...flat(l.cur), ...flatOpen(l.open) })));
}

function peopleSheet(wb, facts, range, cmp, name = "کارشناسان") {
  const rows = peopleRows(facts, range, cmp).map((r) => ({
    name: r.person.name, team: groupFa(r.person.group), level: r.person.level ?? "", role: ROLE_FA[r.person.role], state: r.person.active ? "فعال" : "غیرفعال",
    ...flat(r.cur), ...flatOpen(r.open), prevCompleted: r.prev?.completed ?? null,
  }));
  addTable(wb, name, [
    { header: "نام", key: "name", width: 22 }, { header: "تیم", key: "team", width: 18 }, { header: "سطح", key: "level", width: 8 }, { header: "نقش", key: "role", width: 10 }, { header: "وضعیت", key: "state", width: 9 },
    ...metricCols(), { header: "تکمیل‌شده دوره مقایسه", key: "prevCompleted", fmt: "int" }, ...openCols,
  ], rows);
}

function trendSheet(wb, facts, ids, range, cmp, gran) {
  const b = buckets(range.from, range.end, gran);
  const pb = cmp ? buckets(cmp.from, cmp.to, gran) : [];
  const s = bucketStats(facts, ids, b);
  const ps = bucketStats(facts, ids, pb);
  const backlog = backlogSeries(facts, ids, b);
  addTable(wb, "روند", [
    { header: "بازه", key: "label", width: 18 }, { header: "از", key: "from", width: 12 }, { header: "تا", key: "to", width: 12 }, { header: "ناقص", key: "partial", width: 8 },
    { header: "تسک تکمیل‌شده", key: "completed", fmt: "int" }, { header: "تکمیل‌شده (دوره مقایسه)", key: "prevCompleted", fmt: "int" },
    { header: "حجم کار وزن‌دار", key: "units", fmt: "int" }, { header: "ساعت", key: "hours", fmt: "dec" }, { header: "تسک ایجادشده", key: "created", fmt: "int" },
    { header: "صف باز در پایان بازه", key: "backlog", fmt: "int" }, { header: "تحویل به‌موقع", key: "onTimeRate", fmt: "pct" },
    { header: "شیفت", key: "shifts", fmt: "int" }, { header: "بسته‌شدن شیفت‌لاگ", key: "closureRate", fmt: "pct" }, { header: "انجام روتین", key: "routineRate", fmt: "pct" },
    { header: "IOC", key: "iocs", fmt: "int" }, { header: "تیکت", key: "tickets", fmt: "int" },
  ], b.map((x, i) => ({
    label: x.label.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)), from: jl(x.from), to: jl(x.to), partial: x.partial ? "بله" : "",
    completed: s[i].completed, prevCompleted: ps[i]?.completed ?? null, units: s[i].units, hours: s[i].hours, created: s[i].created, backlog: backlog[i],
    onTimeRate: v(s[i].onTimeRate), shifts: s[i].shifts, closureRate: v(s[i].closureRate), routineRate: v(s[i].routineRate), iocs: s[i].iocs, tickets: s[i].tickets,
  })));
}

function rawTasks(wb, facts, range, people, name = "تسک‌ها (خام)", filter) {
  const inRange = (d) => d && d >= range.from && d <= range.end;
  const rows = facts.tasks
    .filter(filter ?? ((t) => inRange(t.completed) || inRange(t.created) || OPEN_STATUSES.includes(t.status)))
    .sort((a, b) => (a.completed ?? a.created).localeCompare(b.completed ?? b.created))
    .map((t) => {
      const p = people.get(t.a);
      return {
        id: t.id, title: t.title, person: p?.name ?? t.a, team: groupFa(p?.group), level: p?.level ?? "", status: STATUS_FA[t.status], prio: PRIO_FA[t.prio], cx: CX_FA[t.cx - 1],
        quality: t.quality ? QUAL_FA[t.quality] : "", hours: t.hours, created: jl(t.created), started: jl(t.started), completed: jl(t.completed), due: jl(t.due),
        onTime: t.completed && t.due ? (t.completed <= t.due ? "بله" : "خیر") : "", cycle: v(t.cycle), returns: t.returns.length,
        createdIso: t.created ?? "", completedIso: t.completed ?? "",
      };
    });
  addTable(wb, name, [
    { header: "شناسه", key: "id", width: 9 }, { header: "عنوان", key: "title", width: 40 }, { header: "کارشناس", key: "person", width: 20 }, { header: "تیم", key: "team", width: 16 },
    { header: "سطح", key: "level", width: 7 }, { header: "وضعیت", key: "status", width: 12 }, { header: "اولویت", key: "prio", width: 9 }, { header: "پیچیدگی", key: "cx", width: 10 },
    { header: "کیفیت", key: "quality", width: 13 }, { header: "ساعت", key: "hours", fmt: "dec", width: 8 }, { header: "ایجاد", key: "created", width: 12 }, { header: "شروع", key: "started", width: 12 },
    { header: "تأیید", key: "completed", width: 12 }, { header: "ددلاین", key: "due", width: 12 }, { header: "به‌موقع", key: "onTime", width: 9 },
    { header: "زمان انجام (روز)", key: "cycle", fmt: "dec", width: 12 }, { header: "دفعات برگشت", key: "returns", fmt: "int", width: 11 },
    { header: "ایجاد (میلادی)", key: "createdIso", width: 13 }, { header: "تأیید (میلادی)", key: "completedIso", width: 13 },
  ], rows);
}

function rawShifts(wb, facts, range, people) {
  const tix = new Map(facts.tickets.map((t) => [`${t.a}|${t.date}`, t.n]));
  const rows = facts.shifts.filter((s) => s.date >= range.from && s.date <= range.end).map((s) => ({
    person: people.get(s.a)?.name ?? s.a, level: people.get(s.a)?.level ?? "", date: jl(s.date), iso: s.date, weekday: WEEKDAYS[weekdayIndex(s.date)], type: SHIFT_FA[s.type] ?? s.type,
    log: s.log ? "بله" : "خیر", closed: s.closed ? "بله" : "خیر", done: s.done, total: s.total, routine: s.total ? s.done / s.total : null,
    iocs: s.iocs, report: s.report ? "بله" : "", issues: s.issues, tickets: tix.get(`${s.a}|${s.date}`) ?? 0,
  }));
  addTable(wb, "شیفت‌ها (خام)", [
    { header: "کارشناس", key: "person", width: 20 }, { header: "سطح", key: "level", width: 7 }, { header: "تاریخ", key: "date", width: 12 }, { header: "تاریخ میلادی", key: "iso", width: 12 },
    { header: "روز هفته", key: "weekday", width: 10 }, { header: "نوع شیفت", key: "type", width: 12 }, { header: "شیفت‌لاگ", key: "log", width: 9 }, { header: "کامل‌شده", key: "closed", width: 9 },
    { header: "فعالیت انجام‌شده", key: "done", fmt: "int" }, { header: "کل فعالیت", key: "total", fmt: "int" }, { header: "انجام روتین", key: "routine", fmt: "pct" },
    { header: "IOC", key: "iocs", fmt: "int", width: 8 }, { header: "گزارش ترافیک", key: "report", width: 11 }, { header: "Issue", key: "issues", fmt: "int", width: 8 }, { header: "تیکت (تعداد)", key: "tickets", fmt: "int" },
  ], rows);
}

function rawTickets(wb, facts, range, people) {
  addTable(wb, "تیکت روزانه", [
    { header: "کارشناس", key: "person", width: 22 }, { header: "تاریخ", key: "date", width: 12 }, { header: "تاریخ میلادی", key: "iso", width: 12 }, { header: "تعداد تیکت", key: "n", fmt: "int" },
  ], facts.tickets.filter((t) => t.date >= range.from && t.date <= range.end).map((t) => ({ person: people.get(t.a)?.name ?? t.a, date: jl(t.date), iso: t.date, n: t.n })));
}

function alertsSheet(wb, facts, range, cmp) {
  const alerts = buildAlerts(facts, { range, cmp });
  const insights = buildInsights(facts, { range, cmp });
  const ws = addTable(wb, "هشدارها و بینش‌ها", [
    { header: "نوع", key: "type", width: 10 }, { header: "سطح", key: "level", width: 14 }, { header: "متن", key: "text", width: 70 }, { header: "جزئیات", key: "detail", width: 50 },
  ], [
    ...alerts.map((a) => ({ type: "هشدار", level: ALERT_LEVELS[a.level].fa, text: a.title, detail: [a.detail, ...a.items.slice(0, 20).map((i) => `${i.label} (${i.sub})`)].filter(Boolean).join("\n") })),
    ...insights.map((i) => ({ type: "بینش", level: i.attention ? "قابل توجه" : "", text: i.text, detail: "" })),
  ]);
  ws.getColumn(4).alignment = { wrapText: true, vertical: "top" };
}

/**
 * Builds the analytics workbook.
 * kind "full": everything on screen plus raw data; "teams": teams, levels and members; "person": one expert.
 */
export async function analyticsWorkbook({ kind = "full", facts, filters, range, cmp, viewer, personId }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sentinel Ops";
  wb.created = new Date();
  const gran = filters.g === "auto" ? autoGranularity(range.days) : filters.g;
  const people = new Map(facts.people.map((p) => [p.id, p]));
  guideSheet(wb);
  filtersSheet(wb, { filters, range, cmp, facts, viewer, gran });

  if (kind === "person") {
    const p = people.get(personId);
    const team = facts.people.filter((x) => x.group === p.group);
    const medians = facts.peers?.range ?? (team.length > 1 ? Object.fromEntries(Object.keys(METRICS).map((k) => [k, peerMedian(facts, team, range, k)])) : null);
    summarySheet(wb, facts, range, cmp, { ids: [p.id], medians });
    const inRange = (d) => d && d >= range.from && d <= range.end;
    rawTasks(wb, facts, range, people, "تسک‌های تکمیل‌شده", (t) => t.a === p.id && inRange(t.completed));
    rawTasks(wb, facts, range, people, "تسک‌های باز", (t) => t.a === p.id && OPEN_STATUSES.includes(t.status));
    trendSheet(wb, facts, [p.id], range, cmp, gran);
    if (p.shift) {
      const own = { ...facts, shifts: facts.shifts.filter((s) => s.a === p.id), tickets: facts.tickets.filter((t) => t.a === p.id) };
      rawShifts(wb, own, range, people);
      rawTickets(wb, own, range, people);
    }
  } else if (kind === "teams") {
    teamsSheet(wb, facts, range, cmp);
    levelsSheet(wb, facts, range, cmp);
    peopleSheet(wb, facts, range, cmp, "اعضا");
  } else {
    summarySheet(wb, facts, range, cmp);
    alertsSheet(wb, facts, range, cmp);
    teamsSheet(wb, facts, range, cmp);
    levelsSheet(wb, facts, range, cmp);
    peopleSheet(wb, facts, range, cmp);
    trendSheet(wb, facts, null, range, cmp, gran);
    rawTasks(wb, facts, range, people);
    rawShifts(wb, facts, range, people);
    rawTickets(wb, facts, range, people);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const workbookName = (kind, range, demo) => {
  const j = (iso) => jl(iso).replaceAll("/", "-");
  return `Sentinel_Analytics_${kind}${demo ? "_DEMO" : ""}_${j(range.from)}_${j(range.end)}.xlsx`;
};
