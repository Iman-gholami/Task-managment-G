const { test, expect } = require("@playwright/test");
const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PW = "Task-Workspace-2026!";

async function addPerson(page, person) {
  const result = await page.request.post("/api/members", { data: { ...person, password: PW } });
  expect(result.status()).toBe(201);
  return (await result.json()).user;
}

test("both managers may waive review within their scope; only the assignee can complete", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: ADMIN });
  const soc = await addPerson(page, { name: "Workspace SOC Manager", email: "workspace-soc@test.invalid", role: "soc_manager", team: "SOC" });
  const analyst = await addPerson(page, { name: "Workspace Review Analyst", email: "workspace-review@test.invalid", role: "analyst", team: "SOC · L1" });
  const outsider = await addPerson(page, { name: "Workspace Other Analyst", email: "workspace-other@test.invalid", role: "analyst", team: "SOC · L2" });

  const securityTask = await page.request.post("/api/tasks", { data: { title: "Security manager no review", a: analyst.id, reviewRequired: false } });
  expect(securityTask.status()).toBe(201);
  expect((await securityTask.json()).task.reviewRequired).toBe(false);
  await page.request.post("/api/auth/login", { data: { email: soc.email, password: PW } });
  const socTask = await page.request.post("/api/tasks", { data: { title: "SOC manager no review", a: analyst.id, reviewRequired: false } });
  expect(socTask.status()).toBe(201);
  const task = (await socTask.json()).task;

  const regular = await page.request.post("/api/tasks", { data: { title: "Switch review policy", a: analyst.id } });
  const regularTask = (await regular.json()).task;
  expect((await page.request.patch(`/api/tasks/${regularTask.id}`, { data: { status: "review", reviewRequired: false } })).status()).toBe(409);
  expect((await (await page.request.get(`/api/tasks/${regularTask.id}`)).json()).task.reviewRequired).toBe(true);
  expect((await page.request.patch(`/api/tasks/${regularTask.id}`, { data: { reviewRequired: false } })).status()).toBe(200);
  expect((await page.request.patch(`/api/tasks/${regularTask.id}`, { data: { reviewRequired: true } })).status()).toBe(200);
  await page.goto(`/tasks/${regularTask.id}`);
  const reviewSetting = page.getByRole("checkbox", { name: "Manager review required" });
  const changed = page.waitForResponse((response) => response.url().endsWith(`/api/tasks/${regularTask.id}`) && response.request().method() === "PATCH");
  await reviewSetting.uncheck();
  expect((await changed).status()).toBe(200);
  expect((await (await page.request.get(`/api/tasks/${regularTask.id}`)).json()).task.reviewRequired).toBe(false);
  const restored = page.waitForResponse((response) => response.url().endsWith(`/api/tasks/${regularTask.id}`) && response.request().method() === "PATCH");
  await reviewSetting.check();
  expect((await restored).status()).toBe(200);

  await page.request.post("/api/auth/login", { data: { email: outsider.email, password: PW } });
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "done" } })).status()).toBe(404);
  await page.request.post("/api/auth/login", { data: { email: analyst.email, password: PW } });
  expect((await page.request.post("/api/tasks", { data: { title: "Forbidden review bypass", a: analyst.id, reviewRequired: false } })).status()).toBe(403);
  expect((await page.request.patch(`/api/tasks/${regularTask.id}`, { data: { reviewRequired: false } })).status()).toBe(403);
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "progress" } })).status()).toBe(200);
  const complete = await page.request.patch(`/api/tasks/${task.id}`, { data: { status: "done" } });
  expect(complete.status()).toBe(200);
  expect((await complete.json()).task).toMatchObject({ status: "done", reviewRequired: false, quality: null });
});

