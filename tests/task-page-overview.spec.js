const { test, expect } = require("@playwright/test");

// The task page shows the whole task at a glance: a progress panel and lifecycle in the brief,
// the report as a step rail, and an always-open sidebar (checklist, files, conversation, activity, details).

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PASSWORD = "Task-Overview-2026!";

async function login(page, account) { expect((await page.request.post("/api/auth/login", { data: account })).ok()).toBeTruthy(); }
async function setup(page, suffix, options = {}) {
  await login(page, ADMIN);
  const member = await page.request.post("/api/members", { data: {
    name: `Overview ${suffix}`, email: `overview-${suffix}@example.invalid`, password: PASSWORD, role: "analyst", team: "SOC · L1",
  } });
  expect(member.status()).toBe(201);
  const analyst = (await member.json()).user;
  const created = await page.request.post("/api/tasks", { data: { title: `Overview task ${suffix}`, description: "Check the alert and record the result.", a: analyst.id, ...options } });
  expect(created.status()).toBe(201);
  return { analyst, task: (await created.json()).task, analystLogin: { email: analyst.email, password: PASSWORD } };
}
const progressPanel = (page) => page.getByRole("region", { name: "Task progress" });
const lifecycle = (page) => page.getByRole("list", { name: "Task lifecycle" });
const sidebar = (page) => page.getByRole("complementary", { name: "Task at a glance" });
const step = (page, name) => page.getByRole("list", { name: "Report steps" }).getByRole("listitem").filter({ hasText: name });

test("the assignee sees the whole task at a glance before starting", async ({ page }) => {
  const { task, analystLogin } = await setup(page, "start");
  expect((await page.request.post(`/api/tasks/${task.id}/checklist`, { data: { label: "Confirm the alert source" } })).status()).toBe(201);
  expect((await page.request.post(`/api/tasks/${task.id}/comments`, { data: { body: "Logs are in the shared folder." } })).status()).toBe(201);
  expect((await page.request.post(`/api/tasks/${task.id}/attachments`, { multipart: { file: { name: "alert.txt", mimeType: "text/plain", buffer: Buffer.from("alert") } } })).status()).toBe(201);
  await login(page, analystLogin);
  await page.goto(`/tasks/${task.id}`);

  await expect(progressPanel(page)).toContainText("Ready to start");
  await expect(progressPanel(page).getByRole("img", { name: /0% complete/ })).toBeVisible();
  await expect(lifecycle(page).locator('[aria-current="step"]')).toContainText("Assigned");
  await expect(lifecycle(page).getByRole("listitem")).toHaveCount(4);

  for (const heading of ["Checklist", "Attachments", "Conversation", "Activity", "Details"]) {
    await expect(sidebar(page).getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(sidebar(page).locator("label.check-item", { hasText: "Confirm the alert source" })).toBeVisible();
  await expect(sidebar(page).getByText("0 of 1 done")).toBeVisible();
  await expect(sidebar(page).getByText("Logs are in the shared folder.")).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: /alert\.txt/ })).toBeVisible();
  await expect(page.getByTestId("activity")).toBeVisible();

  await expect(step(page, "Start the task").getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(step(page, "Work performed").getByRole("button")).toHaveCount(0);
});

test("saved report steps tick and the progress panel moves with them", async ({ page }) => {
  const { task, analystLogin } = await setup(page, "ticks");
  await login(page, analystLogin);
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(progressPanel(page)).toContainText("1 of 5 steps done");
  await expect(progressPanel(page)).toContainText("Next: Work performed");
  await expect(lifecycle(page).locator('[aria-current="step"]')).toContainText("Work");

  await page.getByLabel(/What did you do/).fill("Checked the proxy logs for the host.");
  await expect(progressPanel(page)).toContainText("1 of 5 steps done");
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(progressPanel(page)).toContainText("2 of 5 steps done");
  await expect(progressPanel(page).getByRole("img", { name: /40% complete/ })).toBeVisible();
  await expect(step(page, "Work performed")).toContainText("Checked the proxy logs for the host.");
  await expect(step(page, "Work performed").getByText("Completed")).toBeAttached();
  await expect(step(page, "Work performed").getByRole("button", { name: /Edit/ })).toBeVisible();

  await page.getByLabel(/What was the outcome/).fill("No malicious traffic.");
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(progressPanel(page)).toContainText("3 of 5 steps done");
  await page.getByLabel(/Total hours/).fill("1.5");
  await page.getByRole("button", { name: "Review submission" }).click();
  await expect(progressPanel(page)).toContainText("4 of 5 steps done");
  await expect(progressPanel(page)).toContainText("Next: Review & submit");

  await step(page, "Work performed").getByRole("button", { name: /Edit/ }).click();
  await expect(page.getByLabel(/What did you do/)).toHaveValue("Checked the proxy logs for the host.");
  await page.getByRole("button", { name: /Review & submit/ }).click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();
  await expect(progressPanel(page)).toContainText("Sent to your manager");
  await expect(lifecycle(page).locator('[aria-current="step"]')).toContainText("Manager review");
});

