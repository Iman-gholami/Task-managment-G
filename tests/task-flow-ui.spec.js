const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PASSWORD = "Task-Flow-UI-2026!";

async function login(page, account) { expect((await page.request.post("/api/auth/login", { data: account })).ok()).toBeTruthy(); }
async function setup(page, suffix, options = {}) {
  await login(page, ADMIN);
  const result = await page.request.post("/api/members", { data: {
    name: `Flow analyst ${suffix}`, email: `flow-${suffix}@example.invalid`, password: PASSWORD, role: "analyst", team: "SOC · L1",
  } });
  expect(result.status()).toBe(201);
  const analyst = (await result.json()).user;
  const response = await page.request.post("/api/tasks", { data: { title: `Investigate ${suffix}`, a: analyst.id, ...options } });
  expect(response.status()).toBe(201);
  return { analyst, task: (await response.json()).task };
}

test("the analyst fills one report and a manager returns and approves it", async ({ page }) => {
  const { analyst, task } = await setup(page, "cycle");
  await login(page, { email: analyst.email, password: PASSWORD });
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your task journey" })).toBeVisible();
  await page.getByLabel(/What did you do/).fill("Reviewed the firewall and proxy logs.");
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(page.getByLabel(/What was the outcome/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/What did you do/)).toHaveValue("Reviewed the firewall and proxy logs.");
  await page.getByRole("button", { name: /Outcome & evidence/ }).click();
  await page.getByLabel(/What was the outcome/).fill("No malicious activity found.");
  await page.getByTestId("attach-input").setInputFiles({ name: "evidence.txt", mimeType: "text/plain", buffer: Buffer.from("sample evidence") });
  await expect(page.getByRole("link", { name: /evidence\.txt/ })).toBeVisible();
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByLabel(/Total hours/).fill("۲٫۵");
  await page.getByRole("button", { name: /Review submission/ }).click();
  await expect(page.getByText("Reviewed the firewall and proxy logs.")).toBeVisible();
  await expect(page.getByText("2.5 hrs")).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();

  await login(page, ADMIN);
  await page.goto(`/tasks/${task.id}`);
  await expect(page.getByRole("heading", { name: "Review the submitted work" })).toBeVisible();
  await expect(page.getByText("No malicious activity found.")).toBeVisible();
  await expect(page.getByRole("link", { name: /evidence\.txt/ })).toBeVisible();
  await page.getByRole("button", { name: "Return for changes" }).click();
  await page.getByRole("button", { name: "Send back" }).click();
  await expect(page.getByText("Enter a reason for returning the task.")).toBeVisible();
  await page.getByLabel(/What needs to change/).fill("Please attach the relevant source logs.");
  await page.getByRole("button", { name: "Send back" }).click();
  await expect(page.getByText("Returned for changes")).toBeVisible();

  await login(page, { email: analyst.email, password: PASSWORD });
  await page.goto(`/tasks/${task.id}`);
  await expect(page.getByLabel("Your work").getByText("Please attach the relevant source logs.")).toBeVisible();
  await page.getByRole("button", { name: "Resume work" }).click();
  await expect(page.getByLabel(/What did you do/)).toHaveValue("Reviewed the firewall and proxy logs.");
  await page.getByRole("button", { name: /Outcome & evidence/ }).click();
  await page.getByLabel(/What was the outcome/).fill("Scheduled scan verified with source logs.");
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByLabel(/Total hours/).fill("3");
  await page.getByRole("button", { name: /Review submission/ }).click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();

  await login(page, ADMIN);
  await page.goto(`/tasks/${task.id}`);
  await expect(page.getByText("Scheduled scan verified with source logs.")).toBeVisible();
  await page.getByRole("radio", { name: "Good", exact: true }).check();
  await page.getByLabel("Confirm complexity").selectOption("3");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("status", { name: "Task approval" })).toContainText("Good");
  const result = await (await page.request.get(`/api/tasks/${task.id}`)).json();
  expect(result.task).toMatchObject({ status: "done", quality: "good", cx: 3, hours: 3 });
  expect(result.details.report.outcome).toBe("Scheduled scan verified with source logs.");
  expect(result.details.reviewReturns[0].reason).toBe("Please attach the relevant source logs.");
});

