const { test, expect } = require("@playwright/test");
const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PW = "Review-Backfill-2026!";
const dateToday = () => {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const daysAgo = (n) => new Date(Date.parse(dateToday() + "T00:00:00Z") - n * 864e5).toISOString().slice(0, 10);

test("SOC Manager can bypass review for own task only, and grant four auditable missed L2 shift days", async ({ page }) => {
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
  await expect(page.getByRole("checkbox", { name: "Manager review required" })).not.toBeChecked();
  expect((await page.request.patch(`/api/tasks/${ownTask.id}`, { data: { status: "progress" } })).status()).toBe(200);
  const finished = await page.request.patch(`/api/tasks/${ownTask.id}`, { data: { status: "done" } });
  expect(finished.status()).toBe(200);
  expect((await finished.json()).task).toMatchObject({ status: "done", reviewRequired: false, quality: null });

  const assigned = await page.request.post("/api/tasks", { data: {
    title: "Analyst task needs independent review", a: analystId, reviewRequired: false,
  } });
  expect(assigned.status()).toBe(403);
  const normal = await page.request.post("/api/tasks", { data: {
    title: "Analyst work", a: analystId,
  } });
  expect(normal.status()).toBe(201);
  const analystTask = (await normal.json()).task;
  expect(analystTask.reviewRequired).toBe(true);
  expect((await page.request.patch(`/api/tasks/${analystTask.id}`,
    { data: { reviewRequired: false } })).status()).toBe(403);

  await page.goto("/shift/manage");
  await expect(page.getByText("Missed shifts · backfill permission")).toBeVisible();
  await page.getByLabel("Analyst").selectOption(analystId);
  await expect(page.getByLabel(`Select missed shift ${dates[0]}`)).toBeVisible();
  for (const date of dates) await page.getByLabel(`Select missed shift ${date}`).check();
  await page.getByLabel("Backfill reason (optional)").fill("Four forgotten days");
  await page.getByRole("button", { name: "Allow selected days (4)" }).click();
  await expect(page.getByText("Entry permitted")).toHaveCount(4);

  // The server refuses arbitrary backdating; every authorized date was on the roster.
  expect((await page.request.post("/api/shift/backfill", { data: {
    userId: analystId, dates: [daysAgo(10)], enabled: true,
  } })).status()).toBe(409);
  const grants = (await (await page.request.get(`/api/shift/backfill?user=${analystId}`)).json()).days;
  expect(grants.filter((g) => g.granted)).toHaveLength(4);

  await page.request.post("/api/auth/login", { data: { email: people[1].email, password: PW } });
  expect((await page.request.post("/api/shift/backfill", { data: { userId: analystId, dates, enabled: true } })).status()).toBe(403);
  expect((await page.request.patch("/api/shift", { data: { date: daysAgo(10), completed: true } })).status()).toBe(403);
  await page.goto(`/shift?date=${dates[0]}`);
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

  await page.request.post("/api/auth/login", { data: { email: people[0].email, password: PW } });
  expect((await page.request.post("/api/shift/backfill", { data: {
    userId: analystId, dates: [dates[0]], enabled: true,
  } })).status()).toBe(409);
  expect((await page.request.post("/api/shift/backfill", { data: {
    userId: analystId, dates: [dates[1]], enabled: false, reason: "Revoke",
  } })).status()).toBe(200);
  await page.request.post("/api/auth/login", { data: { email: people[1].email, password: PW } });
  expect((await page.request.post("/api/shift/analyzed-tickets", { data: {
    date: dates[1], ticketNumber: "INC-NO-GRANT", verdict: "false_positive",
  } })).status()).toBe(403);
});
