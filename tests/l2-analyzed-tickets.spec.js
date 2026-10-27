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
  await card.getByLabel("شماره تیکت تحلیل‌شده").fill("INC-1001");
  await card.getByRole("button", { name: "مثبت کاذب", exact: true }).click();
  await card.getByRole("button", { name: "ثبت و افزودن بعدی" }).click();
  await expect(card.getByTestId("l2-reviewed-count")).toHaveText("۱");
  await card.getByLabel("شماره تیکت تحلیل‌شده").fill("INC-1002");
  await card.getByRole("button", { name: "واقعی", exact: true }).click();
  await card.getByRole("button", { name: "ثبت و افزودن بعدی" }).click();
  await expect(card.getByTestId("l2-reviewed-count")).toHaveText("۲");
  await expect(card.getByTestId("l2-fp-count")).toHaveText("۱");
  await expect(card.getByTestId("l2-tp-count")).toHaveText("۱");
  await card.getByLabel("شماره تیکت تحلیل‌شده").fill("inc-1001");
  await card.getByRole("button", { name: "ثبت و افزودن بعدی" }).click();
  await expect(card.getByRole("alert")).toContainText("already registered");

  await card.getByRole("button", { name: "ویرایش تیکت INC-1001" }).click();
  await card.getByRole("button", { name: "واقعی", exact: true }).click();
  await card.getByRole("button", { name: "ذخیره تغییرات" }).click();
  await expect(card.getByTestId("l2-tp-count")).toHaveText("۲");

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
  await expect(card).toContainText("ثبت نهایی شده");
  expect((await page.request.post("/api/shift/analyzed-tickets", {
    data: { ticketNumber: "INC-1003", verdict: "true_positive" },
  })).status()).toBe(409);

  await page.request.post("/api/auth/login", { data: ADMIN });
  await page.goto("/shift/manage");
  await page.getByRole("combobox", { name: "Analyst" }).selectOption(ids["SOC · L2"]);
  const managerCard = page.getByTestId("l2-analyzed-tickets");
  await expect(managerCard).toBeVisible();
  await expect(managerCard.getByTestId("l2-reviewed-count")).toHaveText("۲");
  await managerCard.getByRole("button", { name: "حذف تیکت INC-1002" }).click();
  await managerCard.getByRole("button", { name: "تأیید حذف" }).click();
  await expect(managerCard.getByTestId("l2-reviewed-count")).toHaveText("۱");
  const report = await page.request.get(`/api/reports/shift?period=custom&from=${tehranDate()}&to=${tehranDate()}&user=${ids["SOC · L2"]}`);
  expect(report.status()).toBe(200);
  const result = await report.json();
  expect(result.sheets.find((sheet) => sheet.name === "L2 Ticket Analysis").rows).toHaveLength(1);
});
