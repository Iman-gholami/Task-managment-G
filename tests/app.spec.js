// @ts-check
const { test, expect } = require("@playwright/test");

const PASSWORD = "ChangeMe123!";
const USERS = { analyst: "sara@corp.local", soc: "leila@corp.local", security: "kaveh@corp.local" };

/** Signs in through the API; the session cookie is shared with the page. */
async function signIn(page, who = "analyst") {
  const res = await page.request.post("/api/auth/login", { data: { email: USERS[who], password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
}

test.describe.configure({ mode: "serial" });

test.describe("authentication", () => {
  test("unauthenticated users are sent to the login page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(USERS.analyst);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form [role=alert]")).toHaveText("Email or password is incorrect.");
  });

  test("sign in and sign out through the UI", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(USERS.analyst);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("h1")).toHaveText("Hello, Sara");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("APIs reject requests without a session", async ({ request }) => {
    expect((await request.get("/api/tasks")).status()).toBe(401);
  });
});

const ROUTES = [
  ["/dashboard", "Hello, Sara"],
  ["/tasks/my", "My Tasks"],
  ["/tasks/team", "Team Tasks"],
  ["/tasks/all", "All Tasks"],
  ["/tasks/T-1042", "Tune Splunk correlation rule"],
  ["/shift", "Shift Log —"],
  ["/shift/history", "Shift Log History"],
  ["/team", "Team"],
  ["/performance/overview", "Performance Overview"],
  ["/performance/employees", "Sara Rahimi"],
  ["/reports/employee", "Employee Monthly Report"],
  ["/reports/shift", "SOC Shift Activity Report"],
  ["/reports/tickets", "Ticket Report"],
  ["/admin", "Users & Roles"],
  ["/states", "Empty, loading & error states"],
];

test.describe("every screen renders without errors", () => {
  for (const [path, heading] of ROUTES) {
    test(path, async ({ page }) => {
      await signIn(page);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.goto(path);
      await expect(page.locator("h1").first()).toContainText(heading);
      expect(errors).toEqual([]);
    });
  }
});

