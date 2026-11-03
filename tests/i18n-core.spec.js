const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };

test("language persists, changes direction and preserves a user-authored task title", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", { data: ADMIN });
  expect(login.status()).toBe(200);
  const admin = (await login.json()).user;
  // Deliberately use a word that also appears in product-owned copy.
  const created = await page.request.post("/api/tasks", { data: { title: "Work", a: admin.id, due: "2026-03-21" } });
  expect(created.status()).toBe(201);
  const task = (await created.json()).task;
  await page.goto(`/tasks/${task.id}`);

  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
  await expect(page.getByText("شرح تسک", { exact: true })).toBeVisible();
  await expect(page.locator(".task-deadline").first()).toContainText("۱۴۰۵/۰۱/۰۱");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByText("Task brief", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
});

test("dashboard and analytics load in both languages after switching", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/dashboard");
  await expect(page.locator("h1")).toHaveText("Security Department");
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("واحد امنیت");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  for (const path of ["/analytics/alerts", "/analytics/trends", "/analytics/soc", "/analytics/report"]) {
    await page.goto(`${path}?demo=1`);
    await expect(page.locator(".an-body")).toBeVisible();
  }
  await page.goto("/analytics/alerts?demo=1");
  await expect(page.locator("h1")).toHaveText("هشدارها و بینش‌ها");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Alerts and insights");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Alert rules" })).toBeVisible();
  for (const path of ["/analytics/trends", "/analytics/soc", "/analytics/report"]) {
    await page.goto(`${path}?demo=1`);
    await expect(page.locator(".an-body")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("report and checklist screens localize while preserving authored content", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", { data: ADMIN });
  const admin = (await login.json()).user;
  expect((await page.request.post("/api/tasks", { data: { title: "I18N report sentinel", description: "Simple", a: admin.id } })).status()).toBe(201);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/reports/task");
  await expect(page.getByRole("heading", { name: "Task Report", exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "I18N report sentinel" })).toContainText("Simple");
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.getByRole("heading", { name: "گزارش تسک‌ها", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "عنوان تسک" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "I18N report sentinel" })).toContainText("Simple");
  await page.goto("/shift/checklists");
  await expect(page.locator("h1")).toHaveText("چک‌لیست‌های گزارش شیفت");
  await expect(page.getByRole("button", { name: "چک‌لیست جدید", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Shift Log checklists");
  expect(errors).toEqual([]);
});

test("both language layouts remain usable on desktop and mobile", async ({ page, baseURL }, testInfo) => {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
  for (const [locale, direction] of [["en", "ltr"], ["fa", "rtl"]]) {
    await page.context().addCookies([{ name: "so.locale", value: locale, url: baseURL }]);
    for (const [size, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto("/dashboard");
      await expect(page.locator("html")).toHaveAttribute("dir", direction);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".metrics").first()).toBeVisible();
      if (process.env.CI) await page.screenshot({ path: testInfo.outputPath(`dashboard-${locale}-${size}.png`), fullPage: true });
    }
  }
});