test("files in the report step have one set of controls; the sidebar only names them", async ({ page }) => {
  const { task, analystLogin } = await setup(page, "files");
  await login(page, analystLogin);
  expect((await page.request.post(`/api/tasks/${task.id}/attachments`, { multipart: { file: { name: "capture.txt", mimeType: "text/plain", buffer: Buffer.from("pcap") } } })).status()).toBe(201);
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(sidebar(page).getByText("capture.txt", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /capture\.txt/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Outcome & evidence/ }).click();
  await expect(page.getByRole("link", { name: /capture\.txt/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Remove capture.txt" })).toHaveCount(1);
});

test("a manager sees the analyst's saved progress and draft while the work is open", async ({ page }) => {
  const { analyst, task, analystLogin } = await setup(page, "watch");
  await login(page, analystLogin);
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "progress" } })).ok()).toBeTruthy();
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { report: { workPerformed: "Collected the endpoint logs.", outcome: "", revision: 0, clearHours: true } } })).ok()).toBeTruthy();
  await login(page, ADMIN);
  await page.goto(`/tasks/${task.id}`);
  await expect(progressPanel(page)).toContainText(`${analyst.name}'s progress`);
  await expect(progressPanel(page)).toContainText("2 of 5 steps done");
  const report = page.getByRole("region", { name: "Work report" });
  await expect(report).toContainText("latest saved draft");
  await expect(report).toContainText("Collected the endpoint logs.");
  await expect(sidebar(page).getByRole("checkbox", { name: "Manager review required" })).toBeChecked();
});

test("the reviewer sees the submitted report next to the decision", async ({ page }) => {
  const { task, analystLogin } = await setup(page, "review");
  await login(page, analystLogin);
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "progress" } })).ok()).toBeTruthy();
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "review", hours: 2, report: { workPerformed: "Traced the login source.", outcome: "Account secured.", revision: 0 } } })).ok()).toBeTruthy();
  await login(page, ADMIN);
  await page.goto(`/tasks/${task.id}`);
  await expect(progressPanel(page)).toContainText("Ready for your review");
  await expect(lifecycle(page).locator('[aria-current="step"]')).toContainText("Manager review");
  const report = page.getByRole("region", { name: "Submitted report" });
  await expect(report.getByRole("heading", { name: "Review the submitted work" })).toBeVisible();
  await expect(report).toContainText("All required parts provided");
  await expect(report).toContainText("Traced the login source.");
  await expect(report).toContainText("Account secured.");
  const decision = page.getByRole("region", { name: "Your decision" });
  await expect(decision.getByRole("radio", { name: "Good", exact: true })).toBeVisible();
  await expect(decision.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await expect(decision.getByRole("button", { name: "Return for changes" })).toBeVisible();
});

test("a review-exempt task has no manager review stage", async ({ page }) => {
  const { task, analystLogin } = await setup(page, "exempt", { reviewRequired: false });
  await login(page, analystLogin);
  await page.goto(`/tasks/${task.id}`);
  await expect(lifecycle(page).getByRole("listitem")).toHaveCount(3);
  await expect(lifecycle(page)).not.toContainText("Manager review");
  await expect(step(page, "Review & complete")).toBeVisible();
});

test("the page stacks on a phone without horizontal scrolling", async ({ page }) => {
  const { task, analystLogin } = await setup(page, "phone");
  await login(page, analystLogin);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByLabel(/What did you do/)).toBeVisible();
  const work = await page.getByRole("region", { name: "Your work" }).boundingBox();
  const side = await sidebar(page).boundingBox();
  expect(side.y).toBeGreaterThan(work.y + work.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
