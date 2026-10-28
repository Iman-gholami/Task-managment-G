const { test, expect } = require("@playwright/test");
const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PW = "Review-Backfill-2026!";
const dateToday = () => {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const daysAgo = (n) => new Date(Date.parse(dateToday() + "T00:00:00Z") - n * 864e5).toISOString().slice(0, 10);

test("SOC Manager can waive review and grant four auditable missed L2 shift days", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
  const people = [
    { name: "Backfill Test SOC Manager", email: "soc-backfill@test.invalid", role: "soc_manager", team: "SOC" },
    { name: "Backfill Test L2 Analyst", email: "l2-backfill@test.invalid", role: "analyst", team: "SOC · L2" },
  ];
  const ids = [];
  for (const person of people) {
    const res = await page.request.post("/api/members", { data: { ...person, password: PW, province: "قم" } });
    expect(res.status()).toBe(201);
    ids.push((await res.json()).user.id);
  }
  const [managerId, analystId] = ids;

  const dates = [1, 2, 3, 4].map(daysAgo);
  for (const date of dates) {
    expect((await page.request.post("/api/shift/schedule", {
      data: { userId: analystId, date, shiftType: "morning" },
    })).status()).toBe(201);
  }
  await page.request.post("/api/auth/login", { data: { email: people[0].email, password: PW } });

  const own = await page.request.post("/api/tasks", { data: {
    title: "Personal SOC Manager job", a: managerId, reviewRequired: false, cx: 2,
  } });
  expect(own.status()).toBe(201);
  const ownTask = (await own.json()).task;
  expect(ownTask.reviewRequired).toBe(false);
  await page.goto(`/tasks/${ownTask.id}`);
  await page.getByText("Task overview & activity").click();
  await expect(page.getByRole("checkbox", { name: "Manager review required" })).not.toBeChecked();
  expect((await page.request.patch(`/api/tasks/${ownTask.id}`, { data: { status: "progress" } })).status()).toBe(200);
  const finished = await page.request.patch(`/api/tasks/${ownTask.id}`, { data: { status: "done", hours: 1, report: { workPerformed: "Completed the task", outcome: "Finished", revision: 0 } } });
  expect(finished.status()).toBe(200);
  expect((await finished.json()).task).toMatchObject({ status: "done", reviewRequired: false, quality: null });

  const assigned = await page.request.post("/api/tasks", { data: {
    title: "Analyst task without review", a: analystId, reviewRequired: false,
  } });
  expect(assigned.status()).toBe(201);
  expect((await assigned.json()).task.reviewRequired).toBe(false);
  const normal = await page.request.post("/api/tasks", { data: {
    title: "Analyst work", a: analystId,
  } });
  expect(normal.status()).toBe(201);
  const analystTask = (await normal.json()).task;
  expect(analystTask.reviewRequired).toBe(true);
  expect((await page.request.patch(`/api/tasks/${analystTask.id}`,
    { data: { reviewRequired: false } })).status()).toBe(200);

  await page.goto("/shift/manage");
  await expect(page.getByText("Return missed Shift Logs")).toBeVisible();
  await expect(page.getByLabel("Shift date")).toBeHidden();
  await page.getByLabel("Analyst").selectOption(analystId);
  await expect(page.getByLabel(`Select missed shift ${dates[0]}`)).toBeVisible();
  for (const date of dates) await page.getByLabel(`Select missed shift ${date}`).check();
  await page.getByLabel("Backfill reason (optional)").fill("Four forgotten days");
  await page.getByRole("button", { name: "Return selected days (4)" }).click();
  await expect(page.getByText("Returned · awaiting completion")).toHaveCount(4);
  await expect(page.getByTestId("manager-returned-shifts")).toContainText(people[1].name);
  await page.goto("/dashboard");
  await expect(page.getByTestId("manager-returned-shifts")).toContainText(people[1].name);
  await page.getByTestId("manager-returned-shifts").locator("summary").click();
  await expect(page.getByTestId(`manager-returned-${analystId}-${dates[0]}`)).toBeVisible();

  // The server refuses arbitrary backdating; every authorized date was on the roster.
  expect((await page.request.post("/api/shift/backfill", { data: {
    userId: analystId, dates: [daysAgo(10)], enabled: true,
  } })).status()).toBe(409);
  const grants = (await (await page.request.get(`/api/shift/backfill?user=${analystId}`)).json()).days;
  expect(grants.filter((g) => g.granted)).toHaveLength(4);

  await page.request.post("/api/auth/login", { data: { email: people[1].email, password: PW } });
  expect((await page.request.get("/api/shift/backfill?scope=pending")).status()).toBe(403);
  await page.goto("/dashboard");
  await expect(page.getByTestId("returned-shifts-card")).toContainText("4 shift logs returned for completion");
  await page.getByTestId("returned-shifts-card").locator("summary").click();
  for (const date of dates) await expect(page.getByTestId(`returned-shift-${date}`)).toBeVisible();
  expect((await page.request.post("/api/shift/backfill", { data: { userId: analystId, dates, enabled: true } })).status()).toBe(403);
  expect((await page.request.patch("/api/shift", { data: { date: daysAgo(10), completed: true } })).status()).toBe(403);
  await page.getByTestId(`returned-shift-${dates[0]}`).click();
  await expect(page).toHaveURL(new RegExp(`/shift\\?date=${dates[0]}`));
  await expect(page.getByText(/Manager-authorized backfill/)).toBeVisible();
  await expect(page.getByTestId("l2-analyzed-tickets")).toBeVisible();
  await page.getByLabel("Ticket number").fill("INC-HISTORICAL-1");
  await page.getByRole("button", { name: "True positive", exact: true }).click();
  await page.getByRole("button", { name: "Add ticket" }).click();
  await expect(page.getByTestId("l2-reviewed-count")).toHaveText("1");
  await page.getByRole("button", { name: "Complete shift" }).click();
  await expect(page.getByRole("region", { name: "L2 shift summary" })).toContainText("Submitted");
  const log = (await (await page.request.get(`/api/shift?date=${dates[0]}`)).json());
  expect(log.date).toBe(dates[0]);
  expect(log.analyzedTickets.map((x) => x.ticketNumber)).toContain("INC-HISTORICAL-1");
  expect(log.completedAt).toBeTruthy();
  const remaining = (await (await page.request.get("/api/shift/backfill?scope=self")).json()).pending;
  expect(remaining.map((row) => row.date)).toHaveLength(3);
  expect(remaining.map((row) => row.date)).not.toContain(dates[0]);
  await page.goto("/dashboard");
  await expect(page.getByTestId("returned-shifts-card")).toContainText("3 shift logs returned for completion");
  await expect(page.getByTestId(`returned-shift-${dates[0]}`)).toHaveCount(0);

  await page.request.post("/api/auth/login", { data: { email: people[0].email, password: PW } });
  await page.goto("/dashboard");
  await expect(page.getByTestId("manager-returned-shifts")).toContainText(people[1].name);
  await expect(page.getByTestId(`manager-returned-${analystId}-${dates[0]}`)).toHaveCount(0);
  await page.getByTestId("manager-returned-shifts").locator("summary").click();
  await expect(page.getByTestId(`manager-returned-${analystId}-${dates[1]}`)).toBeVisible();
  const firstRemaining = page.getByTestId(`manager-returned-${analystId}-${dates[1]}`);
  await firstRemaining.click();
  await expect(page).toHaveURL(/\/shift\/manage\?user=/);
  await expect(page.getByLabel("Shift date")).toHaveValue(dates[1]);
  await expect(page.locator("#shift-log-details")).toBeInViewport();
  expect((await page.request.post("/api/shift/backfill", { data: {
    userId: analystId, dates: [dates[0]], enabled: true,
  } })).status()).toBe(409);
  expect((await page.request.post("/api/shift/backfill", { data: {
    userId: analystId, dates: [dates[1]], enabled: false, reason: "Revoke",
  } })).status()).toBe(200);
  await page.request.post("/api/auth/login", { data: ADMIN });
  await page.goto("/dashboard");
  await page.getByTestId("manager-returned-shifts").locator("summary").click();
  await expect(page.getByTestId(`manager-returned-${analystId}-${dates[1]}`)).toHaveCount(0);
  await expect(page.getByTestId(`manager-returned-${analystId}-${dates[2]}`)).toBeVisible();
  await page.request.post("/api/auth/login", { data: { email: people[1].email, password: PW } });
  expect((await page.request.post("/api/shift/analyzed-tickets", { data: {
    date: dates[1], ticketNumber: "INC-NO-GRANT", verdict: "false_positive",
  } })).status()).toBe(403);
});


