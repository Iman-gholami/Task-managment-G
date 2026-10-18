// @ts-check
// End-to-end tests for configurable Shift Log checklists. Self-contained: it adds its own people, so it does not
// depend on (or disturb) the organisation that app.spec.js builds in the same database.
const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PW = "Checklists2026!";
const P = {
  manager: { name: "Nadia Rostami", email: "nadia@checklists.test", role: "soc_manager", team: "SOC" },
  kian: { name: "Kian Ahmadi", email: "kian@checklists.test", role: "analyst", team: "SOC · L2" },
  roya: { name: "Roya Karimi", email: "roya@checklists.test", role: "analyst", team: "SOC · L2" },
  dariush: { name: "Dariush Ebadi", email: "dariush@checklists.test", role: "analyst", team: "SOC · L1" },
  elham: { name: "Elham Nazari", email: "elham@checklists.test", role: "engineer", team: "Design & Automation" },
};
const ids = {};
const L2 = "Layer 2 technical routine";
const L2_ITEMS = ["Review escalated incidents", "Investigate unresolved alerts", "Verify ongoing incident investigations", "Complete technical shift handover"];

test.describe.configure({ mode: "serial" });

async function signIn(page, who) {
  const creds = who === "admin" ? ADMIN : { email: P[who].email, password: PW };
  const res = await page.request.post("/api/auth/login", { data: creds });
  expect(res.ok()).toBeTruthy();
}

function tehranDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}

const savedToggle = (page) => page.waitForResponse((r) => r.url().endsWith("/api/shift") && r.request().method() === "PATCH");

test("setup: a SOC manager, two Layer 2 analysts, a Layer 1 analyst and an engineer", async ({ page }) => {
  await signIn(page, "admin");
  for (const [key, p] of Object.entries(P)) {
    const res = await page.request.post("/api/members", { data: { ...p, password: PW } });
    expect(res.status(), key).toBe(201);
    ids[key] = (await res.json()).user.id;
  }
  // Everyone is on an extended shift today, so every standard item applies.
  for (const key of ["kian", "roya", "dariush"]) {
    const res = await page.request.post("/api/shift/schedule", { data: { userId: ids[key], date: tehranDate(), shiftType: "evening" } });
    expect(res.status(), key).toBe(201);
  }
});

test("only SOC Managers and Security Managers can manage checklists, enforced by the API", async ({ page }) => {
  for (const who of ["kian", "elham"]) {
    await signIn(page, who);
    expect((await page.request.get("/api/shift/checklists")).status(), who).toBe(403);
    expect((await page.request.post("/api/shift/checklists", { data: { name: "Sneaky" } })).status(), who).toBe(403);
    expect((await page.request.get("/api/shift/checklists/1")).status(), who).toBe(403);
    expect((await page.request.put("/api/shift/checklists/1", { data: { version: 1, name: "Sneaky", items: [] } })).status(), who).toBe(403);
    expect((await page.request.delete("/api/shift/checklists/1")).status(), who).toBe(403);
    expect((await page.request.get("/api/shift/checklist-assignments")).status(), who).toBe(403);
    expect((await page.request.put("/api/shift/checklist-assignments", { data: { team: "SOC · L2", enabled: false } })).status(), who).toBe(403);
    await page.goto("/shift/checklists");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator(".sidebar")).not.toContainText("Log checklists");
  }
  await page.context().clearCookies();
  expect((await page.request.get("/api/shift/checklists")).status()).toBe(401);

  for (const who of ["manager", "admin"]) {
    await signIn(page, who);
    const res = await page.request.get("/api/shift/checklists");
    expect(res.status(), who).toBe(200);
    const { checklists, groups } = await res.json();
    expect(checklists.map((c) => c.name)).toContain("Standard SOC routine");
    expect(groups.map((g) => g.team)).toEqual(["SOC · L1", "SOC · L2", "SOC · L3"]);
  }
});

test("before any configuration every SOC layer keeps the standard routine", async ({ page }) => {
  for (const who of ["kian", "dariush"]) {
    await signIn(page, who);
    const log = await (await page.request.get("/api/shift")).json();
    expect(log.checklist.name, who).toBe("Standard SOC routine");
    expect(log.activities).toHaveLength(8);
  }
});

