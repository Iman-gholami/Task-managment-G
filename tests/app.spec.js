// @ts-check
// End-to-end tests. The database starts empty (only the administrator exists), so the first
// tests build the organisation through the UI/API exactly as a real administrator would.
const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PW = "Welcome2026!";
const U = {
  soc: { name: "Leila Nouri", email: "leila@corp.test", role: "soc_manager", team: "SOC" },
  sara: { name: "Sara Rahimi", email: "sara@corp.test", role: "analyst", team: "SOC · L1" },
  arash: { name: "Arash Moradi", email: "arash@corp.test", role: "analyst", team: "SOC · L2" },
  mina: { name: "Mina Sadeghi", email: "mina@corp.test", role: "engineer", team: "Design & Automation" },
};
const ids = {};

test.describe.configure({ mode: "serial" });

async function signIn(page, who) {
  const creds = who === "admin" ? ADMIN : { email: U[who].email, password: PW };
  const res = await page.request.post("/api/auth/login", { data: creds });
  expect(res.ok()).toBeTruthy();
}

async function createTask(page, title, assignee) {
  const res = await page.request.post("/api/tasks", { data: { title, a: ids[assignee], prio: "normal", cx: 2 } });
  expect(res.status()).toBe(201);
  return (await res.json()).task.id;
}

function tehranDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

test.describe("fresh install", () => {
  test("starts with only the administrator and no sample data", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(ADMIN.email);
    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("h1")).toHaveText("Security Department");
    const users = (await (await page.request.get("/api/members")).json()).users;
    expect(users.map((u) => u.email)).toEqual([ADMIN.email]);
    expect((await (await page.request.get("/api/tasks")).json()).tasks).toEqual([]);
    await page.goto("/team");
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });

  test("wrong password shows an error; unauthenticated users go to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Work email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form [role=alert]")).toHaveText("Email or password is incorrect.");
    expect((await page.request.get("/api/tasks")).status()).toBe(401);
  });

  test("login throttles repeated failed attempts", async ({ page }) => {
    const email = "rate-limit-probe@invalid.test";
    for (let i = 0; i < 5; i += 1) {
      const res = await page.request.post("/api/auth/login", { data: { email, password: "wrong-password" } });
      expect(res.status()).toBe(401);
    }
    const blocked = await page.request.post("/api/auth/login", { data: { email, password: "wrong-password" } });
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);

    // Throttling one identifier must not lock unrelated users out.
    const other = await page.request.post("/api/auth/login", { data: { email: "another-probe@invalid.test", password: "wrong-password" } });
    expect(other.status()).toBe(401);
  });

  test("administrator adds the team from the Team page", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/team");
    for (const key of ["soc", "sara", "arash", "mina"]) {
      const u = U[key];
      await page.getByRole("button", { name: "Add Member" }).click();
      const dialog = page.getByRole("dialog", { name: "Add member" });
      await dialog.getByLabel("Full name").fill(u.name);
      await dialog.getByLabel("Work email").fill(u.email);
      await dialog.getByLabel("Role").selectOption(u.role);
      await dialog.getByLabel("Primary team").selectOption(u.team);
      await dialog.getByLabel("Initial password").fill(PW);
      await dialog.getByRole("button", { name: "Add Member" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator("tbody")).toContainText(u.name);
    }
    for (const u of (await (await page.request.get("/api/members")).json()).users) {
      const key = Object.keys(U).find((k) => U[k].email === u.email);
      if (key) ids[key] = u.id;
    }
    expect(Object.keys(ids)).toHaveLength(4);
  });
});

