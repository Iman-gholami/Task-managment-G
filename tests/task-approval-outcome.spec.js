const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PASSWORD = "Approval-Outcome-2026!";

async function readyForReview(page, suffix) {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
  const member = await page.request.post("/api/members", { data: {
    name: `Outcome Analyst ${suffix}`, email: `outcome-${suffix}@test.invalid`, password: PASSWORD, role: "analyst", team: "SOC · L1",
  } });
  expect(member.status()).toBe(201);
  const analyst = (await member.json()).user;
  const created = await page.request.post("/api/tasks", { data: { title: `Review outcome ${suffix}`, a: analyst.id, cx: 2 } });
  expect(created.status()).toBe(201);
  const task = (await created.json()).task;
  expect((await page.request.post("/api/auth/login", { data: { email: analyst.email, password: PASSWORD } })).ok()).toBeTruthy();
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "progress" } })).ok()).toBeTruthy();
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "review", hours: 2.5 } })).ok()).toBeTruthy();
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
  await page.goto(`/tasks/${task.id}`);
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeEnabled();
  return { analyst, task };
}

async function chooseReview(page) {
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  // The page enters with a short animation; wait for its layout to settle before
  // opening a scroll-dismissed popover.
  await page.locator(".detail-main").evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})));
  });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("menu", { name: "Approve with quality" }).getByRole("menuitem", { name: /Good/ }).click();
  await page.getByRole("menu", { name: "Confirm complexity" }).getByRole("menuitemradio", { name: /Medium/ }).click();
}

test("approval is confirmed before showing a lasting outcome, and reopening clears it", async ({ page }) => {
  const { analyst, task } = await readyForReview(page, "pending");
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route(`**/api/tasks/${task.id}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    await gate;
    return route.continue();
  });

  await chooseReview(page);
  await expect(page.getByRole("button", { name: "Approving…" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Task approved" })).toHaveCount(0);
  release();

  const outcome = page.getByRole("status", { name: "Task approval" });
  await expect(outcome.getByRole("heading", { name: "Task approved" })).toBeVisible();
  await expect(outcome).toContainText("Good");
  await expect(outcome).toContainText("E2E Administrator");
  await expect(outcome).toContainText("2.5 hrs");
  await expect(outcome).toContainText("Completed");
  await expect(page.getByRole("button", { name: "Reopen" })).toHaveClass(/btn-secondary/);
  await page.reload();
  await expect(outcome).toContainText("E2E Administrator");
  await expect(outcome).toContainText("Good");

  await page.getByRole("button", { name: "Reopen", exact: true }).click();
  await expect(outcome).toHaveCount(0);
  await expect(page.locator(".detail-side .status").first()).toHaveText("In Progress");
  await expect.poll(async () => (await (await page.request.get(`/api/tasks/${task.id}`)).json()).details.approvedBy).toBeNull();

  const second = await page.request.post("/api/members", { data: {
    name: "Second Reviewer", email: "second-reviewer@outcome.test", password: PASSWORD, role: "soc_manager", team: "SOC",
  } });
  expect(second.status()).toBe(201);
  const reviewer = (await second.json()).user;
  expect((await page.request.post("/api/auth/login", { data: { email: analyst.email, password: PASSWORD } })).ok()).toBeTruthy();
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "review" } })).ok()).toBeTruthy();
  expect((await page.request.post("/api/auth/login", { data: { email: reviewer.email, password: PASSWORD } })).ok()).toBeTruthy();
  await page.goto(`/tasks/${task.id}`);
  await chooseReview(page);
  await expect(outcome).toContainText("Second Reviewer");
  await expect(outcome).not.toContainText("E2E Administrator");
  expect((await (await page.request.get(`/api/tasks/${task.id}`)).json()).details.approvedBy).toBe(reviewer.id);
});

test("a rejected approval never shows a successful outcome", async ({ page }) => {
  const { task } = await readyForReview(page, "rejected");
  await page.route(`**/api/tasks/${task.id}`, (route) => route.request().method() === "PATCH"
    ? route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Approval denied" }) })
    : route.continue());
  await chooseReview(page);
  await expect(page.getByRole("alert").filter({ hasText: "Approval denied" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Task approved" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeEnabled();
  expect((await (await page.request.get(`/api/tasks/${task.id}`)).json()).task.status).toBe("review");
});

test("a lost approval response is checked before the outcome is shown", async ({ page }) => {
  const { task } = await readyForReview(page, "lost-response");
  let patches = 0;
  await page.route(`**/api/tasks/${task.id}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    patches += 1;
    await route.fetch();
    await route.abort("failed");
  });
  await chooseReview(page);
  const outcome = page.getByRole("status", { name: "Task approval" });
  await expect(outcome.getByRole("heading", { name: "Task approved" })).toBeVisible();
  await expect(outcome).toContainText("E2E Administrator");
  expect(patches).toBe(1);
  expect((await (await page.request.get(`/api/tasks/${task.id}`)).json()).task.status).toBe("done");
});

test("a manager can still reopen their own review-exempt task", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", { data: ADMIN });
  expect(login.ok()).toBeTruthy();
  const manager = (await login.json()).user;
  const created = await page.request.post("/api/tasks", { data: {
    title: "Manager's own task", a: manager.id, reviewRequired: false,
  } });
  expect(created.status()).toBe(201);
  const task = (await created.json()).task;
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Complete task", exact: true }).click();
  await page.getByRole("dialog", { name: "Review completion" }).getByRole("button", { name: "Confirm completion" }).click();
  const outcome = page.getByRole("status", { name: "Task completion" });
  await expect(outcome).toContainText("Completed · No review required");
  await expect(outcome).not.toContainText("Approved by");
  await page.getByRole("button", { name: "Reopen", exact: true }).click();
  await expect(outcome).toHaveCount(0);
  await expect(page.locator(".detail-side .status").first()).toHaveText("In Progress");
});
