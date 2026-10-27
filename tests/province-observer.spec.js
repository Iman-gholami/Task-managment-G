const { test, expect } = require("@playwright/test");
const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PW = "ProvinceObserver2026!";

test("province member setup and observer access to provincial analytics, but not writes", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();

  // The creation form provides all 31 provinces, including Qom.
  await page.goto("/team");
  await page.getByRole("button", { name: "Add member" }).click();
  const dialog = page.getByRole("dialog", { name: "Add member" });
  const province = dialog.getByLabel("استان");
  await expect(province.locator("option")).toHaveCount(32);
  await dialog.getByLabel("Full name").fill("Qom Provincial Analyst");
  await dialog.getByLabel("Work email").fill("qom@province-analytics.test");
  await dialog.getByLabel("Primary team").selectOption("SOC · L1");
  await dialog.getByLabel("Initial password").fill(PW);
  await dialog.getByRole("button", { name: "Add member" }).click();
  await expect(dialog).toContainText("استان");
  await province.selectOption("قم");
  await dialog.getByRole("button", { name: "Add member" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("tr", { hasText: "Qom Provincial Analyst" })).toContainText("قم");

  const t = await page.request.post("/api/members", { data: {
    name: "Tehran Provincial Analyst", email: "tehran@province-analytics.test",
    role: "analyst", team: "SOC · L2", password: PW, province: "تهران",
  } });
  expect(t.status()).toBe(201);
  const qomId = (await (await page.request.get("/api/members")).json()).users.find((u) => u.email === "qom@province-analytics.test").id;
  const edit = await page.request.patch(`/api/members/${qomId}`, { data: { province: "اصفهان" } });
  expect(edit.status()).toBe(200);
  expect((await edit.json()).user.province).toBe("اصفهان");
  expect((await page.request.patch(`/api/members/${qomId}`, { data: { province: "مریخ" } })).status()).toBe(400);
  expect((await page.request.patch(`/api/members/${qomId}`, { data: { province: "قم" } })).status()).toBe(200);
  expect((await page.request.post("/api/members", { data: {
    name: "Invalid Province", email: "invalid@province-analytics.test",
    role: "analyst", team: "SOC · L1", password: PW, province: "Unknown",
  } })).status()).toBe(400);

  const observer = await page.request.post("/api/members", { data: {
    name: "Readonly Observer", email: "observer@province-analytics.test",
    role: "observer", team: "Security Department", province: "قم", password: PW,
  } });
  expect(observer.status()).toBe(201);
  const obs = (await observer.json()).user;
  expect(obs.role).toBe("observer");

  await page.request.post("/api/auth/login", { data: { email: "observer@province-analytics.test", password: PW } });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/analytics/);
  await expect(page.locator(".sidebar")).toContainText("نظارت و ارزیابی");
  await expect(page.locator(".sidebar")).not.toContainText("Shift Schedule");
  await expect(page.locator(".sidebar")).not.toContainText("Administration");
  await page.goto("/analytics/people");
  await page.getByRole("combobox", { name: "استان" }).selectOption("قم");
  await expect(page).toHaveURL(/province=/);
  await expect(page.getByTestId("people-table")).toContainText("Qom Provincial Analyst");
  await expect(page.getByTestId("people-table")).not.toContainText("Tehran Provincial Analyst");
  await expect(page.getByText("سوابق ارزیابی ماهانه شیفت‌لاگ")).toBeVisible();
  await page.getByRole("combobox", { name: "استان" }).selectOption("تهران");
  await expect(page.getByTestId("people-table")).toContainText("Tehran Provincial Analyst");
  await expect(page.getByTestId("people-table")).not.toContainText("Qom Provincial Analyst");

  const reports = await page.request.get("/api/reports/team?period=this");
  expect(reports.status()).toBe(200);
  expect((await page.request.get("/api/performance")).status()).toBe(200);
  const apiFacts = await page.request.get("/api/analytics");
  expect(apiFacts.status()).toBe(200);
  expect((await apiFacts.json()).scope.kind).toBe("department");
  const exported = await page.request.get("/api/analytics/export?kind=full&province=%D9%82%D9%85");
  expect(exported.status()).toBe(200);
  expect(exported.headers()["content-type"]).toContain("spreadsheetml");
  expect((await page.request.post("/api/tasks", { data: { title: "Not allowed", a: obs.id } })).status()).toBe(403);
  expect((await page.request.post("/api/members", { data: { name: "Not allowed" } })).status()).toBe(403);
  expect((await page.request.post("/api/shift/schedule", {
    data: { userId: qomId, date: "2026-11-01", shiftType: "morning" },
  })).status()).toBe(403);
  expect((await page.request.put("/api/shift/reviews", { data: {} })).status()).toBe(403);
});