test("SOC manager builds a Layer 2 checklist in the editor and assigns it to SOC · L2", async ({ page }) => {
  await signIn(page, "manager");
  await page.goto("/shift/checklists");
  await expect(page.locator("h1")).toHaveText("Shift Log checklists");
  await expect(page.locator(".sidebar")).toContainText("Log checklists");
  for (const team of ["SOC · L1", "SOC · L2", "SOC · L3"]) {
    await expect(page.locator(`[data-group="${team}"]`).getByLabel(`Checklist for ${team}`, { exact: true })).toHaveValue(/\d+/);
  }

  await page.getByRole("button", { name: "New checklist", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New checklist" });
  await dialog.getByRole("button", { name: "Create checklist" }).click();
  await expect(dialog.getByText("Give the checklist a name")).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill(L2);
  await dialog.getByRole("button", { name: "Create checklist" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Checklist name")).toHaveValue(L2);
  await expect(page.getByText("No items yet")).toBeVisible();

  // Add four items; the third is not done on night shifts.
  await page.getByRole("button", { name: "Add the first item" }).click();
  await expect(page.getByLabel("Item 1 title")).toBeFocused();
  for (let i = 0; i < L2_ITEMS.length; i++) {
    if (i > 0) await page.getByRole("button", { name: "Add item", exact: true }).click();
    // Typed out of order on purpose; the reorder below fixes it.
    const title = i === 2 ? L2_ITEMS[3] : i === 3 ? L2_ITEMS[2] : L2_ITEMS[i];
    await page.getByLabel(`Item ${i + 1} title`).fill(title);
  }
  await page.getByLabel("Item 2 type").selectOption("monitor");
  await page.getByLabel("Item 2 guidance").fill("Escalate to L3 when blocked");
  await page.getByRole("button", { name: "Move item 4 up" }).click();
  await expect(page.getByLabel("Item 3 title")).toHaveValue(L2_ITEMS[2]);
  await page.locator('[data-item="4"]').getByRole("button", { name: "Night" }).click();
  await expect(page.locator('[data-item="4"]').getByRole("button", { name: "Night" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Unsaved: 4 added")).toBeVisible();

  // Validation happens before anything is sent.
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Describe what the analyst should do.")).toBeVisible();
  await expect(page.getByLabel("Item 5 title")).toBeFocused();
  await page.getByRole("button", { name: "Remove item 5" }).click();

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`“${L2}” saved as version 2`)).toBeVisible();
  await expect(page.getByText("All changes saved · v2")).toBeVisible();

  // Assign it to Layer 2 (replaces the standard routine there, so it asks first).
  const card = page.locator('[data-group="SOC · L2"]');
  await card.getByLabel("Checklist for SOC · L2", { exact: true }).selectOption({ label: L2 });
  const confirm = page.getByRole("dialog", { name: `Switch SOC · L2 to “${L2}”?` });
  await expect(confirm).toContainText("Logs already in progress keep");
  await confirm.getByRole("button", { name: "Switch checklist" }).click();
  await expect(card.locator(".cl-group-head .badge")).toHaveText("Active");
  await expect(card.locator(".cl-group-counts")).toContainText("Night3");

  // Everything survives a reload, in the saved order.
  await page.reload();
  await page.locator(".cl-list").getByRole("button", { name: new RegExp(L2) }).click();
  await expect(page.getByLabel("Checklist name")).toHaveValue(L2);
  for (let i = 0; i < L2_ITEMS.length; i++) await expect(page.getByLabel(`Item ${i + 1} title`)).toHaveValue(L2_ITEMS[i]);
  await expect(page.locator('[data-group="SOC · L2"]').getByLabel("Checklist for SOC · L2", { exact: true })).toHaveValue(/\d+/);
  await expect(page.locator('[data-group="SOC · L1"]').locator("select")).not.toHaveValue(await page.locator('[data-group="SOC · L2"]').locator("select").inputValue());
  await expect(page.locator(".cl-history")).toContainText("Assigned to SOC · L2, replacing “Standard SOC routine”");
});

test("unsaved edits are protected when switching checklists or leaving the page", async ({ page }) => {
  await signIn(page, "manager");
  await page.goto("/shift/checklists");
  await page.locator(".cl-list").getByRole("button", { name: new RegExp(L2) }).click();
  await expect(page.getByLabel("Checklist name")).toHaveValue(L2);
  await page.getByLabel("Item 1 title").fill("Review escalated incidents — edited");
  await expect(page.getByText("Unsaved: 1 edited")).toBeVisible();

  await page.locator(".cl-list").getByRole("button", { name: /Standard SOC routine/ }).click();
  const discard = page.getByRole("dialog", { name: "Discard unsaved changes?" });
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Item 1 title")).toHaveValue("Review escalated incidents — edited");

  let asked = "";
  page.once("dialog", (d) => { asked = d.message(); d.dismiss(); });
  await page.locator(".sidebar").getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/shift\/checklists$/);
  expect(asked).toContain("unsaved checklist changes");

  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByText("All changes saved · v2")).toBeVisible();
});

test("Layer 2 analysts see their own checklist and complete it individually; Layer 1 is unchanged", async ({ page }) => {
  await signIn(page, "kian");
  await page.goto("/shift");
  await expect(page.getByTestId("shift-checklist")).toHaveText(`${L2} · v2`);
  for (let i = 0; i < L2_ITEMS.length; i++) await expect(page.locator(`#act-${i + 1} .t`)).toContainText(L2_ITEMS[i]);
  await expect(page.locator("#act-2 .t")).toContainText("Escalate to L3 when blocked");
  await expect(page.locator("#act-5")).toHaveCount(0);

  await Promise.all([savedToggle(page), page.locator("#act-1 .toggle-done").click()]);
  await Promise.all([savedToggle(page), page.locator("#act-3 .toggle-done").click()]);
  await expect(page.locator("#act-1")).toHaveClass(/done/);
  await page.reload();
  await expect(page.locator("#act-1 .cb")).toBeChecked();
  await expect(page.locator("#act-3 .cb")).toBeChecked();
  await expect(page.locator("#act-2 .cb")).not.toBeChecked();
  await expect(page.getByText("2 of 4 done")).toBeVisible();

  // The same items stay open for a colleague in the same group.
  await signIn(page, "roya");
  const roya = await (await page.request.get("/api/shift")).json();
  expect(roya.checklist.name).toBe(L2);
  expect(roya.activities.map((a) => a.done)).toEqual([false, false, false, false]);
  await page.goto("/shift");
  await expect(page.locator("#act-1 .cb")).not.toBeChecked();

  // Layer 1 keeps the standard routine, untouched by the Layer 2 work.
  await signIn(page, "dariush");
  const l1 = await (await page.request.get("/api/shift")).json();
  expect(l1.checklist.name).toBe("Standard SOC routine");
  expect(l1.activities).toHaveLength(8);
  expect(l1.activities.every((a) => !a.done)).toBeTruthy();
  await page.goto("/shift");
  await expect(page.locator("#act-8 .t")).toContainText("Add IOCs to MISP");

  // A manager reviewing the logs sees the same separation.
  await signIn(page, "manager");
  const kianLog = await (await page.request.get(`/api/shift?user=${ids.kian}&date=${tehranDate()}`)).json();
  expect(kianLog.activities.filter((a) => a.done).map((a) => a.title)).toEqual([L2_ITEMS[0], L2_ITEMS[2]]);
  const history = await (await page.request.get(`/api/shift/history?user=${ids.kian}`)).json();
  expect(history.logs).toHaveLength(1);
  expect(history.logs[0]).toMatchObject({ date: tehranDate(), done: 2, total: 4, checklist: L2, checklistVersion: 2 });
});

test("editing a checklist never rewrites a started log; stale pages cannot tick the wrong item", async ({ page }) => {
  await signIn(page, "admin"); // Security Managers manage checklists too.
  const list = await (await page.request.get("/api/shift/checklists")).json();
  const l2 = list.checklists.find((c) => c.name === L2);
  const items = l2.items.map((it) => ({ ...it }));
  items[0].title = "Review escalated incidents (P1 first)";
  const removed = items.splice(1, 1)[0];
  const saved = await page.request.put(`/api/shift/checklists/${l2.id}`, { data: { version: l2.version, name: l2.name, description: "", items } });
  expect(saved.status()).toBe(200);
  expect((await saved.json()).checklist.version).toBe(3);

  // A second save based on the old version is refused rather than overwriting.
  const stale = await page.request.put(`/api/shift/checklists/${l2.id}`, { data: { version: l2.version, name: "Overwrite", items: [] } });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).conflict).toBe(true);
  expect((await page.request.put(`/api/shift/checklists/${l2.id}`, { data: { version: 3, name: L2, items: [{ title: "" }] } })).status()).toBe(400);

  // Kian had started: his log keeps version 2.
  await signIn(page, "kian");
  const kian = await (await page.request.get("/api/shift")).json();
  expect(kian.checklist.version).toBe(2);
  expect(kian.activities.map((a) => a.title)).toEqual(L2_ITEMS);

  // Roya had not started: her log follows version 3. A page still showing version 2 is told to refresh.
  await signIn(page, "roya");
  const res = await page.request.patch("/api/shift", { data: { n: 2, itemId: removed.id, patch: { done: true } } });
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.stale).toBe(true);
  expect(body.log.checklist.version).toBe(3);
  expect(body.log.activities.map((a) => a.title)).toEqual(["Review escalated incidents (P1 first)", L2_ITEMS[2], L2_ITEMS[3]]);
  expect(body.log.activities.every((a) => !a.done)).toBeTruthy();

  // Opening the Shift Log now shows version 3.
  await page.goto("/shift");
  await expect(page.getByTestId("shift-checklist")).toHaveText(`${L2} · v3`);
});

