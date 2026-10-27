// @ts-check
const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PASSWORD = "L2-Test-2026!";
function tehranDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const d = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${d.year}-${d.month}-${d.day}`;
}

test("Layer 2 analyzes tickets quickly, records verdicts, and managers can correct submitted shifts", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: ADMIN });
  const members = [
    { name: "Ticket Review L2", email: "reviewer@l2-analyzed.test", team: "SOC · L2" },
    { name: "Ticket Review L1", email: "reviewer@l1-analyzed.test", team: "SOC · L1" },
  ];
  const ids = {};
  for (const member of members) {
    const result = await page.request.post("/api/members", {
      data: { ...member, role: "analyst", password: PASSWORD },
    });
    expect(result.status()).toBe(201);
    ids[member.team] = (await result.json()).user.id;
    const scheduled = await page.request.post("/api/shift/schedule", {
      data: { userId: ids[member.team], date: tehranDate(), shiftType: "morning" },
    });
    expect(scheduled.status()).toBe(201);
  }

  await page.request.post("/api/auth/login", { data: { email: members[1].email, password: PASSWORD } });
  await page.goto("/shift");
  await expect(page.getByTestId("l2-analyzed-tickets")).toHaveCount(0);
  expect((await page.request.post("/api/shift/analyzed-tickets", {
    data: { ticketNumber: "INC-HACK", verdict: "true_positive" },
  })).status()).toBe(403);

  await page.request.post("/api/auth/login", { data: { email: members[0].email, password: PASSWORD } });
  await page.goto("/shift");
  const card = page.getByTestId("l2-analyzed-tickets");
  await expect(card).toBeVisible();
  await expect(page.getByRole("heading", { name: "Routine activities" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Created tickets" })).toHaveCount(0);
  await expect(page.getByTestId("shift-checklist")).toHaveCount(0);
  const shift = await (await page.request.get("/api/shift")).json();
  expect(shift.activities).toEqual([]);
  expect(shift.checklist).toBeNull();
  expect((await page.request.post("/api/shift/tickets", { data: { no: "CREATED-NO" } })).status()).toBe(403);
  expect((await page.request.patch("/api/shift", { data: { n: 1, patch: { done: true } } })).status()).toBe(403);
  // Typing is local; saving is an explicit action, not one POST per keystroke.
  let mutations = 0;
  await page.route("**/api/shift/analyzed-tickets", async (route) => {
    if (route.request().method() === "POST") mutations += 1;
    await route.continue();
  });
  await card.getByLabel("Ticket number").fill("INC-1001");
  expect(mutations).toBe(0);
  await card.getByRole("button", { name: "False positive", exact: true }).click();
  await card.getByRole("button", { name: "Add ticket" }).click();
  await expect(card.getByTestId("l2-reviewed-count")).toHaveText("1");
  expect(mutations).toBe(1);
  await card.getByLabel("Ticket number").fill("INC-1002");
  await card.getByRole("button", { name: "True positive", exact: true }).click();
  await card.getByRole("button", { name: "Add ticket" }).click();
  await expect(card.getByTestId("l2-reviewed-count")).toHaveText("2");
  await expect(card.getByTestId("l2-fp-count")).toHaveText("1");
  await expect(card.getByTestId("l2-tp-count")).toHaveText("1");
  await card.getByLabel("Ticket number").fill("inc-1001");
  await card.getByRole("button", { name: "Add ticket" }).click();
  await expect(card.getByRole("alert")).toContainText("already registered");

  await card.getByRole("button", { name: "Edit ticket INC-1001" }).click();
  await card.getByRole("button", { name: "True positive", exact: true }).click();
  await card.getByRole("button", { name: "Save changes" }).click();
  await expect(card.getByTestId("l2-tp-count")).toHaveText("2");

  const original = await page.request.get("/api/shift");
  const log = await original.json();
  for (const a of log.activities) {
    const response = await page.request.patch("/api/shift", {
      data: { n: a.n, itemId: a.itemId ?? null, patch: { done: true } },
    });
    expect(response.status()).toBe(200);
  }
  expect((await page.request.patch("/api/shift", { data: { completed: true } })).status()).toBe(200);
  await page.reload();
  await expect(card).toContainText("Submitted · read only");
  await page.goto("/shift/history");
  await expect(page.getByRole("table", { name: "Layer 2 shift log history" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Tickets analyzed" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "IOCs" })).toHaveCount(0);
  expect((await page.request.post("/api/shift/analyzed-tickets", {
    data: { ticketNumber: "INC-1003", verdict: "true_positive" },
  })).status()).toBe(409);

  await page.request.post("/api/auth/login", { data: ADMIN });
  await page.goto("/shift/manage");
  await page.getByRole("combobox", { name: "Analyst" }).selectOption(ids["SOC · L2"]);
  const managerCard = page.getByTestId("l2-analyzed-tickets");
  await expect(managerCard).toBeVisible();
  await expect(page.getByRole("heading", { name: "Routine activities" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Created tickets" })).toHaveCount(0);
  await expect(managerCard.getByTestId("l2-reviewed-count")).toHaveText("2");
  await managerCard.getByRole("button", { name: "Delete ticket INC-1002" }).click();
  await managerCard.getByRole("button", { name: "Confirm delete" }).click();
  await expect(managerCard.getByTestId("l2-reviewed-count")).toHaveText("1");
  const report = await page.request.get(`/api/reports/shift?period=custom&from=${tehranDate()}&to=${tehranDate()}&user=${ids["SOC · L2"]}`);
  expect(report.status()).toBe(200);
  const result = await report.json();
  expect(result.sheets.find((sheet) => sheet.name === "L2 Ticket Analysis").rows).toHaveLength(1);
});
