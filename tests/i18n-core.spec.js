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