test("a manager can turn a group's checklist off and on; analysts then see a clear empty state", async ({ page }) => {
  await signIn(page, "manager");
  await page.goto("/shift/checklists");
  const card = page.locator('[data-group="SOC · L2"]');
  await card.getByRole("switch", { name: "Use the checklist for SOC · L2" }).click();
  const confirm = page.getByRole("dialog", { name: "Turn off the checklist for SOC · L2?" });
  await confirm.getByRole("button", { name: "Turn off" }).click();
  await expect(card.locator(".cl-group-head .badge")).toHaveText("Turned off");

  await signIn(page, "roya");
  await page.goto("/shift");
  await expect(page.getByText("No checklist for SOC · L2 yet")).toBeVisible();
  await expect(page.getByTestId("shift-checklist")).toHaveText("None assigned");

  await signIn(page, "kian"); // already started: keeps his items
  expect((await (await page.request.get("/api/shift")).json()).activities).toHaveLength(4);

  await signIn(page, "manager");
  const on = await page.request.put("/api/shift/checklist-assignments", { data: { team: "SOC · L2", enabled: true } });
  expect(on.status()).toBe(200);
  expect((await on.json()).group).toMatchObject({ team: "SOC · L2", checklistName: L2, enabled: true });
  await signIn(page, "roya");
  expect((await (await page.request.get("/api/shift")).json()).activities).toHaveLength(3);
});