test("the task and selected attachments become visible together, and comments work", async ({ page, browser }) => {
  await page.request.post("/api/auth/login", { data: ADMIN });
  const analyst = await addPerson(page, { name: "Workspace File Analyst", email: "workspace-files@test.invalid", role: "analyst", team: "SOC · L1" });
  await page.goto("/tasks/assigned");
  const analystContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    await analystContext.request.post("/api/auth/login", { data: { email: analyst.email, password: PW } });
    await page.getByRole("button", { name: /^Create task/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create task" });
    await dialog.getByLabel("Task title").fill("Investigate suspicious connection");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog.getByText("Discard this task?")).toBeVisible();
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(dialog.getByLabel("Task title")).toHaveValue("Investigate suspicious connection");
    await dialog.getByLabel("Description").fill("جزئیات بررسی اتصال و شواهد مرتبط");
    await dialog.getByLabel("Assignee").fill("Workspace File Analyst");
    await dialog.getByRole("option", { name: /Workspace File Analyst/ }).click();
    await dialog.getByLabel("Manager review required").uncheck();
    await dialog.getByLabel("Files for new task").setInputFiles([
      { name: "evidence.txt", mimeType: "text/plain", buffer: Buffer.from("evidence contents") },
      { name: "report.txt", mimeType: "text/plain", buffer: Buffer.from("report contents") },
    ]);
    await expect(dialog.getByText("2 selected")).toBeVisible();
    await dialog.getByRole("button", { name: "Review details" }).click();
    await expect(dialog.getByText("Ready to assign?")).toBeVisible();
    await expect(dialog.getByText("evidence.txt")).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog.getByText("Discard this task?")).toBeVisible();
    await dialog.locator('[aria-label="Task preview"] [tabindex="-1"]').focus();
    await page.keyboard.press("Control+Enter");
    await expect(dialog.getByText("Discard this task?")).toBeVisible();
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await dialog.getByRole("button", { name: "Back to editing" }).click();
    await expect(dialog.getByText("evidence.txt")).toBeVisible();
    await expect(dialog.getByLabel("Task title")).toHaveValue("Investigate suspicious connection");
    await expect(dialog.getByLabel("Description")).toHaveValue("جزئیات بررسی اتصال و شواهد مرتبط");
    await dialog.getByLabel("Description").fill("جزئیات به‌روزشده برای بررسی اتصال");
    await dialog.getByRole("button", { name: "Review details" }).click();
    await expect(dialog.getByText("جزئیات به‌روزشده برای بررسی اتصال")).toBeVisible();
    const before = await (await analystContext.request.get("/api/tasks")).json();
    expect(before.tasks.some((t) => t.title === "Investigate suspicious connection")).toBe(false);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/tasks") && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Create task", exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const { task } = await response.json();
    const visible = await (await analystContext.request.get(`/api/tasks/${task.id}`)).json();
    expect(visible.task.reviewRequired).toBe(false);
    expect(visible.task.description).toBe("جزئیات به‌روزشده برای بررسی اتصال");
    expect(visible.details.attachments.map((a) => a.name)).toEqual(["evidence.txt", "report.txt"]);
    const downloaded = await analystContext.request.get(`/api/tasks/${task.id}/attachments/${visible.details.attachments[0].id}`);
    expect(await downloaded.text()).toBe("evidence contents");

    const analystPage = await analystContext.newPage();
    await analystPage.goto(`/tasks/${task.id}`);
    await analystPage.getByLabel("New comment").fill("Initial triage completed.");
    await analystPage.getByRole("button", { name: /^Comment/ }).click();
    await expect(analystPage.getByText("Initial triage completed.")).toBeVisible();
    await analystPage.getByRole("button", { name: "Start", exact: true }).click();
    await analystPage.getByRole("button", { name: "Complete task", exact: true }).click();
    await expect(analystPage.getByText("Completed · No review required")).toBeVisible();
  } finally { await analystContext.close(); }
});

test("invalid attachments do not create a partial task", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: ADMIN });
  const result = await page.request.post("/api/tasks", { multipart: {
    task: JSON.stringify({ title: "Invalid empty attachment", a: "admin" }),
    files: { name: "empty.txt", mimeType: "text/plain", buffer: Buffer.alloc(0) },
  } });
  expect(result.status()).toBe(400);
  const oversized = await page.request.post("/api/tasks", { multipart: {
    task: JSON.stringify({ title: "Oversized attachment", a: "admin" }),
    files: { name: "oversized.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(20 * 1024 * 1024 + 1) },
  } });
  expect(oversized.status()).toBe(413);
  const tasks = await (await page.request.get("/api/tasks")).json();
  expect(tasks.tasks.some((t) => t.title === "Invalid empty attachment")).toBe(false);
  expect(tasks.tasks.some((t) => t.title === "Oversized attachment")).toBe(false);
});

