import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLocale, translate } from "../lib/i18n/messages.js";
import { taskDate, parseTaskDate } from "../lib/task-date.js";

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