test.describe("shift logs are for SOC analysts only", () => {
  test("SOC manager has shift scheduling but no personal shift log", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toHaveText("SOC overview");
    await expect(page.locator(".sidebar")).toContainText("Shift Schedule");
    await expect(page.locator(".sidebar")).not.toContainText("Shift Log");
    await expect(page.locator(".content")).not.toContainText("Shift Log");
    for (const path of ["/shift", "/shift/history", "/shift/team"]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/:\d+\/shift/);
    }
    expect((await page.request.patch("/api/shift", { data: { n: 1, patch: { done: true } } })).status()).toBe(403);
  });

  test("security manager has scheduling; engineers have no shift features", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.locator(".sidebar")).toContainText("Shift Schedule");
    await expect(page.locator(".sidebar")).not.toContainText("Shift Log");
    expect((await page.request.post("/api/shift/tickets", { data: { no: "X-1" } })).status()).toBe(403);

    await signIn(page, "mina");
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.locator(".sidebar")).not.toContainText("Shift Schedule");
    await expect(page.locator(".sidebar")).not.toContainText("Shift Log");
    expect((await page.request.post("/api/shift/tickets", { data: { no: "X-1" } })).status()).toBe(403);
  });

  test("analyst fills today's log: activities, IOC count, issue, tickets, complete", async ({ page }) => {
    await signIn(page, "soc");
    const assigned = await page.request.post("/api/shift/schedule", {
      data: { userId: ids.sara, date: tehranDate(), shiftType: "evening" },
    });
    expect(assigned.status()).toBe(201);

    await signIn(page, "sara");
    await page.goto("/shift");
    await expect(page.locator("h1")).toContainText("Shift Log —");
    for (const n of [1, 2, 3, 4, 5, 7, 8]) await page.locator(`#act-${n} .toggle-done`).click();
    await page.getByRole("button", { name: "Increase IOC count" }).click();
    await page.getByLabel("IOC count", { exact: true }).fill("12");
    await page.locator("#act-6").getByRole("button", { name: "Report an issue" }).click();
    await page.locator("#act-6").getByLabel("Issue summary").fill("Security Center login page returned 502");
    await page.locator("#act-6").getByRole("button", { name: "Save issue" }).click();
    await page.getByRole("button", { name: "Add Ticket" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Ticket number is required.")).toBeVisible();
    await page.getByLabel("Ticket number").fill("INC-2026-4480");
    await page.getByLabel("Description").fill("Defacement attempt blocked by WAF");
    await page.getByLabel("Description").press("Enter");
    await expect(page.getByTestId("ticket-count")).toHaveText("1 ticket");
    await expect(page.getByText("autosaved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("IOC count", { exact: true })).toHaveValue("12");
    await page.getByRole("button", { name: "Complete Shift" }).click();
    await expect(page.getByText("Submitted — manager correction only")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reopen" })).toHaveCount(0);

    // Submission is a permanent analyst-side lock, including direct API calls.
    expect((await page.request.patch("/api/shift", { data: { completed: false } })).status()).toBe(409);
    expect((await page.request.patch("/api/shift", { data: { n: 8, patch: { iocs: 99 } } })).status()).toBe(409);
    expect((await page.request.post("/api/shift/tickets", { data: { no: "INC-LOCKED" } })).status()).toBe(409);

    // A manager can correct the submitted log without reopening it for the analyst.
    await signIn(page, "soc");
    const managerView = await page.request.get(`/api/shift?user=${ids.sara}&date=${tehranDate()}`);
    expect(managerView.status()).toBe(200);
    const corrected = await page.request.patch("/api/shift", {
      data: { user: ids.sara, date: tehranDate(), n: 8, patch: { iocs: 13, note: "Manager correction" } },
    });
    expect(corrected.status()).toBe(200);
    expect((await corrected.json()).log.activities.find((a) => a.n === 8).iocs).toBe(13);

    await page.goto("/shift/manage");
    await expect(page.locator("h1")).toHaveText("Shift log corrections");
    await expect(page.getByText("Submitted & locked")).toBeVisible();

    await signIn(page, "sara");
    expect((await page.request.patch("/api/shift", { data: { n: 8, patch: { iocs: 14 } } })).status()).toBe(409);
    const locked = await (await page.request.get("/api/shift")).json();
    expect(locked.activities.find((a) => a.n === 8).iocs).toBe(13);
    expect(locked.completedAt).toBeTruthy();
  });
});

test.describe("manager assigns and follows up tasks", () => {
  test("create tasks for people and find them under Assigned by Me, grouped by assignee", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/tasks", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/tasks\/assigned$/);
    await expect(page.getByText("You haven't assigned any tasks yet")).toBeVisible();

    await page.getByRole("button", { name: "Create task", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create task" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Task title").fill("Tune Splunk correlation rule for VPN logins");
    await dialog.getByRole("button", { name: /Create task/ }).click();
    await expect(dialog.getByText("Choose who this task is for.")).toBeVisible();
    await dialog.getByLabel("Assignee").selectOption(ids.sara);
    await dialog.getByRole("button", { name: /Create task/ }).click();
    await expect(dialog).toBeHidden();

    ids.t1 = "T-1001";
    ids.t2 = await createTask(page, "Document phishing triage playbook", "arash");
    ids.t3 = await createTask(page, "Review scanner coverage gaps", "sara");

    await page.reload();
    await expect(page.getByTestId(`group-${ids.sara}`)).toContainText("2 tasks");
    await expect(page.getByTestId(`group-${ids.arash}`)).toContainText("1 task");
    await expect(page.locator("tbody")).toContainText("Tune Splunk correlation rule");

    await page.locator("select[aria-label=Assignee]").selectOption(ids.arash);
    await expect(page.locator("tbody tr:not(.group-row)")).toHaveCount(1);
    await page.getByRole("button", { name: "Reset" }).click();
    await page.getByRole("tab", { name: /Needs review/ }).click();
    await expect(page.getByText("Nothing waiting for review")).toBeVisible();
  });

  test("analysts see their assigned tasks and a notification", async ({ page }) => {
    await signIn(page, "sara");
    await page.goto("/tasks/my", { waitUntil: "networkidle" });
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.locator(".pop")).toContainText("New task assigned");
  });

  test("analysts cannot enumerate or access another analyst's tasks", async ({ page }) => {
    await signIn(page, "arash");
    const list = await page.request.get("/api/tasks");
    expect(list.status()).toBe(200);
    const tasks = (await list.json()).tasks;
    expect(tasks.every((task) => task.a === ids.arash)).toBeTruthy();
    expect(tasks.map((task) => task.id)).not.toContain(ids.t1);
    expect(tasks.map((task) => task.id)).not.toContain(ids.t3);
    expect((await page.request.get(`/api/tasks/${ids.t1}`)).status()).toBe(404);
    expect((await page.request.post(`/api/tasks/${ids.t1}/comments`, { data: { body: "should not be allowed" } })).status()).toBe(404);
    expect((await page.request.post(`/api/tasks/${ids.t1}/checklist`, { data: { label: "should not be allowed" } })).status()).toBe(404);
  });

  test("SOC managers cannot assign tasks outside their SOC scope", async ({ page }) => {
    await signIn(page, "soc");
    const res = await page.request.post("/api/tasks", { data: { title: "Out of scope", a: ids.mina, prio: "normal", cx: 2 } });
    expect(res.status()).toBe(403);
  });
});

test.describe("task workflow", () => {
  test("analyst starts and submits for review; cannot approve own work", async ({ page }) => {
    await signIn(page, "sara");
    await page.goto(`/tasks/${ids.t1}`);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.locator(".detail-side .status").first()).toHaveText("In Progress");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Waiting for review")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    expect((await page.request.patch(`/api/tasks/${ids.t1}`, { data: { status: "done", quality: "excellent" } })).status()).toBe(409);
  });

  test("manager sees it in Needs review, approves once; decision can't be flipped", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/tasks/assigned");
    await page.getByRole("tab", { name: /Needs review/ }).click();
    await page.locator("tr", { hasText: ids.t1 }).locator("td.title").click();
    await page.getByRole("button", { name: "Approve" }).click();
    await page.getByRole("menuitem", { name: /Excellent/ }).click();
    await expect(page.locator(".callout", { hasText: "Approved ·" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Return for changes" })).toHaveCount(0);
    expect((await page.request.patch(`/api/tasks/${ids.t1}`, { data: { status: "returned" } })).status()).toBe(409);
    expect((await page.request.patch(`/api/tasks/${ids.t1}`, { data: { quality: "good" } })).status()).toBe(400);
    await page.goto("/tasks/assigned");
    await page.getByRole("tab", { name: /Done/ }).click();
    await page.locator("tr", { hasText: ids.t1 }).locator('[data-edit="status"]').click();
    await expect(page.getByRole("menuitem")).toHaveText([/Reopen/]);
  });

  test("manager returns a task; the analyst resumes it", async ({ page }) => {
    await signIn(page, "arash");
    await page.goto(`/tasks/${ids.t2}`);
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Waiting for review")).toBeVisible();
    await signIn(page, "soc");
    await page.goto(`/tasks/${ids.t2}`);
    await page.getByRole("button", { name: "Return for changes" }).click();
    await expect(page.locator(".detail-side .status").first()).toHaveText("Returned");
    await signIn(page, "arash");
    await page.goto(`/tasks/${ids.t2}`);
    await page.getByRole("button", { name: "Resume work" }).click();
    await expect(page.locator(".detail-side .status").first()).toHaveText("In Progress");
  });

  test("checklist, comments and attachments persist", async ({ page }) => {
    await signIn(page, "sara");
    await page.goto(`/tasks/${ids.t3}`);
    await page.getByLabel("New checklist item").fill("Export scanner inventory");
    await page.getByLabel("New checklist item").press("Enter");
    await page.locator("label.check-item", { hasText: "Export scanner inventory" }).locator("input").check();
    await page.getByLabel("New comment").fill("Started on this, @Leila Nouri FYI");
    await page.getByRole("button", { name: /^Comment/ }).click();
    await expect(page.locator(".mention", { hasText: "@Leila Nouri" })).toBeVisible();
    await page.getByTestId("attach-input").setInputFiles({ name: "inventory.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByRole("link", { name: /inventory\.txt/ })).toBeVisible();
    await page.reload();
    await expect(page.locator("label.check-item", { hasText: "Export scanner inventory" }).locator("input")).toBeChecked();
    await expect(page.getByText("Started on this")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /inventory\.txt/ }).click()]);
    expect(download.suggestedFilename()).toBe("inventory.txt");
  });

  test("attachments cannot be downloaded across task ownership", async ({ page }) => {
    await signIn(page, "sara");
    const own = await page.request.get(`/api/tasks/${ids.t3}`);
    expect(own.status()).toBe(200);
    const attachmentId = (await own.json()).details.attachments[0].id;

    await signIn(page, "arash");
    expect((await page.request.get(`/api/tasks/${ids.t3}/attachments/${attachmentId}`)).status()).toBe(404);
    expect((await page.request.delete(`/api/tasks/${ids.t3}/attachments/${attachmentId}`)).status()).toBe(404);
  });
});

test.describe("performance", () => {
  test("each employee has their own page with their own numbers", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/performance/overview");
    await page.locator("tr", { hasText: "Sara Rahimi" }).locator("td.title").click();
    await expect(page).toHaveURL(new RegExp(`/performance/employees/${ids.sara}$`));
    await expect(page.locator("h1")).toHaveText("Sara Rahimi");
    await expect(page.locator(".metric", { hasText: "Completed tasks" })).toContainText("1");
    await expect(page.locator(".metric", { hasText: "MISP IOCs" })).toContainText("12");
    await expect(page.locator("tbody")).toContainText("Tune Splunk correlation rule");

    await page.getByLabel("Employee", { exact: true }).selectOption(ids.arash);
    await expect(page).toHaveURL(new RegExp(`/performance/employees/${ids.arash}$`));
    await expect(page.locator("h1")).toHaveText("Arash Moradi");
    await expect(page.locator(".metric", { hasText: "Completed tasks" })).toContainText("0");
    await expect(page.getByText("Tune Splunk correlation rule")).toHaveCount(0);

    await page.goto("/team");
    await page.locator("tr", { hasText: "Mina Sadeghi" }).locator("td.title").click();
    await expect(page.locator("h1")).toHaveText("Mina Sadeghi");
    await expect(page.getByText("Routine Activity")).toHaveCount(0); // not a shift analyst
  });

  test("analysts only see their own performance", async ({ page }) => {
    await signIn(page, "arash");
    await page.goto(`/performance/employees/${ids.sara}`);
    await expect(page).toHaveURL(new RegExp(`/performance/employees/${ids.arash}$`));
    expect((await page.request.get(`/api/performance?user=${ids.sara}`)).status()).toBe(403);
  });
});

test.describe("reports", () => {
  for (const report of ["employee", "team", "task", "shift", "tickets"]) {
    test(`${report} report exports a real Excel file`, async ({ page }) => {
      await signIn(page, "admin");
      const res = await page.request.get(`/api/reports/${report}?period=this&user=${ids.sara}&format=xlsx`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("spreadsheetml");
      expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
    });
  }

  test("ticket report lists registered tickets", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/reports/tickets");
    await expect(page.locator("tbody")).toContainText("INC-2026-4480");
  });
});

test.describe("members and accounts", () => {
  test("SOC manager edits an analyst, cannot manage others", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/team");
    await expect(page.getByRole("button", { name: "Edit Mina Sadeghi" })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit Arash Moradi" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit member" });
    await expect(dialog.getByLabel("Role").locator("option")).toHaveText(["Analyst"]);
    await dialog.getByLabel("Primary team").selectOption("SOC · L3");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("tr", { hasText: "Arash Moradi" })).toContainText("SOC · L3");
    expect((await page.request.patch(`/api/members/${ids.arash}`, { data: { role: "soc_manager" } })).status()).toBe(403);
  });

  test("SOC manager adds and removes an analyst; removal ends their session", async ({ page, browser }) => {
    await signIn(page, "soc");
    await page.goto("/team");
    await page.getByRole("button", { name: "Add Member" }).click();
    const dialog = page.getByRole("dialog", { name: "Add member" });
    await dialog.getByLabel("Full name").fill("Parisa Ahmadi");
    await dialog.getByLabel("Work email").fill("parisa@corp.test");
    await dialog.getByLabel("Initial password").fill(PW);
    await dialog.getByRole("button", { name: "Add Member" }).click();
    await expect(page.locator("tbody")).toContainText("Parisa Ahmadi");
    const other = await browser.newContext();
    const url = (p) => new URL(p, page.url()).href;
    expect((await other.request.post(url("/api/auth/login"), { data: { email: "parisa@corp.test", password: PW } })).ok()).toBeTruthy();
    await page.getByRole("button", { name: "Remove Parisa Ahmadi" }).click();
    await page.getByRole("dialog", { name: "Remove member" }).getByRole("button", { name: "Remove member" }).click();
    await expect(page.locator("tbody")).not.toContainText("Parisa Ahmadi");
    expect((await other.request.get(url("/api/tasks"))).status()).toBe(401);
    await other.close();
  });

  test("change own password", async ({ page, browser }) => {
    await signIn(page, "mina");
    await page.goto("/account");
    await page.getByLabel("Current password").fill(PW);
    await page.getByLabel("New password", { exact: true }).fill("NewPass2026!");
    await page.getByLabel("Confirm new password").fill("NewPass2026!");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();
    const ctx = await browser.newContext();
    const url = new URL("/api/auth/login", page.url()).href;
    expect((await ctx.request.post(url, { data: { email: U.mina.email, password: PW } })).status()).toBe(401);
    expect((await ctx.request.post(url, { data: { email: U.mina.email, password: "NewPass2026!" } })).ok()).toBeTruthy();
    await ctx.close();
  });
});