test("manager corrections show the log's own checklist version and are stamped", async ({ page }) => {
  await signIn(page, "manager");
  await page.goto("/shift/manage");
  await page.getByLabel("Analyst").selectOption(ids.kian);
  await expect(page.locator(".facts")).toContainText(`${L2} · v2`);
  await expect(page.locator(".act .t").first()).toContainText(L2_ITEMS[0]);

  const log = await (await page.request.get(`/api/shift?user=${ids.kian}&date=${tehranDate()}`)).json();
  const item = log.activities[1];
  const res = await page.request.patch("/api/shift", { data: { user: ids.kian, date: tehranDate(), n: item.n, itemId: item.itemId, patch: { note: "Checked with L3" } } });
  expect(res.status()).toBe(200);
  const corrected = (await res.json()).log.activities[1];
  expect(corrected).toMatchObject({ note: "Checked with L3", correctedBy: ids.manager });
  expect(corrected.correctedAt).toBeTruthy();
  // Naming a different item than the one at that position changes nothing.
  const wrong = await page.request.patch("/api/shift", { data: { user: ids.kian, date: tehranDate(), n: item.n, itemId: log.activities[0].itemId, patch: { done: true } } });
  expect(wrong.status()).toBe(409);
  expect((await wrong.json()).stale).toBe(true);
});

test("checklist screens work on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} ${m.text()}`));
  const noSideScroll = () => page.evaluate(() => {
    const c = document.querySelector(".content");
    return c.scrollWidth <= c.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1;
  });

  await signIn(page, "manager");
  await page.goto("/shift/checklists", { waitUntil: "domcontentloaded" });
  await page.locator(".cl-list").getByRole("button", { name: new RegExp(L2) }).click();
  await expect(page.getByLabel("Item 1 title")).toBeVisible();
  expect(await noSideScroll()).toBeTruthy();
  await page.getByLabel("Item 1 title").fill("Review escalated incidents, P1 first");
  await expect(page.getByRole("button", { name: "Save changes" })).toBeInViewport();
  await page.getByRole("button", { name: "Discard", exact: true }).click();

  await signIn(page, "roya");
  await page.goto("/shift", { waitUntil: "domcontentloaded" });
  expect(await noSideScroll()).toBeTruthy();
  await Promise.all([savedToggle(page), page.locator("#act-1 .toggle-done").click()]);
  await expect(page.locator("#act-1 .cb")).toBeChecked();
  expect(errors).toEqual([]);
});

test("checklist screens render without console errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} ${m.text()}`));
  for (const [who, paths] of [["manager", ["/shift/checklists"]], ["admin", ["/shift/checklists", "/admin"]], ["kian", ["/shift", "/shift/history", "/dashboard"]]]) {
    await signIn(page, who);
    for (const path of paths) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1").first()).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});
