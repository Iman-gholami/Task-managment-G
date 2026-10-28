const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PASSWORD = "Analyst-Workspace-2026!";

async function setup(page, suffix, options = {}) {
  await page.request.post("/api/auth/login", { data: ADMIN });
  const created = await page.request.post("/api/members", { data: {
    name: `Analyst ${suffix}`, email: `analyst-work-${suffix}@test.invalid`, password: PASSWORD, role: "analyst", team: "SOC · L1",
  } });
  expect(created.status()).toBe(201);
  const analyst = (await created.json()).user;
  const taskResponse = await page.request.post("/api/tasks", { data: { title: `Investigate ${suffix}`, description: "Review the evidence and record the result.", a: analyst.id, ...options } });
  expect(taskResponse.status()).toBe(201);
  return { analyst, task: (await taskResponse.json()).task };
}
async function signIn(page, analyst, task) {
  await page.request.post("/api/auth/login", { data: { email: analyst.email, password: PASSWORD } });
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByLabel(/What did you do/)).toBeVisible();
}
async function fillReport(page, hours) {
  await page.getByLabel(/What did you do/).fill("Reviewed the evidence.");
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByLabel(/What was the outcome/).fill("The review is complete.");
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByLabel(/Total hours/).fill(hours);
  await page.getByRole("button", { name: "Review submission" }).click();
}

test("assignee can log Persian decimal hours and review the actual handover", async ({ page }) => {
  const { analyst, task } = await setup(page, "handover");
  expect((await page.request.post(`/api/tasks/${task.id}/attachments`, { multipart: { file: { name: "evidence.txt", mimeType: "text/plain", buffer: Buffer.from("evidence") } } })).status()).toBe(201);
  expect((await page.request.post(`/api/tasks/${task.id}/checklist`, { data: { label: "Check the evidence" } })).status()).toBe(201);
  await signIn(page, analyst, task);
  await page.getByText("Conversation", { exact: true }).click();
  await page.getByLabel("New comment").fill("نتیجه بررسی آماده است.");
  await fillReport(page, "۲٫۵");
  await expect(page.getByText("Unposted comment")).toBeVisible();
  await expect(page.getByText("2.5 hrs")).toBeVisible();
  await expect(page.getByText("0 / 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to comment" }).click();
  await expect(page.getByLabel("New comment")).toHaveValue("نتیجه بررسی آماده است.");
  await expect(page.getByLabel("New comment")).toBeFocused();
  await page.getByRole("button", { name: /^Comment/ }).click();
  await expect(page.locator(".comment p").getByText("نتیجه بررسی آماده است.")).toBeVisible();
  await page.getByRole("button", { name: /Review & submit/ }).click();
  await expect(page.getByText("Unposted comment")).toHaveCount(0);
  const request = page.waitForRequest((req) => req.url().endsWith(`/api/tasks/${task.id}`) && req.method() === "PATCH");
  await page.getByRole("button", { name: "Submit for review" }).click();
  expect((await request).postDataJSON()).toMatchObject({ hours: 2.5, status: "review", report: { workPerformed: "Reviewed the evidence.", outcome: "The review is complete." } });
  await expect(page.getByText("Waiting for review")).toBeVisible();
  const result = await (await page.request.get(`/api/tasks/${task.id}`)).json();
  expect(result.task).toMatchObject({ hours: 2.5, status: "review" });
  expect(result.details.comments[0].body).toBe("نتیجه بررسی آماده است.");
  expect(result.details.attachments).toHaveLength(1);
});

test("invalid hours stay editable and an unconfirmed save can be checked and retried", async ({ page }) => {
  const { analyst, task } = await setup(page, "retry");
  await signIn(page, analyst, task);
  await page.getByRole("button", { name: /Time spent/ }).click();
  const hours = page.getByLabel(/Total hours/);
  for (const value of ["-1", "1001", "words"]) {
    await hours.fill(value);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Enter total hours from 0 to 1000, using a number such as 1.5.")).toBeVisible();
    await expect(hours).toHaveValue(value);
  }
  expect((await (await page.request.get(`/api/tasks/${task.id}`)).json()).task.hours).toBe(0);
  await hours.fill("4.25");
  await page.route(`**/api/tasks/${task.id}`, (route) => route.request().method() === "PATCH" ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" }) : route.continue(), { times: 1 });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("We couldn't confirm the change. Check the current task before trying again.")).toBeVisible();
  await expect(hours).toHaveValue("4.25");
  await page.getByRole("button", { name: "Check task" }).click();
  await expect(page.getByText(/Your draft was not saved/)).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved")).toBeVisible();
  expect((await (await page.request.get(`/api/tasks/${task.id}`)).json()).task.hours).toBe(4.25);
});

test("a lost handover response is reconciled before another submission", async ({ page }) => {
  const { analyst, task } = await setup(page, "lost-response");
  await signIn(page, analyst, task);
  await fillReport(page, "3");
  let patches = 0;
  await page.route(`**/api/tasks/${task.id}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    patches += 1;
    await route.fetch();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/couldn't confirm/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit for review" })).toBeDisabled();
  await page.getByRole("button", { name: "Check task" }).click();
  await expect(page.getByText("Waiting for review")).toBeVisible();
  expect(patches).toBe(1);
  expect((await (await page.request.get(`/api/tasks/${task.id}`)).json()).task).toMatchObject({ status: "review", hours: 3 });
});

test("zero hours and no supporting files can be completed when review is waived", async ({ page }) => {
  const { analyst, task } = await setup(page, "no-review", { reviewRequired: false });
  await signIn(page, analyst, task);
  await fillReport(page, "0");
  await expect(page.getByText("0 hrs", { exact: true })).toBeVisible();
  await expect(page.getByText("0 / 0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete task", exact: true }).click();
  await expect(page.getByText("Completed · No review required")).toBeVisible();
  expect((await (await page.request.get(`/api/tasks/${task.id}`)).json()).task).toMatchObject({ status: "done", hours: 0 });
});