test("task text editing remains local, and a failed comment can be retried", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: ADMIN });
  const created = await page.request.post("/api/tasks", { data: { title: "Typing test", a: "admin" } });
  expect(created.status()).toBe(201);
  const task = (await created.json()).task;
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const title = page.getByLabel("Title", { exact: true });
  const description = page.getByLabel("Description", { exact: true });
  await title.fill("");
  await title.pressSequentially("بررسی رخداد مشکوک");
  await description.pressSequentially("شواهد مرتبط را بررسی کنید.");
  await expect(title).toHaveValue("بررسی رخداد مشکوک");
  await expect(description).toHaveValue("شواهد مرتبط را بررسی کنید.");
  expect((await (await page.request.get(`/api/tasks/${task.id}`)).json()).task.title).toBe("Typing test");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "بررسی رخداد مشکوک" })).toBeVisible();

  await page.route(`**/api/tasks/${task.id}/comments`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary test failure" }) }), { times: 1 });
  const composer = page.getByLabel("New comment");
  await composer.pressSequentially("نتیجه بررسی آماده است.");
  await page.getByRole("button", { name: /^Comment/ }).click();
  await expect(composer).toHaveValue("نتیجه بررسی آماده است.");
  await expect(page.getByRole("button", { name: /^Comment/ })).toBeEnabled();
  await page.getByRole("button", { name: /^Comment/ }).click();
  await expect(page.getByText("نتیجه بررسی آماده است.")).toBeVisible();

  const comment = page.locator(".comment", { hasText: "نتیجه بررسی آماده است." });
  await comment.getByRole("button", { name: "Edit" }).click();
  const commentEditor = page.locator(".comment-edit");
  await commentEditor.getByLabel("Edit comment").fill("نتیجه نهایی ثبت شد.");
  await commentEditor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("نتیجه نهایی ثبت شد.")).toBeVisible();
  await page.getByLabel("New checklist item").pressSequentially("بررسی نشانی IP");
  await page.getByLabel("New checklist item").press("Enter");
  await page.reload();
  await expect(page.getByText("نتیجه نهایی ثبت شد.")).toBeVisible();
  await expect(page.getByText("بررسی نشانی IP")).toBeVisible();
});

test("assignee search does not shift the form and Escape closes only its results", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: ADMIN });
  await addPerson(page, { name: "Navid Workspace", email: "navid-workspace@test.invalid", role: "analyst", team: "SOC · L1" });
  await page.goto("/tasks/assigned");
  await page.getByRole("button", { name: /^Create task/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create task" });
  await dialog.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {}))));
  const assignee = dialog.getByRole("combobox", { name: "Assignee" });
  const priority = dialog.getByLabel("Priority");
  const before = await priority.boundingBox();
  await assignee.pressSequentially("navid");
  await expect(dialog.getByRole("option", { name: /Navid Workspace/ })).toBeVisible();
  const after = await priority.boundingBox();
  expect(after.y).toBe(before.y);
  await assignee.press("Escape");
  await expect(dialog.getByRole("listbox")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await assignee.pressSequentially("navid");
  await assignee.press("Enter");
  await expect(assignee).toHaveValue("Navid Workspace");
  await assignee.fill("no matching person");
  await expect(dialog.getByText("No matching team members")).toBeVisible();
  await dialog.getByLabel("Task title").fill("Task for Navid");
  await dialog.getByRole("button", { name: "Review details" }).click();
  await expect(dialog.getByText("Choose who this task is for.")).toBeVisible();
  await assignee.fill("navid");
  await assignee.press("Enter");
  await dialog.getByRole("button", { name: "Review details" }).click();
  await expect(dialog.getByText("Navid Workspace")).toBeVisible();
});

test("an analyst can delete their own task, but not one assigned by a manager", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: ADMIN });
  const analyst = await addPerson(page, { name: "Workspace Delete Analyst", email: "workspace-delete@test.invalid", role: "analyst", team: "SOC · L1" });
  const assigned = await (await page.request.post("/api/tasks", { data: { title: "Manager-created task", a: analyst.id } })).json();
  await page.request.post("/api/auth/login", { data: { email: analyst.email, password: PW } });
  expect((await page.request.delete(`/api/tasks/${assigned.task.id}`)).status()).toBe(403);
  const own = await (await page.request.post("/api/tasks", { data: { title: "Self-created task", a: analyst.id } })).json();
  await page.goto(`/tasks/${own.task.id}`);
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Delete task" });
  await expect(confirm).toContainText("history and files are retained for audit");
  await confirm.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/my/);
  expect((await page.request.get(`/api/tasks/${own.task.id}`)).status()).toBe(404);
  const tasks = await (await page.request.get("/api/tasks")).json();
  expect(tasks.tasks.some((t) => t.id === own.task.id)).toBe(false);
  const report = await (await page.request.get("/api/reports/task?period=this")).json();
  expect(report.sheets[0].rows.some((row) => row.id === own.task.id)).toBe(false);
});
