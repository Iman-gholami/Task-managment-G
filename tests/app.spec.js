// @ts-check
const { test, expect } = require("@playwright/test");

const ROUTES = [
  ["/dashboard", "Good morning, Sara"],
  ["/tasks/my", "My Tasks"],
  ["/tasks/team", "Team Tasks"],
  ["/tasks/all", "All Tasks"],
  ["/tasks/T-1042", "Tune Splunk correlation rule"],
  ["/shift", "Shift Log — Sep 28, 2026"],
  ["/shift/history", "Shift Log History"],
  ["/team", "Team"],
  ["/performance/overview", "Performance Overview"],
  ["/performance/employees", "Sara Rahimi"],
  ["/reports/employee", "Employee Monthly Report"],
  ["/reports/shift", "SOC Shift Activity Report"],
  ["/reports/tickets", "Ticket Report"],
  ["/admin", "Users & Roles"],
  ["/states", "Empty, loading & error states"],
  ["/login", "Sign in"],
];

test.describe("every screen renders without errors", () => {
  for (const [path, heading] of ROUTES) {
    test(path, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.goto(path);
      await expect(page.locator("h1").first()).toContainText(heading);
      expect(errors).toEqual([]);
    });
  }
});

test("root redirects to the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
});

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

test("role switch shows the SOC Manager and Security Manager dashboards", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Switch role (demo)" }).click();
  await expect(page.locator("h1")).toHaveText("SOC overview");
  await page.getByRole("button", { name: "Switch role (demo)" }).click();
  await expect(page.locator("h1")).toHaveText("Security Department");
});

test("create task with the C shortcut; title is required", async ({ page }) => {
  await page.goto("/tasks/my");
  await page.locator("body").press("c");
  const dialog = page.getByRole("dialog", { name: "Create task" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Create Task/ }).click();
  await expect(dialog.getByText("Add a title to create the task.")).toBeVisible();
  await dialog.getByPlaceholder("Task title").fill("Rotate Grafana service account keys");
  await dialog.getByRole("button", { name: /Create Task/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("T-1043 created and assigned to Sara Rahimi")).toBeVisible();
  await expect(page.locator("tbody")).toContainText("Rotate Grafana service account keys");
});

test("status can be changed inline from the task table", async ({ page }) => {
  await page.goto("/tasks/my");
  const row = page.locator("tr", { hasText: "T-1042" });
  await row.locator('[data-edit="status"]').click();
  await page.getByRole("menuitem", { name: /Review/ }).click();
  await expect(row.locator('[data-edit="status"]')).toHaveText("Review");
  await expect(page).toHaveURL(/\/tasks\/my$/); // editing must not open the task
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
  await page.getByRole("button", { name: "Status", exact: true }).click();
  await page.getByRole("menuitem", { name: /Done/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(13);
});

test("shift log: IOC count, tickets and completing the shift", async ({ page }) => {
  await page.goto("/shift");

  // IOC count stepper and typing
  const ioc = page.getByLabel("IOC count", { exact: true });
  await page.getByRole("button", { name: "Increase IOC count" }).click();
  await expect(ioc).toHaveValue("7");
  await ioc.fill("12");
  await expect(page.locator(".summary")).toContainText("12IOCs added");

  // Ticket number is required; count is derived from records
  await page.getByRole("button", { name: "Add Ticket" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Ticket number is required.")).toBeVisible();
  await page.getByLabel("Ticket number").fill("INC-2026-4480");
  await page.getByLabel("Description").fill("Defacement attempt blocked by WAF");
  await page.getByLabel("Description").press("Enter");
  await expect(page.getByText("Tickets Created: 3")).toBeVisible();

  // Completing with a missing activity keeps the shift open
  await page.getByRole("button", { name: "Complete Shift" }).click();
  await expect(page.getByText("In progress", { exact: true })).toBeVisible();
  await expect(page.locator(".remain")).toContainText("Monitor Security Center Website");

  // Finish the last activity, then complete
  await page.locator("#act-6").getByRole("button", { name: /Completed — No Issue/ }).click();
  await page.getByRole("button", { name: "Complete Shift" }).click();
  await expect(page.getByText("Completed 14:52")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
});

test("shift log: report an issue on a monitoring activity", async ({ page }) => {
  await page.goto("/shift");
  const act = page.locator("#act-6");
  await act.getByRole("button", { name: "Report an issue" }).click();
  await act.getByLabel("Issue summary").fill("Security Center login page returned 502");
  await act.getByRole("button", { name: "Save issue" }).click();
  await expect(act).toContainText("Issue reported: Security Center login page returned 502");
  await expect(page.locator(".summary")).toContainText("2Issues reported");
});

test("ticket report search filters rows", async ({ page }) => {
  await page.goto("/reports/tickets");
  await expect(page.locator("tbody tr")).toHaveCount(7);
  await page.getByPlaceholder("Search ticket number or description").fill("PowerShell");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("INC-2026-4462");
});

test("command menu opens with Ctrl+K and navigates", async ({ page }) => {
  await page.goto("/dashboard");
  await page.keyboard.press("Control+k");
  await page.getByRole("menuitem", { name: "Ticket Report" }).click();
  await expect(page).toHaveURL(/\/reports\/tickets$/);
});
