import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDigits, parseNumber, searchKey, toLocaleDigits } from "../lib/i18n/digits.js";
import {
  addDays, addMonths, diffDays, fromYmd, isIsoDay, isLeapYear, isWeekend, monthEnd, monthGrid, monthLength, monthStart,
  parseTimestamp, quarterEnd, quarterStart, tehranParts, todayIso, weekStart, weekdayIndex, yearEnd, yearStart, ymd,
} from "../lib/i18n/dates.js";
import { createFormat } from "../lib/i18n/format.js";
import { createT } from "../lib/i18n/index.js";
import dates from "../lib/i18n/messages/dates.js";
import { tehranDate } from "../lib/shifts.js";
import {
  buckets, comparisonLabel, comparisonRange, granularityLabel, presetLabel, resolveRange,
} from "../lib/analytics/periods.js";
import { DEFAULTS, FILTER_KEYS, filterQuery, parseFilters } from "../lib/analytics/filters.js";

const J = "jalali", G = "gregorian";
const fa = createFormat("fa");
const en = createFormat("en");
const j = (y, m, d) => fromYmd(y, m, d, J);

// ---- Calendar math ------------------------------------------------------------------

test("Jalali conversions agree with Intl's persian calendar (cross-check in the test only)", () => {
  const intl = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });
  const parts = (iso) => {
    const p = Object.fromEntries(intl.formatToParts(new Date(`${iso}T00:00:00Z`)).map((x) => [x.type, x.value]));
    return { y: parseInt(p.year, 10), m: Number(p.month), d: Number(p.day) };
  };
  for (const iso of ["2025-03-20", "2025-03-21", "2026-02-20", "2026-03-20", "2026-03-21", "2026-10-06", "2026-12-21", "2024-02-29", "2030-03-20"]) {
    assert.deepEqual(ymd(iso, J), parts(iso), iso);
  }
  // Every day of 2024–2027, both ways.
  for (let iso = "2024-01-01"; iso <= "2027-12-31"; iso = addDays(iso, 1)) {
    const v = ymd(iso, J);
    assert.deepEqual(v, parts(iso), iso);
    assert.equal(fromYmd(v.y, v.m, v.d, J), iso);
  }
});

test("Jalali leap years: Esfand has 30 days in 1403 and 29 in 1404; day 30 clamps", () => {
  assert.equal(isLeapYear(1403, J), true);
  assert.equal(isLeapYear(1404, J), false);
  assert.equal(monthLength(1403, 12, J), 30);
  assert.equal(monthLength(1404, 12, J), 29);
  assert.equal(monthLength(1405, 6, J), 31);
  assert.equal(monthLength(1405, 7, J), 30);
  assert.equal(j(1403, 12, 30), "2025-03-20");
  assert.equal(j(1404, 12, 30), j(1404, 12, 29));
  assert.equal(j(1404, 12, 29), "2026-03-20");
  assert.equal(j(1405, 1, 1), "2026-03-21");
  assert.equal(addMonths(j(1403, 12, 30), 12, J), j(1404, 12, 29));
});

test("Gregorian leap years: February has 29 days in 2024 and 28 in 2026", () => {
  assert.equal(isLeapYear(2024, G), true);
  assert.equal(isLeapYear(2026, G), false);
  assert.equal(isLeapYear(1900, G), false);
  assert.equal(isLeapYear(2000, G), true);
  assert.equal(monthLength(2024, 2, G), 29);
  assert.equal(monthLength(2026, 2, G), 28);
  assert.equal(fromYmd(2026, 2, 29, G), "2026-02-28");
  assert.equal(fromYmd(2024, 2, 29, G), "2024-02-29");
  assert.equal(addMonths("2026-01-31", 1, G), "2026-02-28");
  assert.equal(addMonths("2024-01-31", 1, G), "2024-02-29");
  assert.equal(addMonths("2024-02-29", -12, G), "2023-02-28");
});

test("months overflow into neighbouring years in both calendars", () => {
  assert.equal(fromYmd(2026, 13, 1, G), "2027-01-01");
  assert.equal(fromYmd(2026, 0, 15, G), "2025-12-15");
  assert.equal(j(1405, 13, 1), j(1406, 1, 1));
  assert.equal(j(1405, 0, 1), j(1404, 12, 1));
  assert.equal(addMonths(j(1405, 1, 10), -1, J), j(1404, 12, 10));
  assert.deepEqual(ymd("2026-10-06", G), { y: 2026, m: 10, d: 6 });
  assert.deepEqual(ymd("2026-10-06", J), { y: 1405, m: 7, d: 14 });
  assert.equal(isIsoDay("2026-02-28"), true);
  assert.equal(isIsoDay("2026-02-29"), false);
  assert.equal(isIsoDay("2026-2-28"), false);
});

