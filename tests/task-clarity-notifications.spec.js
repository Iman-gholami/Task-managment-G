const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PASSWORD = "Task-Clarity-2026!";

async function login(context, account) {
  const response = await context.request.post("/api/auth/login", { data: account });
  expect(response.status()).toBe(200);
  return (await response.json()).user;
}

test("a SOC manager's review shows the eligible security manager and cannot be self-approved", async ({ page }) => {
  await login(page, ADMIN);
  const member = await page.request.post("/api/members", { data: { name: "Journey SOC manager", email: "journey-soc@example.invalid", password: PASSWORD, role: "soc_manager", team: "SOC" } });
  expect(member.status()).toBe(201);
  const soc = (await member.json()).user;
  await login(page, { email: soc.email, password: PASSWORD });
  const created = await page.request.post("/api/tasks", { data: { title: "SOC manager investigation", a: soc.id } });
  const task = (await created.json()).task;
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "progress" } })).status()).toBe(200);
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "review", hours: 2, report: { workPerformed: "Checked the logs", outcome: "Completed", revision: 0 } } })).status()).toBe(200);
  await page.goto(`/tasks/${task.id}`);
  const journey = page.getByRole("region", { name: "Task progress" });
  await expect(journey).toContainText("Manager review");
  await expect(journey).toContainText("E2E Administrator");
  await expect(journey).toContainText("no individual is assigned");
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "done", quality: "good" } })).status()).toBe(409);
});

test("a Solar Hijri deadline can be typed and chosen with the calendar", async ({ page }) => {
  const admin = await login(page, ADMIN);
  const created = await page.request.post("/api/tasks", { data: { title: "Solar calendar task", a: admin.id, due: "2026-03-21" } });
  const task = (await created.json()).task;
  await page.goto(`/tasks/${task.id}`);
  await page.getByText("Task overview & activity").click();
  const date = page.getByLabel("Deadline (Solar Hijri)");
  await expect(date).toHaveValue("1405/01/01");
  await date.fill("۱۴۰۵/۰۱/۰۲");
  await date.press("Tab");
  await expect.poll(async () => (await (await page.request.get(`/api/tasks/${task.id}`)).json()).task.due).toBe("2026-03-22");
  await page.getByRole("button", { name: "Choose deadline" }).click();
  const calendar = page.getByRole("dialog", { name: "Choose deadline" });
  await calendar.getByRole("button", { name: "Farvardin 3, 1405" }).click();
  await expect.poll(async () => (await (await page.request.get(`/api/tasks/${task.id}`)).json()).task.due).toBe("2026-03-23");
  await expect(date).toHaveValue("1405/01/03");
});

test("a new assignment refreshes the recipient's open page and shows one desktop notification", async ({ page, browser, baseURL }) => {
  await login(page, ADMIN);
  const member = await page.request.post("/api/members", { data: { name: "Desktop notification analyst", email: "desktop-notice@example.invalid", password: PASSWORD, role: "analyst", team: "SOC · L1" } });
  const analyst = (await member.json()).user;
  const context = await browser.newContext({ baseURL });
  try {
    await login(context, { email: analyst.email, password: PASSWORD });
    await context.addInitScript(() => {
      window.testNotifications = [];
      window.Notification = class {
        static permission = "granted";
        constructor(title, options) { window.testNotifications.push({ title, body: options.body }); }
        close() {}
      };
    });
    const recipient = await context.newPage();
    const firstPoll = recipient.waitForResponse((response) => response.url().endsWith("/api/task-assignments"));
    await recipient.goto("/tasks/my");
    await firstPoll;
    const created = await page.request.post("/api/tasks", { data: { title: "New desktop assignment", a: analyst.id } });
    expect(created.status()).toBe(201);
    await expect.poll(async () => {
      await recipient.evaluate(() => window.dispatchEvent(new Event("focus")));
      return recipient.evaluate(() => window.testNotifications.length);
    }).toBe(1);
    await expect(recipient.getByText("New desktop assignment")).toBeVisible();
    await expect.poll(() => recipient.evaluate(() => window.testNotifications[0].body)).toContain("New desktop assignment");
    await recipient.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => recipient.evaluate(() => window.testNotifications.length)).toBe(1);
  } finally { await context.close(); }
});