test("required fields, direct completion, and a narrow screen", async ({ page }) => {
  const { analyst, task } = await setup(page, "mobile", { reviewRequired: false });
  await login(page, { email: analyst.email, password: PASSWORD });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: /Time spent/ }).click();
  await page.getByRole("button", { name: /Review submission/ }).click();
  await expect(page.getByText("Describe the work performed before sending.")).toBeVisible();
  await page.getByLabel(/What did you do/).fill("Checked the ticket.");
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByLabel(/What was the outcome/).fill("Resolved.");
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByLabel(/Total hours/).fill("0.5");
  await page.getByRole("button", { name: /Review submission/ }).click();
  await expect(page.getByText("0.5 hrs")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Complete task" }).click();
  await expect(page.getByRole("status", { name: "Task completion" })).toContainText("No review required");
});

test("unsaved report changes are protected when navigating away", async ({ page }) => {
  const { analyst, task } = await setup(page, "unsaved");
  await login(page, { email: analyst.email, password: PASSWORD });
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByLabel(/What did you do/).fill("Unsaved work in progress");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Unsaved work report" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel(/What did you do/)).toHaveValue("Unsaved work in progress");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved")).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/tasks/${task.id}`);
  await expect(page.getByLabel(/What did you do/)).toHaveValue("Unsaved work in progress");
});

test("a return started from the task list opens the reason workflow", async ({ page }) => {
  const { analyst, task } = await setup(page, "list-return");
  await login(page, { email: analyst.email, password: PASSWORD });
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "progress" } })).ok()).toBeTruthy();
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "review", hours: 1, report: { workPerformed: "Checked logs", outcome: "Completed", revision: 0 } } })).ok()).toBeTruthy();
  await login(page, ADMIN);
  await page.goto("/tasks/assigned");
  await page.getByRole("tab", { name: /Needs review/ }).click();
  await page.locator("tr", { hasText: task.id }).locator('[data-edit="status"]').click();
  await page.getByRole("menuitem", { name: /Return for changes/ }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
  await page.getByRole("button", { name: "Return for changes" }).click();
  await page.getByLabel(/What needs to change/).fill("Add the original logs.");
  await page.getByRole("button", { name: "Send back" }).click();
  expect((await (await page.request.get(`/api/tasks/${task.id}`)).json()).details.currentReturn.reason).toBe("Add the original logs.");
});

test("task journey remains usable in every supported theme", async ({ page }) => {
  const { analyst, task } = await setup(page, "themes");
  await login(page, { email: analyst.email, password: PASSWORD });
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark", "gold", "midnight"]) {
    await page.evaluate((value) => localStorage.setItem("so.theme", value), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByLabel(/What did you do/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Continue/ })).toBeEnabled();
  }
});

test("a conflicting hours edit preserves the analyst draft and shows the saved version", async ({ page, browser, baseURL }) => {
  const { analyst, task } = await setup(page, "conflict");
  await login(page, { email: analyst.email, password: PASSWORD });
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(`/api/tasks/${task.id}`)).json()).task.status).toBe("progress");
  await page.getByLabel(/What did you do/).fill("My unsaved investigation");
  const manager = await browser.newContext({ baseURL });
  try {
    expect((await manager.request.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
    expect((await manager.request.patch(`/api/tasks/${task.id}`, { data: { hours: 2 } })).status()).toBe(200);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/report changed/i)).toBeVisible();
    await page.getByRole("button", { name: "Check task" }).click();
    await expect(page.getByText("Current saved report")).toBeVisible();
    await expect(page.getByText("2 hrs", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/What did you do/)).toHaveValue("My unsaved investigation");
  } finally { await manager.close(); }
});

test("a failed background refresh does not discard a report being typed", async ({ page }) => {
  const { analyst, task } = await setup(page, "refresh-failure");
  await login(page, { email: analyst.email, password: PASSWORD });
  await page.goto(`/tasks/${task.id}`);
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  let release;
  let firstRefresh = true;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route(`**/api/tasks/${task.id}`, async (route) => {
    if (route.request().method() !== "GET" || !firstRefresh) return route.continue();
    firstRefresh = false;
    await gate;
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary refresh error" }) });
  });
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByLabel(/What did you do/).fill("Work typed during refresh");
  release();
  await expect(page.getByText("The server ran into a problem")).toBeVisible();
  await expect(page.getByLabel(/What did you do/)).toHaveValue("Work typed during refresh");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByLabel(/What did you do/)).toHaveValue("Work typed during refresh");
});
