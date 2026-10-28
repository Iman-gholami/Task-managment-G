// @ts-check
const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PASSWORD = "Calendar-View-2026!";

function tehranDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

test("an analyst can scan, highlight and select shifts with the keyboard", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
  const people = [
    { name: "آرزو تقویم", email: "calendar-a@test.invalid" },
    { name: "سامان تقویم", email: "calendar-b@test.invalid" },
  ];
  const ids = [];
  const date = tehranDate();
  for (const person of people) {
    const res = await page.request.post("/api/members", { data: { ...person, password: PASSWORD, role: "analyst", team: "SOC · L1" } });
    expect(res.status()).toBe(201);
    ids.push((await res.json()).user.id);
  }
  for (const [userId, shiftType] of [[ids[0], "morning"], [ids[1], "night"]]) {
    const res = await page.request.post("/api/shift/schedule", { data: { userId, date, shiftType } });
    expect(res.status()).toBe(201);
  }

  expect((await page.request.post("/api/auth/login", { data: { email: people[0].email, password: PASSWORD } })).ok()).toBeTruthy();
  await page.goto("/shift/schedule");
  const calendar = page.getByRole("region", { name: "تقویم ماهانه" });
  const overview = page.getByRole("complementary", { name: "نمای کلی روز" });
  await expect(overview.getByRole("region", { name: "شیفت صبح" })).toContainText(people[0].name);
  await expect(overview.getByRole("region", { name: "شیفت شب" })).toContainText(people[1].name);
  await expect(page.getByRole("button", { name: "ثبت شیفت", exact: true })).toHaveCount(0);

  const selectedDay = calendar.locator('div[role="button"][aria-pressed="true"]');
  const dayLabel = await selectedDay.getAttribute("aria-label");
  const todayCell = calendar.getByRole("button", { name: dayLabel, exact: true });
  const morning = todayCell.locator('button[data-shift="morning"]');
  const night = todayCell.locator('button[data-shift="night"]');
  await page.getByLabel("آمار و شیفت کارشناس").selectOption(ids[0]);
  await expect(morning).toHaveAttribute("data-selected-person", "true");
  await expect(night).toHaveAttribute("data-dim", "true");

  await calendar.locator('div[role="button"][aria-pressed="false"]').first().click({ position: { x: 8, y: 8 } });
  await expect(todayCell).toHaveAttribute("aria-pressed", "false");
  await morning.focus();
  await morning.press("Enter");
  await expect(todayCell).toHaveAttribute("aria-pressed", "true");
  await expect(overview.getByRole("region", { name: "شیفت صبح" })).toContainText(people[0].name);

  const originalMonth = await calendar.getByRole("heading", { level: 2 }).innerText();
  await calendar.getByRole("button", { name: "ماه بعد" }).click();
  await expect(calendar.getByRole("heading", { level: 2 })).not.toHaveText(originalMonth);
  await calendar.getByRole("button", { name: "امروز", exact: true }).click();
  await expect(calendar.getByRole("heading", { level: 2 })).toHaveText(originalMonth);
  await expect(todayCell).toHaveAttribute("aria-pressed", "true");

  // Leave the shared test database clean for later roster and reporting tests.
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
  for (const userId of ids) {
    expect((await page.request.delete("/api/shift/schedule", { data: { userId, date } })).ok()).toBeTruthy();
    expect((await page.request.delete(`/api/members/${userId}`)).ok()).toBeTruthy();
  }
});

test("a failed schedule load is not presented as an empty roster and can be retried", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
  let fail = true;
  await page.route("**/api/shift/schedule?*", async (route) => {
    if (!fail) return route.continue();
    fail = false;
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary failure" }) });
  });
  await page.goto("/shift/schedule");
  await expect(page.getByText("دریافت برنامه شیفت ناموفق بود.")).toBeVisible();
  const overview = page.getByRole("complementary", { name: "نمای کلی روز" });
  await expect(overview).toContainText("برای دیدن برنامه روز، دوباره تلاش کنید.");
  await expect(overview).not.toContainText("ثبت نشده");
  await expect(page.getByRole("button", { name: "ثبت شیفت", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "ثبت تعطیلی مرکز" })).toBeDisabled();
  await page.getByRole("button", { name: "تلاش دوباره" }).click();
  await expect(page.getByRole("button", { name: "ثبت شیفت", exact: true })).toBeEnabled();
  await expect(overview.getByRole("region", { name: "شیفت صبح" })).toBeVisible();
});