test("month starts and ends in both calendars", () => {
  assert.equal(monthStart("2026-10-06", J), "2026-09-23");
  assert.equal(monthEnd("2026-10-06", J), "2026-10-22");
  assert.equal(monthEnd(j(1403, 12, 5), J), "2025-03-20");
  assert.equal(monthEnd(j(1404, 12, 5), J), "2026-03-20");
  assert.equal(monthStart("2026-10-06", G), "2026-10-01");
  assert.equal(monthEnd("2026-10-06", G), "2026-10-31");
  assert.equal(monthEnd("2024-02-10", G), "2024-02-29");
  assert.equal(monthEnd("2026-02-10", G), "2026-02-28");
  assert.equal(yearStart("2026-10-06", J), "2026-03-21");
  assert.equal(yearEnd("2026-10-06", J), j(1405, 12, 29));
  assert.equal(yearStart("2026-10-06", G), "2026-01-01");
  assert.equal(yearEnd("2026-10-06", G), "2026-12-31");
});

test("quarter boundaries: Jalali seasons and Gregorian quarters", () => {
  assert.equal(quarterStart(j(1405, 5, 15), J), j(1405, 4, 1));
  assert.equal(quarterEnd(j(1405, 5, 15), J), j(1405, 6, 31));
  assert.equal(quarterStart("2026-10-06", J), j(1405, 7, 1)); // autumn
  assert.equal(quarterEnd(j(1403, 11, 1), J), "2025-03-20"); // winter ends on Esfand 30 in a leap year
  assert.equal(quarterEnd(j(1404, 11, 1), J), "2026-03-20"); // and on Esfand 29 otherwise
  assert.equal(quarterStart("2026-05-15", G), "2026-04-01");
  assert.equal(quarterEnd("2026-05-15", G), "2026-06-30");
  assert.equal(quarterStart("2026-12-31", G), "2026-10-01");
  assert.equal(quarterEnd("2026-01-01", G), "2026-03-31");
});

test("the week starts on Saturday and Friday is the weekend", () => {
  assert.equal(weekdayIndex("2026-10-03"), 0); // Saturday
  assert.equal(weekdayIndex("2026-10-09"), 6); // Friday
  assert.equal(weekStart("2026-10-08"), "2026-10-03");
  assert.equal(weekStart("2026-10-03"), "2026-10-03");
  assert.equal(weekStart("2026-10-09"), "2026-10-03");
  assert.equal(isWeekend("2026-10-09"), true);
  assert.equal(isWeekend("2026-10-08"), false); // Thursday
  assert.equal(isWeekend("2026-10-10"), false);
  assert.equal(diffDays("2026-10-01", "2026-10-14"), 13);
});

test("month grid: 42 days, Saturday first, the whole month inside", () => {
  for (const [y, m, cal] of [[1405, 7, J], [1404, 12, J], [1403, 12, J], [2026, 2, G], [2024, 2, G], [2026, 8, G]]) {
    const grid = monthGrid(y, m, cal);
    assert.equal(grid.length, 42);
    assert.equal(weekdayIndex(grid[0]), 0);
    for (let i = 1; i < 42; i++) assert.equal(diffDays(grid[i - 1], grid[i]), 1);
    const first = fromYmd(y, m, 1, cal), last = fromYmd(y, m, monthLength(y, m, cal), cal);
    assert.ok(grid.includes(first) && grid.includes(last), `${y}-${m} ${cal}`);
  }
  assert.equal(monthGrid(1405, 7, J)[0], "2026-09-19");
  assert.equal(monthGrid(2026, 2, G)[0], "2026-01-31");
});

