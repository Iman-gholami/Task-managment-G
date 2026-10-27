const { test, expect } = require("@playwright/test");
const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PW = "Duty-Mode-2026!";
const today = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

test("shift duties vary by date and roster type rather than the user's SOC layer", async ({ page }) => {
  expect((await page.request.post("/api/auth/login", { data: ADMIN })).status()).toBe(200);
  const members = [
    ["duty-mode-l2-day@test.invalid", "SOC · L2", "analyst", "morning"],
    ["duty-mode-l2-cover@test.invalid", "SOC · L2", "analyst", "evening"],
    ["duty-mode-l3-day@test.invalid", "SOC · L3", "analyst", "morning"],
    ["duty-mode-design-cover@test.invalid", "Design & Automation", "engineer", "evening"],
  ];
  const ids = {};
  for (const [email, team, role, shiftType] of members) {
    const res = await page.request.post("/api/members", { data: {
      email, name: email.split("@")[0], team, role, password: PW, province: "قم",
    } });
    expect(res.status()).toBe(201);
    const id = (await res.json()).user.id;
    ids[email] = id;
    expect((await page.request.post("/api/shift/schedule", { data: {
      userId: id, date: today(), shiftType,
    } })).status()).toBe(201);
  }

  await page.request.post("/api/auth/login", { data: { email: members[0][0], password: PW } });
  const dayL2 = await (await page.request.get("/api/shift")).json();
  expect(dayL2.mode).toBe("ticket_analysis");
  expect(dayL2.activities).toHaveLength(0);
  await page.goto("/shift");
  await expect(page.getByTestId("l2-analyzed-tickets")).toBeVisible();
  await expect(page.getByRole("heading", { name: "SOC shift duties" })).toHaveCount(0);

  await page.request.post("/api/auth/login", { data: { email: members[1][0], password: PW } });
  const coverL2 = await (await page.request.get("/api/shift")).json();
  expect(coverL2.mode).toBe("operational");
  expect(coverL2.activities).toHaveLength(8);
  expect(coverL2.activities.map((x) => x.title)).toContain("Prepare Daily Traffic Report");
  await page.goto("/shift");
  await expect(page.getByRole("heading", { name: "SOC shift duties" })).toBeVisible();
  await expect(page.getByTestId("l2-analyzed-tickets")).toHaveCount(0);
  const rejected = await page.request.post("/api/shift/analyzed-tickets", {
    data: { ticketNumber: "INC-COVER", verdict: "false_positive" },
  });
  expect(rejected.status()).toBe(403);
  const done = await page.request.patch("/api/shift", { data: {
    n: 1, itemId: coverL2.activities[0].itemId, patch: { done: true },
  } });
  expect(done.status()).toBe(200);
  expect((await page.request.patch("/api/shift", { data: { completed: true } })).status()).toBe(400);

  await page.request.post("/api/auth/login", { data: { email: members[2][0], password: PW } });
  const dayL3 = await (await page.request.get("/api/shift")).json();
  expect(dayL3.mode).toBe("engineering");
  // Managers may have replaced the built-in engineering options with a custom L3 checklist.
  expect(dayL3.activities.length).toBeGreaterThan(0);
  if (dayL3.checklist.name === "Layer 3 · Engineering daily work") {
    expect(dayL3.activities.map((x) => x.title).join(" ")).toMatch(/Automation and scripting/);
    expect(dayL3.activities.map((x) => x.title).join(" ")).toMatch(/Bug fixing and troubleshooting/);
  }
  await page.goto("/shift");
  await expect(page.getByRole("heading", { name: "Engineering daily work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Created tickets" })).toHaveCount(0);

  await page.request.post("/api/auth/login", { data: { email: members[3][0], password: PW } });
  const coverDesign = await (await page.request.get("/api/shift")).json();
  expect(coverDesign.mode).toBe("operational");
  expect(coverDesign.activities.map((x) => x.title)).toEqual(coverL2.activities.map((x) => x.title));
  await page.goto("/shift");
  await expect(page.getByRole("heading", { name: "SOC shift duties" })).toBeVisible();
});