test.describe("analyst", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("unknown task shows a recoverable not-found state", async ({ page }) => {
    await page.goto("/tasks/T-9999");
    await expect(page.getByText("Task not found")).toBeVisible();
    await page.getByRole("link", { name: "Go to My Tasks" }).click();
    await expect(page).toHaveURL(/\/tasks\/my$/);
  });

  test("theme toggle switches and persists across reloads", async ({ page }) => {
    await page.goto("/dashboard");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "light");
  });

  test("create task with the C shortcut; it is saved to the database", async ({ page }) => {
    await page.goto("/tasks/my");
    await page.locator("body").press("c");
    const dialog = page.getByRole("dialog", { name: "Create task" });
    await dialog.getByRole("button", { name: /Create Task/ }).click();
    await expect(dialog.getByText("Add a title to create the task.")).toBeVisible();
    await dialog.getByPlaceholder("Task title").fill("Rotate Grafana service account keys");
    await dialog.getByRole("button", { name: /Create Task/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("T-1043 created and assigned to Sara Rahimi")).toBeVisible();
    await page.reload();
    await expect(page.locator("tbody")).toContainText("Rotate Grafana service account keys");
  });

  test("inline status change persists after reload", async ({ page }) => {
    await page.goto("/tasks/my");
    const row = page.locator("tr", { hasText: "T-1042" });
    await row.locator('[data-edit="status"]').click();
    await page.getByRole("menuitem", { name: /Review/ }).click();
    await expect(row.locator('[data-edit="status"]')).toHaveText("Review");
    await expect(page).toHaveURL(/\/tasks\/my$/);
    await page.reload();
    await expect(page.locator("tr", { hasText: "T-1042" }).locator('[data-edit="status"]')).toHaveText("Review");
  });

  test("analysts cannot edit other people's tasks", async ({ page }) => {
    const res = await page.request.patch("/api/tasks/T-1041", { data: { status: "done" } });
    expect(res.status()).toBe(403);
  });

  test("keyboard triage: J moves the selection, Enter opens the task", async ({ page }) => {
    await page.goto("/tasks/team");
    await expect(page.locator("tr.kb")).toHaveCount(1);
    const second = await page.locator("tbody tr").nth(1).locator(".id").innerText();
    await page.locator("body").press("j");
    await page.locator("body").press("Enter");
    await expect(page).toHaveURL(new RegExp(`/tasks/${second}$`));
  });

  test("filters: add a status chip and reset", async ({ page }) => {
    await page.goto("/tasks/all");
    const total = await page.locator("tbody tr").count();
    await page.getByRole("button", { name: "Status", exact: true }).click();
    await page.getByRole("menuitem", { name: /Done/ }).click();
    const statuses = await page.locator('tbody [data-edit="status"]').allInnerTexts();
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((s) => s === "Done")).toBeTruthy();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(total);
  });

  test("shift log: report an issue on a monitoring activity", async ({ page }) => {
    await page.goto("/shift");
    const act = page.locator("#act-6");
    await act.getByRole("button", { name: "Report an issue" }).click();
    await act.getByLabel("Issue summary").fill("Security Center login page returned 502");
    await act.getByRole("button", { name: "Save issue" }).click();
    await expect(act).toContainText("Issue reported: Security Center login page returned 502");
    await expect(page.locator(".summary")).toContainText("2Issues reported");
    await page.reload();
    await expect(page.locator("#act-6")).toContainText("Issue reported: Security Center login page returned 502");
  });

  test("shift log: IOC count, tickets and completing the shift persist", async ({ page }) => {
    await page.goto("/shift");
    const ioc = page.getByLabel("IOC count", { exact: true });
    await page.getByRole("button", { name: "Increase IOC count" }).click();
    await expect(ioc).toHaveValue("7");
    await ioc.fill("12");
    await expect(page.locator(".summary")).toContainText("12IOCs added");

    await page.getByRole("button", { name: "Add Ticket" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Ticket number is required.")).toBeVisible();
    await page.getByLabel("Ticket number").fill("INC-2026-4480");
    await page.getByLabel("Description").fill("Defacement attempt blocked by WAF");
    await page.getByLabel("Description").press("Enter");
    await expect(page.getByText("Tickets Created: 3")).toBeVisible();

    await expect(page.getByText("autosaved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("IOC count", { exact: true })).toHaveValue("12");
    await expect(page.getByText("Tickets Created: 3")).toBeVisible();

    // The issue test above finished the last activity, so the shift can be completed.
    await page.getByRole("button", { name: "Complete Shift" }).click();
    await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
  });

  test("new tickets appear in the ticket report", async ({ page }) => {
    await page.goto("/reports/tickets");
    await page.getByPlaceholder("Search ticket number or description").fill("WAF");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody")).toContainText("INC-2026-4480");
  });

  test("command menu opens with Ctrl+K and navigates", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Control+k");
    await page.getByRole("menuitem", { name: "Ticket Report" }).click();
    await expect(page).toHaveURL(/\/reports\/tickets$/);
  });

  test("analysts cannot add or remove members", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByRole("button", { name: "Add Member" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    const res = await page.request.post("/api/members", { data: { name: "X Y", email: "x@corp.local", role: "analyst", team: "SOC · L1", password: "password123" } });
    expect(res.status()).toBe(403);
  });
});

test.describe("member management", () => {
  test("role dashboards", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toHaveText("SOC overview");
    await signIn(page, "security");
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toHaveText("Security Department");
  });

  test("SOC Manager adds an analyst who can then sign in, then removes them", async ({ page, browser }) => {
    await signIn(page, "soc");
    await page.goto("/team");
    await page.getByRole("button", { name: "Add Member" }).click();
    const dialog = page.getByRole("dialog", { name: "Add member" });
    // SOC Managers may only add Analysts to SOC layers.
    await expect(dialog.getByLabel("Role").locator("option")).toHaveText(["Analyst"]);
    await expect(dialog.getByLabel("Primary team").locator("option")).toHaveText(["SOC · L1", "SOC · L2", "SOC · L3"]);
    await dialog.getByLabel("Full name").fill("Parisa Ahmadi");
    await dialog.getByLabel("Work email").fill("parisa@corp.local");
    await dialog.getByLabel("Primary team").selectOption("SOC · L2");
    await dialog.getByLabel("Initial password").fill("Welcome2026!");
    await dialog.getByRole("button", { name: "Add Member" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("tbody")).toContainText("Parisa Ahmadi");

    // Duplicate email is rejected.
    await page.getByRole("button", { name: "Add Member" }).click();
    await dialog.getByLabel("Full name").fill("Parisa Duplicate");
    await dialog.getByLabel("Work email").fill("parisa@corp.local");
    await dialog.getByLabel("Initial password").fill("Welcome2026!");
    await dialog.getByRole("button", { name: "Add Member" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("A user with this email already exists.");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // The new member can sign in.
    const other = await browser.newContext();
    const login = await other.request.post(new URL("/api/auth/login", page.url()).href, { data: { email: "parisa@corp.local", password: "Welcome2026!" } });
    expect(login.ok()).toBeTruthy();

    // SOC Manager cannot remove an engineer from another team, but can remove the analyst.
    await expect(page.getByRole("button", { name: "Remove Mina Sadeghi" })).toHaveCount(0);
    await page.getByRole("button", { name: "Remove Parisa Ahmadi" }).click();
    await page.getByRole("dialog", { name: "Remove member" }).getByRole("button", { name: "Remove member" }).click();
    await expect(page.locator("tbody")).not.toContainText("Parisa Ahmadi");

    // Their session is revoked.
    expect((await other.request.get(new URL("/api/tasks", page.url()).href)).status()).toBe(401);
    await other.close();
  });

  test("Security Manager can add a SOC Manager but not remove another Security Manager or themselves", async ({ page }) => {
    await signIn(page, "security");
    await page.goto("/team");
    await page.getByRole("button", { name: "Add Member" }).click();
    const dialog = page.getByRole("dialog", { name: "Add member" });
    await dialog.getByLabel("Full name").fill("Omid Rostami");
    await dialog.getByLabel("Work email").fill("omid@corp.local");
    await dialog.getByLabel("Role").selectOption("soc_manager");
    await dialog.getByLabel("Primary team").selectOption("SOC");
    await dialog.getByLabel("Initial password").fill("Welcome2026!");
    await dialog.getByRole("button", { name: "Add Member" }).click();
    await expect(page.locator("tbody")).toContainText("Omid Rostami");
    await expect(page.getByRole("button", { name: "Remove Kaveh Farahani" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove Leila Nouri" })).toHaveCount(1);
    const self = await page.request.delete("/api/members/kf");
    expect(self.status()).toBe(403);
  });
});
