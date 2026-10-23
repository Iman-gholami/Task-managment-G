// @ts-check
const { test, expect } = require("@playwright/test");
const ExcelJS = require("exceljs");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const USER_PASSWORD = "Shift-Roster-2026!";

function tehranDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

test("a manager sets all three shifts with one save, including a Design engineer", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", { data: ADMIN });
  expect(login.ok()).toBeTruthy();

  const people = [
    { name: "Rosta L1 Roster", email: "l1@shift-roster.test", role: "analyst", team: "SOC · L1" },
    { name: "Rosta L2 Roster", email: "l2@shift-roster.test", role: "analyst", team: "SOC · L2" },
    { name: "Rosta Design Engineer", email: "design@shift-roster.test", role: "engineer", team: "Design & Automation" },
    { name: "Rosta Free Analyst", email: "free@shift-roster.test", role: "analyst", team: "SOC · L1" },
    { name: "Rosta Spare Analyst", email: "spare@shift-roster.test", role: "analyst", team: "SOC · L1" },
  ];
  const ids = {};
  for (const person of people) {
    const response = await page.request.post("/api/members", { data: { ...person, password: USER_PASSWORD } });
    expect(response.status()).toBe(201);
    ids[person.email] = (await response.json()).user.id;
  }

  await page.goto("/shift/schedule");
  await page.getByRole("button", { name: "ثبت شیفت", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "ثبت شیفت" });

  await dialog.locator("label").filter({ hasText: "Rosta L1 Roster" }).locator("input[type=checkbox]").check();
  await dialog.getByRole("radio", { name: /تا ۸/ }).click();
  await dialog.locator("label").filter({ hasText: "Rosta Design Engineer" }).locator("input[type=checkbox]").check();
  await dialog.getByRole("radio", { name: /شیفت شب/ }).click();
  await dialog.locator("label").filter({ hasText: "Rosta L2 Roster" }).locator("input[type=checkbox]").check();
  await dialog.getByRole("radio", { name: /شیفت صبح/ }).click();
  await expect(dialog.locator("label").filter({ hasText: "Rosta L1 Roster" }).locator("input[type=checkbox]")).toBeChecked();

  await dialog.getByRole("button", { name: "ذخیره برنامه روز" }).click();
  await expect(dialog).toHaveCount(0);

  // The day overview shows all three working shifts without cycling through tabs.
  const overview = page.locator('aside[aria-label="نمای کلی روز"]');
  await expect(overview.locator('section[aria-label="شیفت صبح"]')).toContainText("Rosta L1 Roster");
  await expect(overview.locator('section[aria-label="شیفت شب"]')).toContainText("Rosta L2 Roster");
  await expect(overview.locator('section[aria-label="شیفت تا ۸ شب"]')).toContainText("Rosta Design Engineer");

  const date = tehranDate();
  const result = await page.request.get(`/api/shift/schedule?from=${date}&to=${date}`);
  expect(result.ok()).toBeTruthy();
  const schedule = (await result.json()).schedules;
  expect(schedule.find((s) => s.userId === ids["l1@shift-roster.test"])?.shiftType).toBe("morning");
  expect(schedule.find((s) => s.userId === ids["l2@shift-roster.test"])?.shiftType).toBe("night");
  expect(schedule.find((s) => s.userId === ids["design@shift-roster.test"])?.shiftType).toBe("evening");

  await page.request.post("/api/auth/login", {
    data: { email: "design@shift-roster.test", password: USER_PASSWORD },
  });
  const logResponse = await page.request.get("/api/shift");
  expect(logResponse.ok()).toBeTruthy();
  const log = await logResponse.json();
  expect(log.shiftType).toBe("evening");
  expect(log.team).toBe("SOC · L3");
  expect(log.activities).toHaveLength(8);
  await page.goto("/shift");
  await expect(page.getByText(/Shift Log —/)).toBeVisible();

  // Re-open the same date and replace work assignments with off/leave,
  // while retaining the unrelated night shift.
  await page.request.post("/api/auth/login", { data: ADMIN });
  await page.goto("/shift/schedule");
  await page.getByRole("button", { name: "ثبت شیفت", exact: true }).first().click();
  const edit = page.getByRole("dialog", { name: "ثبت شیفت" });
  await edit.getByRole("radio", { name: /تعطیل شیفت/ }).click();
  await edit.locator("label").filter({ hasText: "Rosta L1 Roster" }).locator("input[type=checkbox]").check();
  await edit.getByRole("radio", { name: /مرخصی/ }).click();
  await edit.locator("label").filter({ hasText: "Rosta Design Engineer" }).locator("input[type=checkbox]").check();
  await edit.getByRole("button", { name: "ذخیره برنامه روز" }).click();
  await expect(edit).toHaveCount(0);

  const after = (await (await page.request.get(`/api/shift/schedule?from=${date}&to=${date}`)).json()).schedules;
  expect(after.find((row) => row.userId === ids["l1@shift-roster.test"])?.shiftType).toBe("off");
  expect(after.find((row) => row.userId === ids["design@shift-roster.test"])?.shiftType).toBe("leave");
  expect(after.find((row) => row.userId === ids["l2@shift-roster.test"])?.shiftType).toBe("night");
  // Morning candidates put occupied night, off and leave users below available users.
  await page.goto("/shift/schedule");
  await page.getByRole("button", { name: "ثبت شیفت", exact: true }).first().click();
  const picker = page.getByRole("dialog", { name: "ثبت شیفت" });
  const statuses = await picker.locator("label[data-status]").evaluateAll(
    (rows) => rows.map((row) => row.dataset.status)
  );
  expect(statuses.slice(-3)).toEqual(["night", "off", "leave"]);

  // Bulk select applies to search results, without stealing another assignment.
  await picker.getByRole("searchbox", { name: "جستجوی کارشناس" }).fill("Rosta Free Analyst");
  await picker.getByRole("button", { name: /انتخاب همه/ }).click();
  await picker.getByRole("searchbox", { name: "جستجوی کارشناس" }).fill("");
  await expect(picker.locator('label[data-status="available"]').filter({ hasText: "Rosta Spare Analyst" }).locator("input")).not.toBeChecked();
  await picker.getByRole("button", { name: /انتخاب همه/ }).click();
  await picker.getByRole("button", { name: "ذخیره برنامه روز" }).click();
  await expect(picker).toHaveCount(0);
  const bulkSaved = (await (await page.request.get("/api/shift/schedule?from=" + date + "&to=" + date)).json()).schedules;
  for (const email of ["free@shift-roster.test", "spare@shift-roster.test"]) {
    expect(bulkSaved.find((row) => row.userId === ids[email])?.shiftType).toBe("morning");
  }
  expect(bulkSaved.find((row) => row.userId === ids["l2@shift-roster.test"])?.shiftType).toBe("night");
  expect(bulkSaved.find((row) => row.userId === ids["l1@shift-roster.test"])?.shiftType).toBe("off");
  expect(bulkSaved.find((row) => row.userId === ids["design@shift-roster.test"])?.shiftType).toBe("leave");


  await page.request.post("/api/auth/login", {
    data: { email: "design@shift-roster.test", password: USER_PASSWORD },
  });
  expect((await page.request.get("/api/shift")).status()).toBe(404);
  await page.goto("/shift");
  await expect(page.getByRole("heading", { name: /امروز برای شما.*مرخصی/ })).toBeVisible();


  // The center may be closed but staff can be on duty; marked red in the calendar.
  await page.request.post("/api/auth/login", { data: ADMIN });
  await page.goto("/shift/schedule");
  await page.getByRole("button", { name: "ثبت تعطیلی مرکز" }).click();
  const holidayDialog = page.getByRole("dialog", { name: "تعطیلی مرکز" });
  await holidayDialog.getByLabel("علت تعطیلی (اختیاری)").fill("تعطیلی مرکز با کشیک");
  await holidayDialog.getByRole("button", { name: "تأیید تعطیلی مرکز" }).click();
  await expect(holidayDialog).toHaveCount(0);
  const panel = page.locator('aside[aria-label="نمای کلی روز"]');
  await expect(panel).toContainText("تعطیلی مرکز با کشیک");
  await expect(panel.locator('section[aria-label="شیفت شب"]')).toContainText("Rosta L2 Roster");
  await expect(page.getByRole("button", { name: "ثبت شیفت", exact: true }).first()).toBeEnabled();
  const data = await page.request.get("/api/shift/schedule?from=" + date + "&to=" + date);
  expect((await data.json()).centerHolidays).toEqual([expect.objectContaining({ date, note: "تعطیلی مرکز با کشیک" })]);
  await page.getByRole("button", { name: "برداشتن تعطیلی مرکز" }).click();
  await page.getByRole("dialog", { name: "تعطیلی مرکز" }).getByRole("button", { name: "برداشتن تعطیلی" }).click();
  await expect(panel).not.toContainText("تعطیلی مرکز با کشیک");
  // Upload two Excel files; the preview must flag one conflicting row and
  // preserve that date while applying the other two days atomically.
  const serial = (iso) => (Date.parse(iso + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 864e5;
  const plus = (n) => new Date(Date.parse(date + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  const firstDate = plus(3), badDate = plus(4), secondDate = plus(5);
  const makeFile = async (rows) => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("برنامه شیفت");
    sheet.addRow(["تاریخ", "روز", "حضور تا ساعت 20", "حضور عادی", "تعطیل شیفت", "مرخصی", "توضیحات"]);
    for (const row of rows) sheet.addRow(row);
    return Buffer.from(await book.xlsx.writeBuffer());
  };
  const files = [
    { name: "roster-01.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await makeFile([
        [serial(firstDate), serial(firstDate), "Rosta Free Analyst", "Rosta L2 Roster", "Rosta L1 Roster", "Rosta Design Engineer", "تعطیلی مرکز"],
        [serial(badDate), serial(badDate), "Rosta Spare Analyst", "Rosta Spare Analyst", "", "", ""],
      ]) },
    { name: "roster-02.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await makeFile([
        [serial(secondDate), serial(secondDate), "", "Rosta Spare Analyst", "", "", ""],
      ]) },
  ];
  await page.getByRole("button", { name: "ورود از اکسل" }).click();
  const importDialog = page.getByRole("dialog", { name: "ورود شیفت از اکسل" });
  await importDialog.locator('input[type="file"]').setInputFiles(files);
  await importDialog.getByRole("button", { name: "بررسی و پیش‌نمایش" }).click();
  await expect(importDialog).toContainText("روز شناسایی شد");
  await importDialog.getByRole("button", { name: /ثبت.*روز در تقویم/ }).click();
  await expect(importDialog).toHaveCount(0);
  const fetchDay = async (targetDate) => (await (await page.request.get(
    "/api/shift/schedule?from=" + targetDate + "&to=" + targetDate
  )).json());
  const imported = await fetchDay(firstDate);
  expect(imported.centerHolidays[0].date).toBe(firstDate);
  expect(imported.schedules.find((r) => r.userId === ids["free@shift-roster.test"]).shiftType).toBe("evening");
  expect(imported.schedules.find((r) => r.userId === ids["l2@shift-roster.test"]).shiftType).toBe("morning");
  expect((await fetchDay(badDate)).schedules).toHaveLength(0);
  expect((await fetchDay(secondDate)).schedules.find((r) => r.userId === ids["spare@shift-roster.test"]).shiftType).toBe("morning");


});