test("a returned extended L3 shift can be ticked and completed from homepage without overwriting today's engineering log", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).status()).toBe(200);
  const person = { name: "Returned Extended L3", email: "returned-extended-l3@test.invalid",
    team: "SOC · L3", role: "analyst", password: PW };
  const added = await page.request.post("/api/members", { data: person });
  expect(added.status()).toBe(201);
  const userId = (await added.json()).user.id;
  const yesterday = daysAgo(2);
  for (const [date, shiftType] of [[yesterday, "evening"], [dateToday(), "morning"]]) {
    expect((await page.request.post("/api/shift/schedule", { data: { userId, date, shiftType } })).status()).toBe(201);
  }
  expect((await page.request.post("/api/shift/backfill", { data: {
    userId, dates: [yesterday], enabled: true, reason: "Forgot shift activities",
  } })).status()).toBe(200);

  expect((await page.request.post("/api/auth/login", { data: { email: person.email, password: PW } })).status()).toBe(200);
  await page.goto("/dashboard");
  await expect(page.getByTestId("returned-shifts-card")).toContainText("1 shift log returned for completion");
  await page.getByTestId("returned-shifts-card").locator("summary").click();
  await page.getByTestId(`returned-shift-${yesterday}`).click();
  await expect(page.getByRole("heading", { name: "SOC shift duties" })).toBeVisible();
  const historic = (await (await page.request.get(`/api/shift?date=${yesterday}`)).json());
  expect(historic.mode).toBe("operational");
  expect(historic.activities.length).toBeGreaterThan(0);
  for (const activity of historic.activities) {
    const saved = page.waitForResponse((response) =>
      response.url().endsWith("/api/shift") && response.request().method() === "PATCH");
    await page.locator(`#act-${activity.n} .toggle-done`).click();
    expect((await saved).status()).toBe(200);
  }
  await expect(page.getByRole("region", { name: "Shift summary" }))
    .toContainText(`${historic.activities.length}/${historic.activities.length}`);
  await page.getByRole("button", { name: "Complete shift" }).click();
  await expect(page.getByRole("link", { name: "Back to dashboard" })).toBeVisible();
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("returned-shifts-card")).toHaveCount(0);

  // Client navigation must not replace today's L3 engineering duties with past SOC activities.
  await page.getByRole("link", { name: /Start Shift Log|Continue Shift Log|View Shift Log/ }).first().click();
  await expect(page.getByRole("heading", { name: "Engineering daily work" })).toBeVisible();
  const current = (await (await page.request.get("/api/shift")).json());
  expect(current.mode).toBe("engineering");
  expect(current.date).toBe(dateToday());
  expect(current.completedAt).toBeNull();
  expect((await (await page.request.get("/api/shift/backfill?scope=self")).json()).count).toBe(0);

  await page.request.post("/api/auth/login", { data: ADMIN });
  await page.goto("/dashboard");
  await expect(page.getByTestId(`manager-returned-${userId}-${yesterday}`)).toHaveCount(0);
});