test("timestamps: stored UTC, shown in Tehran", () => {
  assert.equal(parseTimestamp("2026-10-13 20:45:00").toISOString(), "2026-10-13T20:45:00.000Z");
  assert.equal(parseTimestamp("2026-10-13T20:45:00").toISOString(), "2026-10-13T20:45:00.000Z");
  assert.equal(parseTimestamp("2026-10-13T20:45:00Z").getTime(), Date.UTC(2026, 9, 13, 20, 45));
  assert.equal(parseTimestamp(Date.UTC(2026, 9, 13)).getTime(), Date.UTC(2026, 9, 13));
  const d = new Date();
  assert.equal(parseTimestamp(d), d);
  assert.ok(Number.isNaN(parseTimestamp("not a date").getTime()));
  assert.ok(Number.isNaN(parseTimestamp(null).getTime()));
  assert.deepEqual(tehranParts("2026-10-13 20:45:00"), { date: "2026-10-14", hour: 0, minute: 15 });
  assert.deepEqual(tehranParts("2026-10-13 08:00:00"), { date: "2026-10-13", hour: 11, minute: 30 });
  assert.equal(tehranParts(""), null);
  assert.match(todayIso(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(todayIso(), tehranDate());
});

// ---- Digits -------------------------------------------------------------------------

test("digits: Persian, Arabic-Indic and Latin input", () => {
  assert.equal(normalizeDigits("۱۲۳۴۵۶۷۸۹۰"), "1234567890");
  assert.equal(normalizeDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789");
  assert.equal(normalizeDigits("۱۲٬۳۴۵٫۶"), "12345.6");
  assert.equal(normalizeDigits(null), "");
  assert.equal(parseNumber("۶٫۵"), 6.5);
  assert.equal(parseNumber("٣"), 3);
  assert.equal(parseNumber("12,345"), 12345);
  assert.equal(parseNumber(fa.number(-3.5)), -3.5);
  assert.equal(parseNumber(fa.number(12345)), 12345);
  assert.equal(parseNumber(7), 7);
  assert.ok(Number.isNaN(parseNumber("")));
  assert.ok(Number.isNaN(parseNumber("  ")));
  assert.ok(Number.isNaN(parseNumber("abc")));
  assert.equal(toLocaleDigits("12:30", "fa"), "۱۲:۳۰");
  assert.equal(toLocaleDigits("12:30", "en"), "12:30");
  assert.equal(toLocaleDigits(1405, "fa"), "۱۴۰۵");
});

test("search keys: T-۱۰۰۱ finds T-1001; Arabic letters, ZWNJ and diacritics do not matter", () => {
  assert.equal(searchKey("T-۱۰۰۱"), searchKey("t-1001"));
  assert.ok(searchKey("Investigate T-1001 alert").includes(searchKey("T-۱۰۰۱")));
  assert.equal(searchKey("T-١٠٠١"), "t-1001");
  assert.equal(searchKey("علي"), searchKey("علی"));
  assert.equal(searchKey("كار"), searchKey("کار"));
  assert.equal(searchKey("تسک‌ها"), searchKey("تسکها"));
  assert.equal(searchKey("مـــدیر"), searchKey("مدیر"));
  assert.equal(searchKey("مُدیر"), searchKey("مدیر"));
  assert.equal(searchKey("  SOC   Manager "), "soc manager");
});

// ---- Formatting ---------------------------------------------------------------------

test("numbers and percentages in both languages", () => {
  assert.equal(fa.locale, "fa");
  assert.equal(fa.calendar, J);
  assert.equal(en.calendar, G);
  assert.equal(createFormat("fa"), fa); // cached
  assert.equal(createFormat("xx"), fa); // unknown language → Persian
  assert.equal(fa.number(6.5), "۶٫۵");
  assert.equal(fa.number(1234), "۱۲۳۴"); // grouping only from five digits
  assert.equal(fa.number(12345), "۱۲٬۳۴۵");
  assert.equal(en.number(1234), "1234");
  assert.equal(en.number(12345.67), "12,345.7");
  assert.equal(en.number(2.5, { digits: 2, min: 2 }), "2.50");
  assert.equal(en.number(3, { signed: true }), "+3");
  assert.equal(en.number(-0.01), "0");
  assert.equal(en.int(4.6), "5");
  assert.equal(en.decimal(1.234, 2), "1.23");
  for (const v of [null, undefined, NaN, "x"]) {
    assert.equal(fa.number(v), "—");
    assert.equal(en.percent(v), "—");
  }
  assert.equal(fa.percent(0.85), "۸۵٪");
  assert.equal(en.percent(0.85), "85%");
  assert.equal(en.percent(0.853, 1), "85.3%");
  assert.equal(fa.digits("T-12"), "T-۱۲");
  assert.equal(en.digits("T-12"), "T-12");
});

test("month and weekday names follow the language's calendar; weekday 0 is Saturday", () => {
  assert.equal(fa.monthName(1), "فروردین");
  assert.equal(fa.monthName(12), "اسفند");
  assert.equal(en.monthName(1), "January");
  assert.equal(en.monthName(12, { short: true }), "Dec");
  assert.equal(fa.weekdayName(0), "شنبه");
  assert.equal(fa.weekdayName(3), "سه‌شنبه");
  assert.equal(fa.weekdayName(6, { narrow: true }), "ج");
  assert.equal(en.weekdayName(0), "Saturday");
  assert.equal(en.weekdayName(6, { short: true }), "Fri");
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((i) => en.weekdayName(i, { narrow: true })).join(""), "SSMTWTF");
});

test("dates in every style", () => {
  const faCases = { short: "۱۴ مهر", medium: "۱۴ مهر ۱۴۰۵", long: "سه‌شنبه ۱۴ مهر ۱۴۰۵", numeric: "۱۴۰۵/۰۷/۱۴", monthYear: "مهر ۱۴۰۵", weekdayShort: "سه‌شنبه ۱۴ مهر" };
  for (const [style, text] of Object.entries(faCases)) assert.equal(fa.date("2026-10-06", style), text, style);
  const enCases = { short: "Oct 14", medium: "Oct 14, 2026", long: "Wednesday, October 14, 2026", numeric: "2026-10-14", monthYear: "October 2026", weekdayShort: "Wed, Oct 14" };
  for (const [style, text] of Object.entries(enCases)) assert.equal(en.date("2026-10-14", style), text, style);
  assert.equal(fa.date("2026-10-06"), "۱۴ مهر ۱۴۰۵"); // medium by default
  assert.equal(fa.date(j(1404, 12, 29)), "۲۹ اسفند ۱۴۰۴");
  assert.equal(en.date("2024-02-29"), "Feb 29, 2024");
  assert.equal(fa.date("2026-10-13 20:45:00", "short"), "۲۲ مهر"); // a timestamp shows its Tehran day
  assert.equal(fa.date(null), "—");
  assert.equal(en.date("—"), "—");
});

test("ranges: same day, same month, same year and across years", () => {
  assert.equal(fa.range(j(1405, 7, 1), j(1405, 7, 14)), "۱ تا ۱۴ مهر ۱۴۰۵");
  assert.equal(fa.range(j(1405, 6, 25), j(1405, 7, 14)), "۲۵ شهریور تا ۱۴ مهر ۱۴۰۵");
  assert.equal(fa.range(j(1404, 12, 20), j(1405, 1, 10)), "۲۰ اسفند ۱۴۰۴ تا ۱۰ فروردین ۱۴۰۵");
  assert.equal(fa.range("2026-10-06", "2026-10-06"), "۱۴ مهر ۱۴۰۵");
  assert.equal(en.range("2026-10-01", "2026-10-14"), "Oct 1 – 14, 2026");
  assert.equal(en.range("2026-09-25", "2026-10-14"), "Sep 25 – Oct 14, 2026");
  assert.equal(en.range("2025-12-20", "2026-01-10"), "Dec 20, 2025 – Jan 10, 2026");
  assert.equal(en.range("2026-10-14", "2026-10-14"), "Oct 14, 2026");
  // The same days are one Jalali month but two Gregorian ones.
  assert.equal(en.range("2026-09-23", "2026-10-22"), "Sep 23 – Oct 22, 2026");
  assert.equal(fa.range("2026-09-23", "2026-10-22"), "۱ تا ۳۰ مهر ۱۴۰۵");
  assert.equal(fa.range(null, null), "—");
});

test("times and date-times in Tehran", () => {
  assert.equal(fa.time("2026-10-13 20:45:00"), "۰۰:۱۵");
  assert.equal(en.time("2026-10-13 08:00:00"), "11:30");
  assert.equal(fa.time("7:30"), "۰۷:۳۰");
  assert.equal(en.time(null), "—");
  assert.equal(en.dateTime("2026-10-13 20:45:00"), "Oct 14, 2026, 00:15");
  assert.equal(fa.dateTime("2026-10-13 08:00:00"), "۲۱ مهر ۱۴۰۵، ۱۱:۳۰");
});

test("relative times", () => {
  const now = Date.parse("2026-10-13T12:00:00Z"); // 15:30 in Tehran
  const cases = [
    ["2026-10-13 11:59:30", "همین حالا", "just now"],
    ["2026-10-13 11:59:00", "۱ دقیقه پیش", "1 minute ago"],
    ["2026-10-13 11:55:00", "۵ دقیقه پیش", "5 minutes ago"],
    ["2026-10-13 09:00:00", "۳ ساعت پیش", "3 hours ago"],
    ["2026-10-12 08:00:00", "دیروز", "yesterday"],
    ["2026-10-11 08:00:00", "۲ روز پیش", "2 days ago"],
    ["2026-10-07 08:00:00", "۶ روز پیش", "6 days ago"],
    ["2026-09-01 08:00:00", "۱۰ شهریور", "Sep 1"],
    ["2025-09-01 08:00:00", "۱۰ شهریور ۱۴۰۴", "Sep 1, 2025"],
    ["2026-10-14 12:00:00", "فردا", "tomorrow"],
  ];
  for (const [ts, faText, enText] of cases) {
    assert.equal(fa.relative(ts, now), faText, ts);
    assert.equal(en.relative(ts, now), enText, ts);
  }
  // "Now" may be a Date or a timestamp string too.
  assert.equal(en.relative("2026-10-13 11:00:00", new Date(now)), "1 hour ago");
  assert.equal(en.relative("2026-10-13 11:00:00", "2026-10-13 12:00:00"), "1 hour ago");
  assert.equal(en.relative(null, now), "—");
});

test("deadlines in words with a tone", () => {
  const today = "2026-10-13";
  const due = (fmt, iso, open = true) => fmt.due(iso, { open, today });
  assert.deepEqual(due(fa, "2026-10-10"), { text: "۳ روز تأخیر", tone: "overdue", days: -3 });
  assert.deepEqual(due(en, "2026-10-10"), { text: "3 days overdue", tone: "overdue", days: -3 });
  assert.equal(due(en, "2026-10-12").text, "1 day overdue");
  assert.deepEqual(due(fa, "2026-10-13"), { text: "امروز", tone: "soon", days: 0 });
  assert.deepEqual(due(en, "2026-10-13"), { text: "Due today", tone: "soon", days: 0 });
  assert.deepEqual(due(fa, "2026-10-14"), { text: "فردا", tone: "soon", days: 1 });
  assert.equal(due(en, "2026-10-14").text, "Due tomorrow");
  assert.deepEqual(due(en, "2026-10-15"), { text: "In 2 days", tone: "soon", days: 2 });
  assert.deepEqual(due(fa, "2026-10-18"), { text: "۵ روز دیگر", tone: "normal", days: 5 });
  assert.deepEqual(due(en, "2026-10-20"), { text: "In 7 days", tone: "normal", days: 7 });
  assert.deepEqual(due(en, "2026-10-30"), { text: "Oct 30", tone: "normal", days: 17 });
  assert.equal(due(fa, "2026-10-30").text, "۸ آبان");
  assert.equal(due(en, "2027-01-05").text, "Jan 5, 2027"); // another Gregorian year
  assert.equal(due(fa, "2027-01-05").text, "۱۵ دی"); // still 1405
  assert.deepEqual(due(en, "2026-10-10", false), { text: "Oct 10", tone: "normal", days: -3 });
  assert.deepEqual(due(fa, null), { text: "بدون ددلاین", tone: "none", days: null });
  assert.deepEqual(due(en, "—"), { text: "No deadline", tone: "none", days: null });
  assert.equal(en.due(todayIso()).text, "Due today"); // Tehran today by default
});

test("hours, days and lists", () => {
  assert.equal(fa.hours(6.5), "۶٫۵ ساعت");
  assert.equal(en.hours(6.5), "6.5 h");
  assert.equal(fa.days(2.5), "۲٫۵ روز");
  assert.equal(en.days(2.5), "2.5 days");
  assert.equal(en.days(1), "1 day");
  assert.equal(en.hours(null), "—");
  assert.equal(fa.days(undefined), "—");
  assert.equal(en.list(["Sara", "Arash", "Mina"]), "Sara, Arash, and Mina");
  assert.equal(fa.list(["سارا", "آرش"]), "سارا و آرش");
  assert.equal(en.list([]), "");
});

test("the dates dictionary has the same shape in both languages", () => {
  const shape = (o) => Object.entries(o).map(([k, v]) => (v && typeof v === "object" ? `${k}{${shape(v)}}` : k)).sort().join(",");
  assert.equal(shape(dates.fa), shape(dates.en));
  assert.equal(Object.keys(dates.fa.months).length, 12);
  assert.equal(Object.keys(dates.fa.weekdays).length, 7);
});

// ---- Periods ------------------------------------------------------------------------

test("periods resolve in the Jalali calendar by default, with Persian labels", () => {
  const r = resolveRange({ p: "month" }, "2026-10-06");
  assert.deepEqual([r.from, r.to, r.end, r.days, r.partial, r.unit, r.label, r.calendar], ["2026-09-23", "2026-10-22", "2026-10-06", 14, true, "month", "مهر ۱۴۰۵", J]);
  assert.equal(resolveRange({ p: "season" }, "2026-10-06").label, "پاییز ۱۴۰۵");
  const y = resolveRange({ p: "year" }, "2026-10-06");
  assert.deepEqual([y.from, y.to, y.label], ["2026-03-21", j(1405, 12, 29), "سال ۱۴۰۵"]);
  assert.equal(resolveRange({ p: "last-7" }, "2026-10-06").label, "۸ تا ۱۴ مهر ۱۴۰۵");
});

test("periods in the Gregorian calendar with English labels", () => {
  const opts = { calendar: G, locale: "en" };
  const r = resolveRange({ p: "month" }, "2026-10-06", opts);
  assert.deepEqual([r.from, r.to, r.end, r.days, r.partial, r.label, r.calendar], ["2026-10-01", "2026-10-31", "2026-10-06", 6, true, "October 2026", G]);
  const q = resolveRange({ p: "season" }, "2026-10-06", opts);
  assert.deepEqual([q.from, q.to, q.label], ["2026-10-01", "2026-12-31", "Q4 2026"]);
  const pq = resolveRange({ p: "prev-season" }, "2026-01-10", opts);
  assert.deepEqual([pq.from, pq.to, pq.days, pq.partial, pq.label], ["2025-10-01", "2025-12-31", 92, false, "Q4 2025"]);
  const y = resolveRange({ p: "year" }, "2026-10-06", opts);
  assert.deepEqual([y.from, y.to, y.label], ["2026-01-01", "2026-12-31", "2026"]);
  const pm = resolveRange({ p: "prev-month" }, "2024-03-10", opts);
  assert.deepEqual([pm.from, pm.to, pm.days, pm.label], ["2024-02-01", "2024-02-29", 29, "February 2024"]);
  // The language alone picks its calendar.
  assert.equal(resolveRange({ p: "month" }, "2026-10-06", { locale: "en" }).calendar, G);
  assert.equal(resolveRange({ p: "last-30" }, "2026-10-06", opts).label, "Sep 7 – Oct 6, 2026");
});

test("filters.cal wins over the viewer's calendar; other calendars are labelled with the exact range", () => {
  const r = resolveRange({ p: "month", cal: G }, "2026-10-06", { calendar: J, locale: "fa" });
  assert.deepEqual([r.from, r.to, r.calendar], ["2026-10-01", "2026-10-31", G]);
  assert.equal(r.label, "۹ مهر تا ۹ آبان ۱۴۰۵");
  const e = resolveRange({ p: "month", cal: J }, "2026-10-06", { calendar: G, locale: "en" });
  assert.deepEqual([e.from, e.to, e.label], ["2026-09-23", "2026-10-22", "Sep 23 – Oct 22, 2026"]);
  assert.equal(resolveRange({ p: "month", cal: "lunar" }, "2026-10-06", { calendar: G }).calendar, G);
});

test("explicit from/to pin the dates for any preset", () => {
  const rolling = resolveRange({ p: "last-30", from: "2026-09-01", to: "2026-09-10" }, "2026-10-06");
  assert.deepEqual([rolling.preset, rolling.from, rolling.to, rolling.days, rolling.unit, rolling.label], ["last-30", "2026-09-01", "2026-09-10", 10, null, "۱۰ تا ۱۹ شهریور ۱۴۰۵"]);
  // A shared "this month" link keeps showing the month it was made in, as a whole unit.
  const month = resolveRange({ p: "month", from: "2026-09-23", to: "2026-10-22", cal: J }, "2026-11-30", { locale: "en" });
  assert.deepEqual([month.from, month.to, month.days, month.partial, month.unit, month.label], ["2026-09-23", "2026-10-22", 30, false, "month", "Sep 23 – Oct 22, 2026"]);
  // Dates that are not exactly one unit lose the unit (the comparison then uses the days before).
  const odd = resolveRange({ p: "month", from: "2026-10-01", to: "2026-10-31" }, "2026-11-30");
  assert.deepEqual([odd.unit, odd.label], [null, "۹ مهر تا ۹ آبان ۱۴۰۵"]);
  const sameInGregorian = resolveRange({ p: "month", from: "2026-10-01", to: "2026-10-31", cal: G }, "2026-11-30", { locale: "en" });
  assert.deepEqual([sameInGregorian.unit, sameInGregorian.label], ["month", "October 2026"]);
  // Reversed or invalid dates are ignored.
  assert.equal(resolveRange({ p: "last-7", from: "2026-10-10", to: "2026-10-01" }, "2026-10-06").from, "2026-09-30");
  assert.equal(resolveRange({ p: "custom", from: "2026-02-30", to: "2026-03-05" }, "2026-10-06").preset, "month");
  const custom = resolveRange({ p: "custom", from: "2026-09-25", to: "2026-10-14" }, "2026-10-06", { locale: "en" });
  assert.deepEqual([custom.preset, custom.end, custom.days, custom.partial, custom.label], ["custom", "2026-10-06", 12, true, "Sep 25 – Oct 14, 2026"]);
});

test("comparisons are like for like across a year boundary in both calendars", () => {
  // Farvardin 1405, ten days in → the first ten days of Esfand 1404.
  const far = resolveRange({ p: "month" }, j(1405, 1, 10));
  assert.deepEqual([far.from, far.days, far.label], [j(1405, 1, 1), 10, "فروردین ۱۴۰۵"]);
  const c = comparisonRange(far, "prev");
  assert.deepEqual([c.from, c.to, c.days, c.label, c.short], [j(1404, 12, 1), j(1404, 12, 10), 10, "۱۰ روز اول اسفند ۱۴۰۴", "دورهٔ قبل"]);
  // A whole Farvardin (31 days) against the whole Esfand of a common year (29 days).
  const fullFar = resolveRange({ p: "prev-month" }, j(1405, 2, 5));
  const esfand = comparisonRange(fullFar, "prev");
  assert.deepEqual([esfand.from, esfand.to, esfand.days, esfand.label], [j(1404, 12, 1), j(1404, 12, 29), 29, "اسفند ۱۴۰۴"]);
  // January 2026, ten days in → the first ten days of December 2025.
  const opts = { calendar: G, locale: "en" };
  const jan = resolveRange({ p: "month" }, "2026-01-10", opts);
  const dec = comparisonRange(jan, "prev", opts);
  assert.deepEqual([dec.from, dec.to, dec.days, dec.label, dec.short], ["2025-12-01", "2025-12-10", 10, "First 10 days of December 2025", "Previous period"]);
  // The range's calendar decides the step, whatever the options say.
  assert.equal(comparisonRange(jan, "prev", { calendar: J, locale: "en" }).from, "2025-12-01");
  // Quarters step back across the year too.
  const q1 = resolveRange({ p: "season" }, "2026-02-15", opts);
  const q4 = comparisonRange(q1, "prev", opts);
  assert.deepEqual([q4.from, q4.to, q4.label], ["2025-10-01", addDays("2025-10-01", q1.days - 1), `First ${q1.days} days of Q4 2025`]);
  // Year over year: the same calendar dates a year earlier (Feb 29 → Feb 28, Esfand 30 → Esfand 29).
  const leapDay = resolveRange({ p: "custom", from: "2024-02-29", to: "2024-02-29" }, "2024-03-01", opts);
  const yoy = comparisonRange(leapDay, "yoy", opts);
  assert.deepEqual([yoy.from, yoy.to, yoy.label, yoy.short], ["2023-02-28", "2023-02-28", "Same period last year", "Last year"]);
  const esfand30 = resolveRange({ p: "custom", from: j(1403, 12, 30), to: j(1403, 12, 30) }, "2025-04-01");
  assert.equal(comparisonRange(esfand30, "yoy").from, j(1402, 12, 29));
  // Rolling ranges: the same number of days immediately before.
  const last = comparisonRange(resolveRange({ p: "last-30" }, "2026-01-10", opts), "prev", opts);
  assert.deepEqual([last.to, last.days, last.label], ["2025-12-11", 30, "The 30 days before"]);
  assert.equal(comparisonRange(resolveRange({ p: "last-30" }, "2026-01-10"), "prev").label, "۳۰ روز قبل از آن");
  assert.equal(comparisonRange(jan, "none", opts), null);
});

test("buckets: Gregorian months and quarters, Saturday weeks in both calendars", () => {
  const opts = { calendar: G, locale: "en" };
  const months = buckets("2026-01-01", "2026-12-31", "month", opts);
  assert.equal(months.length, 12);
  assert.ok(months.every((m) => !m.partial));
  assert.deepEqual([months[1].from, months[1].to, months[1].label], ["2026-02-01", "2026-02-28", "February 2026"]);
  const quarters = buckets("2025-11-15", "2026-04-10", "season", opts);
  assert.deepEqual(quarters.map((q) => [q.from, q.to, q.label, q.partial]), [
    ["2025-11-15", "2025-12-31", "Q4 2025", true],
    ["2026-01-01", "2026-03-31", "Q1 2026", false],
    ["2026-04-01", "2026-04-10", "Q2 2026", true],
  ]);
  for (const o of [opts, {}]) {
    const weeks = buckets("2026-09-23", "2026-10-13", "week", o);
    assert.equal(weeks[0].partial, true); // starts on a Wednesday
    assert.deepEqual(weeks.map((w) => w.from), ["2026-09-23", "2026-09-26", "2026-10-03", "2026-10-10"]);
    assert.ok(weeks.slice(1).every((w) => weekdayIndex(w.from) === 0));
    assert.equal(weeks.at(-1).partial, true); // ends on a Tuesday
  }
  assert.equal(buckets("2026-10-03", "2026-10-09", "week", opts)[0].label, "Week of Oct 3");
  assert.equal(buckets("2026-10-03", "2026-10-09", "week")[0].label, "هفتهٔ ۱۱ مهر");
  assert.equal(buckets("2026-10-05", "2026-10-06", "day", opts)[1].label, "Oct 6");
  assert.deepEqual(buckets("2025-06-01", "2026-06-01", "year", opts).map((b) => b.label), ["2025", "2026"]);
  assert.deepEqual(buckets(j(1404, 6, 1), j(1405, 2, 1), "year").map((b) => b.label), ["۱۴۰۴", "۱۴۰۵"]);
  // Jalali months across the new year.
  assert.deepEqual(buckets(j(1404, 12, 1), j(1405, 1, 31), "month").map((b) => b.label), ["اسفند ۱۴۰۴", "فروردین ۱۴۰۵"]);
  assert.equal(buckets("2026-01-01", "2026-01-20", "auto", opts)[0].to, "2026-01-01"); // auto → days
});

test("preset, comparison and granularity labels in both languages", () => {
  const tFa = createT("fa"), tEn = createT("en");
  assert.equal(presetLabel(tFa, "month"), "ماه جاری");
  assert.equal(presetLabel(tFa, "last-365"), "۱۲ ماه اخیر");
  assert.equal(presetLabel(tEn, "prev-month"), "Last month");
  assert.equal(presetLabel(tEn, "season"), "This quarter");
  assert.equal(presetLabel("en", "custom"), "Custom range");
  assert.equal(comparisonLabel(tEn, "yoy"), "Same period last year");
  assert.equal(comparisonLabel(tFa, "none"), "بدون مقایسه");
  assert.equal(granularityLabel(tEn, "week"), "Weekly");
  assert.equal(granularityLabel(tFa, "season"), "فصلی");
  assert.equal(presetLabel(tEn, "unknown"), "unknown");
});

// ---- Filters ------------------------------------------------------------------------

test("filters: cal follows to; presets keep pinned dates; custom links stay p=custom&from&to", () => {
  assert.deepEqual(FILTER_KEYS.slice(0, 5), ["p", "from", "to", "cal", "cmp"]);
  assert.equal(DEFAULTS.cal, "");

  const preset = parseFilters(new URLSearchParams("p=month&from=2026-10-01&to=2026-10-31&cal=gregorian&cmp=yoy"));
  assert.deepEqual([preset.p, preset.from, preset.to, preset.cal, preset.cmp], ["month", "2026-10-01", "2026-10-31", G, "yoy"]);
  assert.equal(filterQuery(preset), "p=month&from=2026-10-01&to=2026-10-31&cal=gregorian&cmp=yoy");
  assert.deepEqual(parseFilters(new URLSearchParams(filterQuery(preset))), preset);
  const r = resolveRange(preset, "2026-11-20", { calendar: J, locale: "fa" });
  assert.deepEqual([r.from, r.to, r.calendar, r.unit], ["2026-10-01", "2026-10-31", G, "month"]);

  const custom = parseFilters(new URLSearchParams("p=custom&from=2026-09-01&to=2026-09-30&cal=jalali&team=da"));
  assert.equal(custom.cal, "");
  assert.equal(filterQuery(custom), "p=custom&from=2026-09-01&to=2026-09-30&team=da");
  // Even an unparsed object never puts anything between p, from and to of a custom range.
  const raw = filterQuery({ ...DEFAULTS, p: "custom", from: "2026-09-01", to: "2026-09-30", cal: G, cmp: "none" });
  assert.equal(raw, "p=custom&from=2026-09-01&to=2026-09-30&cmp=none");
  assert.match(raw, /^p=custom&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}(&|$)/);

  // No preset in the URL → no calendar; a default preset with a calendar still names itself.
  assert.equal(parseFilters(new URLSearchParams("cal=gregorian")).cal, "");
  assert.equal(parseFilters(new URLSearchParams("p=nope&cal=gregorian")).cal, "");
  assert.equal(parseFilters({ p: "month", cal: "lunar" }).cal, "");
  assert.equal(filterQuery({ ...DEFAULTS, cal: G }), "p=month&cal=gregorian");
  assert.equal(filterQuery({ ...DEFAULTS, team: "soc" }), "team=soc");
  assert.equal(filterQuery(parseFilters(new URLSearchParams(""))), "");

  // Dates must come as a valid, ordered pair.
  assert.equal(parseFilters({ p: "month", from: "2026-01-01" }).from, "");
  const reversed = parseFilters({ p: "last-30", from: "2026-10-10", to: "2026-10-01" });
  assert.deepEqual([reversed.from, reversed.to], ["", ""]);
  assert.equal(parseFilters({ p: "custom", from: "2026-02-30", to: "2026-03-05" }).from, "");
  const kept = parseFilters({ p: "last-30", from: "2026-09-01", to: "2026-09-10" });
  assert.deepEqual([kept.from, kept.to], ["2026-09-01", "2026-09-10"]);
  assert.equal(filterQuery(kept), "p=last-30&from=2026-09-01&to=2026-09-10");
});