test.describe("analytics (management dashboard)", () => {
  test("security manager sees real figures; status changes are recorded as structured history", async ({ page }) => {
    await signIn(page, "admin");
    const facts = await (await page.request.get("/api/analytics")).json();
    expect(facts.scope.kind).toBe("department");
    expect(facts.people.filter((p) => p.active).map((p) => p.id).sort()).toEqual([ids.arash, ids.mina, ids.sara, ids.soc].sort());
    // A removed member stays in the history, flagged inactive.
    expect(facts.people.filter((p) => !p.active)).toHaveLength(1);
    const t1 = facts.tasks.find((t) => t.id === ids.t1);
    expect(t1.status).toBe("done");
    expect(t1.quality).toBe("excellent");
    expect(t1.completed).toBe(tehranDate());
    expect(facts.tasks.find((t) => t.id === ids.t2).returns).toHaveLength(1);
    expect(facts.shifts.some((s) => s.a === ids.sara && s.closed)).toBeTruthy();

    await page.goto("/analytics", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toHaveText("داشبورد مدیریتی");
    await expect(page.getByTestId("status")).toBeVisible();
    await expect(page.getByTestId("kpi-completed")).toContainText("۱");
    await expect(page.getByTestId("team-table")).toContainText("SOC");
    await expect(page.locator(".sidebar")).toContainText("Analytics");
  });

  test("demo data is opt-in and clearly labelled", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/analytics", { waitUntil: "networkidle" });
    await page.getByTestId("demo-toggle").click();
    await expect(page).toHaveURL(/demo=1/);
    await expect(page.locator(".an-demo")).toContainText("داده نمایشی");
    await page.getByRole("link", { name: "کارشناسان" }).click();
    await expect(page).toHaveURL(/\/analytics\/people\?.*demo=1/);
    await expect(page.getByTestId("people-table")).toContainText("سارا رحیمی");
  });

  test("period menu: presets and a custom Jalali range drive every view through the URL", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/analytics?demo=1", { waitUntil: "networkidle" });
    await page.getByTestId("period").click();
    await page.getByRole("button", { name: "ماه گذشته" }).click();
    await expect(page).toHaveURL(/p=prev-month/);
    await page.getByTestId("period").click();
    await page.getByRole("button", { name: "بازه دلخواه…" }).click();
    const days = page.locator(".an-cal-day:not([disabled])");
    await days.first().click();
    await days.nth(2).click();
    await page.getByRole("button", { name: "اعمال" }).click();
    await expect(page).toHaveURL(/p=custom&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
    await page.getByRole("link", { name: "روندها" }).click();
    await expect(page).toHaveURL(/\/analytics\/trends\?p=custom/);
    await expect(page.getByTestId("chart-trend")).toBeVisible();
  });

  test("Excel exports follow the screen's filters and the viewer's scope", async ({ page }) => {
    await signIn(page, "admin");
    for (const q of ["kind=full", "kind=full&team=soc&p=last-30", "kind=teams", `kind=person&id=${ids.sara}`, "kind=full&demo=1"]) {
      const res = await page.request.get(`/api/analytics/export?${q}`);
      expect(res.status(), q).toBe(200);
      expect(res.headers()["content-type"]).toContain("spreadsheetml");
      expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
    }
    expect((await page.request.get("/api/analytics/export?kind=person&id=nobody")).status()).toBe(404);
  });

  test("a SOC manager's analytics cover SOC only", async ({ page }) => {
    await signIn(page, "soc");
    const facts = await (await page.request.get("/api/analytics")).json();
    expect(facts.scope.kind).toBe("soc");
    expect(facts.people.every((p) => p.group === "SOC")).toBeTruthy();
    expect(facts.people.map((p) => p.id)).not.toContain(ids.mina);
  });

  test("analysts only see their own statistics", async ({ page }) => {
    await signIn(page, "arash");
    await page.goto("/analytics");
    await expect(page).toHaveURL(new RegExp(`/analytics/people/${ids.arash}`));
    await expect(page.locator("h1")).toHaveText("Arash Moradi");
    await page.goto(`/analytics/people/${ids.sara}`);
    await expect(page).toHaveURL(new RegExp(`/analytics/people/${ids.arash}`));
    const facts = await (await page.request.get("/api/analytics")).json();
    expect(facts.people.map((p) => p.id)).toEqual([ids.arash]);
    expect(facts.tasks.every((t) => t.a === ids.arash)).toBeTruthy();
    expect((await page.request.get("/api/analytics?demo=1")).status()).toBe(403);
    expect((await page.request.get("/api/analytics/export?kind=full")).status()).toBe(403);
    expect((await page.request.get(`/api/analytics/export?kind=person&id=${ids.arash}`)).status()).toBe(200);
  });

  test("every analytics screen renders without console errors", async ({ page }) => {
    await signIn(page, "admin");
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} ${m.text()}`));
    for (const demo of ["", "demo=1"]) {
      for (const path of ["/analytics", "/analytics/teams", "/analytics/teams?team=soc", "/analytics/people", "/analytics/compare", "/analytics/trends", "/analytics/soc", "/analytics/alerts", "/analytics/report", `/analytics/people/${demo ? "d-srh" : ids.sara}`]) {
        await page.goto(`${path}${path.includes("?") ? "&" : "?"}${demo}`, { waitUntil: "networkidle" });
        await expect(page.locator("h1").first()).toBeVisible();
        await expect(page.locator(".an-body, .an .empty").first()).toBeVisible();
      }
    }
    expect(errors).toEqual([]);
  });
});

test.describe("every screen renders without console errors", () => {
  const screens = {
    sara: ["/dashboard", "/tasks/my", "/tasks/team", "/shift", "/shift/history", "/team", "/reports/employee", "/reports/tickets", "/account"],
    soc: ["/dashboard", "/tasks/assigned", "/tasks/team", "/tasks/my", "/performance/overview", "/reports/team", "/reports/task", "/reports/shift", "/admin", "/team"],
    admin: ["/dashboard", "/tasks/team", "/performance/overview", "/team"],
  };
  for (const [who, paths] of Object.entries(screens)) {
    test(who, async ({ page }) => {
      if (who === "mina") return;
      await signIn(page, who);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} ${m.text()}`));
      for (const path of paths) {
        await page.goto(path, { waitUntil: "networkidle" });
        await expect(page.locator("h1").first()).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  }
});

