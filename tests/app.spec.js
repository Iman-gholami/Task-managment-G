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
  ["/performance/employees", "Sara Rahimi"],
  ["/reports/employee", "Employee Monthly Report"],
  ["/reports/shift", "SOC Shift Activity Report"],
  ["/reports/tickets", "Ticket Report"],
  ["/account", "Sara Rahimi"],
  ["/states", "Empty, loading & error states"],
];

const MANAGER_ROUTES = [
  ["/dashboard", "SOC overview"],
  ["/shift/team", "Team Shift Logs"],
  ["/shift/history", "Shift Log History"],
  ["/performance/overview", "Performance Overview"],
  ["/performance/employees", "Leila Nouri"],
  ["/reports/team", "Team Monthly Report"],
  ["/reports/task", "Task Report"],
  ["/admin", "Users & Roles"],
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

test.describe("every manager screen renders without errors", () => {
  for (const [path, heading] of MANAGER_ROUTES) {
    test(path, async ({ page }) => {
      await signIn(page, "soc");
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
    await page.goto("/dashboard", { waitUntil: "networkidle" }); // wait for hydration
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

test.describe("task workflow", () => {
  test("analyst cannot approve their own task", async ({ page }) => {
    await signIn(page);
    // T-1042 was moved to Review in an earlier test.
    const res = await page.request.patch("/api/tasks/T-1042", { data: { status: "done", quality: "excellent" } });
    expect(res.status()).toBe(409);
    await page.goto("/tasks/T-1042");
    await expect(page.getByText("Waiting for review")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });

  test("manager approves once with a quality rating; the decision can't be flipped", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/tasks/T-1042");
    await expect(page.getByRole("button", { name: "Return for changes" })).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await page.getByRole("menuitem", { name: /Excellent/ }).click();
    await expect(page.locator(".issue", { hasText: "Approved ·" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Return for changes" })).toHaveCount(0);
    await expect(page.getByTestId("activity")).toContainText("approve · quality: Excellent");

    // Returning or re-approving an approved task is rejected by the API.
    expect((await page.request.patch("/api/tasks/T-1042", { data: { status: "returned" } })).status()).toBe(409);
    expect((await page.request.patch("/api/tasks/T-1042", { data: { status: "done", quality: "good" } })).status()).toBe(400);
    const t = await (await page.request.get("/api/tasks/T-1042")).json();
    expect(t.task.quality).toBe("excellent");

    // Inline status menu offers only Reopen.
    await page.goto("/tasks/team");
    await page.locator("tr", { hasText: "T-1042" }).locator('[data-edit="status"]').click();
    await expect(page.getByRole("menuitem")).toHaveText([/Reopen/]);
  });

  test("manager returns a task; assignee resumes it", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/tasks/T-1040");
    await page.getByRole("button", { name: "Return for changes" }).click();
    await expect(page.locator(".detail-side .status").first()).toHaveText("Returned");
    await signIn(page, "analyst");
    await page.goto("/tasks/T-1040");
    await page.getByRole("button", { name: "Resume work" }).click();
    await expect(page.locator(".detail-side .status").first()).toHaveText("In Progress");
  });

  test("approved work shows up in performance numbers", async ({ page }) => {
    await signIn(page);
    await page.goto("/performance/employees");
    await expect(page.locator("tbody")).toContainText("Tune Splunk correlation rule");
  });
});

test.describe("task details are saved", () => {
  test("checklist, comments and attachments persist", async ({ page }) => {
    await signIn(page);
    await page.goto("/tasks/T-1030");
    await page.getByLabel("New checklist item").fill("Export access logs");
    await page.getByLabel("New checklist item").press("Enter");
    await expect(page.getByText("Export access logs")).toBeVisible();
    await page.locator("label.check-item", { hasText: "Export access logs" }).locator("input").check();

    await page.getByLabel("New comment").fill("Started on this, @Leila Nouri FYI");
    await page.getByRole("button", { name: /^Comment/ }).click();
    await expect(page.locator(".mention", { hasText: "@Leila Nouri" })).toBeVisible();

    await page.getByTestId("attach-input").setInputFiles({ name: "access-logs.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByRole("link", { name: /access-logs\.txt/ })).toBeVisible();

    await page.reload();
    await expect(page.locator("label.check-item", { hasText: "Export access logs" }).locator("input")).toBeChecked();
    await expect(page.getByText("Started on this")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /access-logs\.txt/ }).click()]);
    expect(download.suggestedFilename()).toBe("access-logs.txt");
  });
});

test.describe("shift logs are for SOC analysts only", () => {
  test("managers get the team view, not their own log", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/shift");
    await expect(page).toHaveURL(/\/shift\/team$/);
    await expect(page.locator("tbody")).toContainText("Sara Rahimi");
    expect((await page.request.patch("/api/shift", { data: { n: 1, patch: { done: true } } })).status()).toBe(403);
    await page.locator("tr", { hasText: "Sara Rahimi" }).click();
    await expect(page.getByText("read-only")).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete Shift" })).toHaveCount(0);
  });

  test("security manager has no Shift Log of their own", async ({ page }) => {
    await signIn(page, "security");
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Continue Shift Log" })).toHaveCount(0);
    expect((await page.request.post("/api/shift/tickets", { data: { no: "X-1" } })).status()).toBe(403);
  });
});

test.describe("reports", () => {
  for (const report of ["employee", "team", "task", "shift", "tickets"]) {
    test(`${report} report exports a real Excel file`, async ({ page }) => {
      await signIn(page, "security");
      const res = await page.request.get(`/api/reports/${report}?period=this&user=sr&format=xlsx`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("spreadsheetml");
      const body = await res.body();
      expect(body.subarray(0, 2).toString()).toBe("PK"); // xlsx is a zip
    });
  }

  test("employee monthly report preview uses live data", async ({ page }) => {
    await signIn(page, "soc");
    await page.goto("/reports/employee");
    await page.getByLabel("Employee").selectOption("sr");
    await expect(page.getByRole("heading", { name: "Routine Activity" })).toBeVisible();
    await expect(page.locator("section", { hasText: "Tasks" }).first()).toContainText("Tune Splunk correlation rule");
  });

  test("analysts can't open the team report", async ({ page }) => {
    await signIn(page);
    expect((await page.request.get("/api/reports/team")).status()).toBe(403);
  });
});

test.describe("accounts", () => {
  test("change password, then sign in with the new one", async ({ page, browser }) => {
    await signIn(page, "security");
    await page.goto("/account");
    await page.getByLabel("Current password").fill("wrong");
    await page.getByLabel("New password", { exact: true }).fill("NewPass2026!");
    await page.getByLabel("Confirm new password").fill("NewPass2026!");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.locator("form [role=alert]")).toHaveText("Current password is incorrect.");
    await page.getByLabel("Current password").fill(PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();

    const ctx = await browser.newContext();
    const url = (p) => new URL(p, page.url()).href;
    expect((await ctx.request.post(url("/api/auth/login"), { data: { email: USERS.security, password: PASSWORD } })).status()).toBe(401);
    expect((await ctx.request.post(url("/api/auth/login"), { data: { email: USERS.security, password: "NewPass2026!" } })).ok()).toBeTruthy();
    await ctx.close();
  });

  test("SOC Manager edits an analyst's team and resets their password", async ({ page, browser }) => {
    await signIn(page, "soc");
    await page.goto("/team");
    await page.getByRole("button", { name: "Edit Neda Karimi" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit member" });
    await expect(dialog.getByLabel("Role").locator("option")).toHaveText(["Analyst"]);
    await dialog.getByLabel("Primary team").selectOption("SOC · L2");
    await dialog.getByLabel("Reset password (optional)").fill("Reset2026!!");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("tr", { hasText: "Neda Karimi" })).toContainText("SOC · L2");
    // SOC Managers can't promote anyone.
    expect((await page.request.patch("/api/members/nk", { data: { role: "soc_manager" } })).status()).toBe(403);
    const ctx = await browser.newContext();
    expect((await ctx.request.post(new URL("/api/auth/login", page.url()).href, { data: { email: "neda@corp.local", password: "Reset2026!!" } })).ok()).toBeTruthy();
    await ctx.close();
  });
});
