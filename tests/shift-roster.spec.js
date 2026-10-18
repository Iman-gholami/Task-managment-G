// @ts-check
const { test, expect } = require("@playwright/test");

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

});