test.describe("themes", () => {
  test("theme menu, Appearance and sign-in swatches switch and remember the theme", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/dashboard");
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);

    await page.getByRole("button", { name: "Theme" }).click();
    await page.getByRole("menuitemradio", { name: /Black Gold/ }).click();
    await expect.poll(theme).toBe("gold");

    // Remembered across reloads, applied before first paint.
    await page.reload();
    expect(await theme()).toBe("gold");
    await page.getByRole("button", { name: "Theme" }).click();
    await expect(page.getByRole("menuitemradio", { name: /Black Gold/ })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("4");
    await expect.poll(theme).toBe("midnight");

    await page.goto("/account");
    const appearance = page.getByRole("radiogroup", { name: "Theme" });
    await expect(appearance.getByRole("radio", { name: /Midnight/ })).toHaveAttribute("aria-checked", "true");
    await appearance.getByRole("radio", { name: /Daylight/ }).click();
    await expect.poll(theme).toBe("light");
    await appearance.getByRole("radio", { name: /Daylight/ }).press("ArrowRight");
    await expect.poll(theme).toBe("dark");

    await page.context().clearCookies();
    await page.goto("/login");
    expect(await theme()).toBe("dark");
    await page.getByRole("radio", { name: "Black Gold" }).click();
    await expect.poll(theme).toBe("gold");
  });
});