test("returned shifts stay compact, recover from a loading error, and open on a phone", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).status()).toBe(200);
  const person = { name: "Compact Queue Analyst", email: "compact-queue@test.invalid",
    team: "SOC · L3", role: "analyst", password: PW };
  const added = await page.request.post("/api/members", { data: person });
  expect(added.status()).toBe(201);
  const userId = (await added.json()).user.id;
  const dates = Array.from({ length: 8 }, (_, i) => daysAgo(i + 1));
  for (const date of dates) {
    expect((await page.request.post("/api/shift/schedule", { data: { userId, date, shiftType: "morning" } })).status()).toBe(201);
  }
  expect((await page.request.post("/api/shift/backfill", { data: { userId, dates, enabled: true } })).status()).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/shift/manage?user=${userId}`);
  await expect(page.getByLabel(`Select missed shift ${dates[0]}`)).toBeVisible();
  const managerPanel = page.getByRole("region", { name: "Return missed Shift Logs" });
  expect(await managerPanel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect(page.getByLabel("Shift date")).toBeHidden();

  expect((await page.request.post("/api/auth/login", { data: { email: person.email, password: PW } })).status()).toBe(200);

  // A failed load stays visible and can be retried without losing the queue.
  await page.route((url) => url.pathname === "/api/shift/backfill" && url.searchParams.get("scope") === "self",
    (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Try again" }) }), { times: 1 });
  await page.goto("/dashboard");
  await expect(page.getByTestId("returned-shifts-card")).toContainText("Could not load returned Shift Logs");
  await page.getByTestId("returned-shifts-card").getByRole("button", { name: "Retry" }).click();
  const queue = page.getByTestId("returned-shifts-card");
  await expect(queue).toContainText("8 shift logs returned for completion");
  await expect(page.getByTestId(`returned-shift-${dates[0]}`)).toBeHidden();
  const summary = queue.locator("summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(page.getByTestId(`returned-shift-${dates[0]}`)).toBeVisible();
  await expect(page.getByTestId(`returned-shift-${dates[7]}`)).toHaveCount(0);
  await queue.getByRole("button", { name: "Show all 8 shifts" }).click();
  const last = page.getByTestId(`returned-shift-${dates[7]}`);
  await expect(last).toBeVisible();
  expect(await queue.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await last.click();
  await expect(page).toHaveURL(new RegExp(`/shift\\?date=${dates[7]}`));
});

test("switching analysts never shows the previous person's log under the new selection", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).status()).toBe(200);
  const people = [
    { name: "Correction First Analyst", email: "correction-first@test.invalid" },
    { name: "Correction Second Analyst", email: "correction-second@test.invalid" },
  ];
  for (const person of people) {
    const response = await page.request.post("/api/members", { data: { ...person, team: "SOC · L3", role: "analyst", password: PW } });
    expect(response.status()).toBe(201);
    person.id = (await response.json()).user.id;
    expect((await page.request.post("/api/shift/schedule", { data: { userId: person.id, date: dateToday(), shiftType: "morning" } })).status()).toBe(201);
  }
  for (const person of people) {
    await page.request.post("/api/auth/login", { data: { email: person.email, password: PW } });
    expect((await page.request.get("/api/shift")).status()).toBe(200);
  }
  await page.request.post("/api/auth/login", { data: ADMIN });
  await page.goto(`/shift/manage?user=${people[0].id}&date=${dateToday()}`);
  await expect(page.locator(".facts")).toContainText(people[0].name);

  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route((url) => url.pathname === "/api/shift" && url.searchParams.get("user") === people[1].id,
    async (route) => { await gate; await route.continue(); }, { times: 1 });
  try {
    await page.getByLabel("Analyst").selectOption(people[1].id);
    await expect(page.locator(".facts")).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.locator(".facts")).toContainText(people[1].name);
  await expect(page.locator(".facts")).not.toContainText(people[0].name);
});
