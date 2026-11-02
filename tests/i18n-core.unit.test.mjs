import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLocale, translate } from "../lib/i18n/messages.js";
import { taskDate, parseTaskDate } from "../lib/task-date.js";
import { provinceLabel, roleLabel, teamLabel } from "../lib/i18n/labels.js";
import { buckets, comparisonRange, resolveRange } from "../lib/analytics/periods.js";
import { change, fmtDays, fmtNum, fmtPct } from "../lib/analytics/format.js";
import { shiftActivityText } from "../lib/i18n/shift-content.js";
import { mockFacts } from "../lib/analytics/mock.js";
import { buildAlerts } from "../lib/analytics/alerts.js";
import { buildInsights } from "../lib/analytics/insights.js";
import { addDays } from "../lib/analytics/calendar.js";

test("interface translation supports both selected languages", () => {
  assert.equal(normalizeLocale("fa"), "fa");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("unexpected"), "en");
  assert.equal(translate("fa", "Create task"), "ایجاد تسک");
  assert.equal(translate("en", "استان"), "Province");
});

test("Solar Hijri task dates keep the same ISO day across locales", () => {
  const iso = "2026-03-21";
  assert.equal(taskDate(iso, "en"), "1405/01/01");
  assert.equal(taskDate(iso, "fa"), "۱۴۰۵/۰۱/۰۱");
  assert.equal(parseTaskDate(taskDate(iso, "fa")).iso, iso);
});

test("localizing fixed organization labels leaves canonical values and unknown text intact", () => {
  assert.equal(provinceLabel("قم", "en"), "Qom");
  assert.equal(provinceLabel("قم", "fa"), "قم");
  assert.equal(roleLabel("observer", "en"), "Observer");
  assert.equal(roleLabel("soc_manager", "fa"), "مدیر SOC");
  assert.equal(teamLabel("Design & Automation", "fa"), "طراحی و اتوماسیون");
  assert.equal(teamLabel("Custom team", "fa"), "Custom team");
  assert.equal(provinceLabel("user-entered text", "en"), "user-entered text");
});

test("analytics periods retain the same Jalali boundaries in English and Persian", () => {
  const fa = resolveRange({ p: "month" }, "2026-03-21", "fa");
  const en = resolveRange({ p: "month" }, "2026-03-21", "en");
  assert.deepEqual([en.from, en.to, en.end], [fa.from, fa.to, fa.end]);
  assert.equal(en.label, "Farvardin 1405");
  assert.equal(fa.label, "فروردین ۱۴۰۵");
  assert.equal(comparisonRange(en, "yoy", "en").short, "Last year");
  assert.equal(buckets(en.from, en.end, "day", "en")[0].label, "1 Farvardin");
});

test("analytics numbers and change labels follow the chosen language", () => {
  assert.equal(fmtNum(1234.5, 1, "en"), "1,234.5");
  assert.equal(fmtNum(1234.5, 1, "fa"), "۱٬۲۳۴٫۵");
  assert.equal(fmtPct(0.5, 0, "en"), "50%");
  assert.equal(fmtDays(1, "en"), "1 day");
  assert.equal(change(1, 1, "count", "en").text, "No change");
});

test("only unchanged built-in shift activities are translated", () => {
  const title = "Review Logged Incidents in Splunk Incident Review";
  assert.equal(shiftActivityText({ itemId: 4, legacyN: 1, title }, {}, "fa").title, "بررسی رخدادهای ثبت‌شده در Splunk Incident Review");
  assert.equal(shiftActivityText({ itemId: 4, legacyN: 1, title: "My edited activity" }, {}, "fa").title, "My edited activity");
  assert.equal(shiftActivityText({ itemId: 99, title }, {}, "fa").title, title);
  const engineering = { itemId: -301, title: "Manage and maintain security systems", hint: "Review platform health and perform routine maintenance" };
  assert.equal(shiftActivityText(engineering, { builtIn: true }, "fa").title, "مدیریت و نگهداری سامانه‌های امنیتی");
  assert.equal(shiftActivityText(engineering, { builtIn: false }, "fa").title, engineering.title);
});

test("English analytics alerts and insights keep their values and person-authored text", () => {
  const today = "2026-10-06";
  const facts = mockFacts({ today, window: { from: addDays(today, -371), to: today } });
  facts.people.forEach((person, index) => { person.name = `Person ${index}`; });
  facts.tasks.forEach((task) => { task.title = "User task title"; });
  const range = resolveRange({ p: "month" }, today, "en");
  const cmp = comparisonRange(range, "prev", "en");
  const alerts = buildAlerts(facts, { range, cmp, locale: "en" });
  const insights = buildInsights(facts, { range, cmp, locale: "en" });
  assert.ok(alerts.length > 0);
  assert.ok(insights.length > 0);
  for (const alert of alerts) {
    assert.doesNotMatch(`${alert.title} ${alert.detail ?? ""} ${alert.items.map((item) => item.sub ?? "").join(" ")}`, /[\u0600-\u06ff]/);
    for (const item of alert.items.filter((item) => item.kind === "task")) assert.match(item.label, /User task title/);
  }
  for (const insight of insights) assert.doesNotMatch(insight.text, /[\u0600-\u06ff]/);
});
