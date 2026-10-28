const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PASSWORD = "Report-Workflow-2026!";

async function login(page, account) {
  expect((await page.request.post("/api/auth/login", { data: account })).ok()).toBeTruthy();
}
async function createWork(page, suffix, reviewRequired = true) {
  await login(page, ADMIN);
  const member = await page.request.post("/api/members", { data: {
    name: `Report analyst ${suffix}`, email: `report-${suffix}@example.invalid`, password: PASSWORD,
    role: "analyst", team: "SOC · L1",
  } });
  expect(member.status()).toBe(201);
  const analyst = (await member.json()).user;
  const created = await page.request.post("/api/tasks", { data: {
    title: `Report task ${suffix}`, a: analyst.id, reviewRequired,
  } });
  expect(created.status()).toBe(201);
  return { analyst, task: (await created.json()).task };
}

const patch = (page, id, data) => page.request.patch(`/api/tasks/${id}`, { data });
const details = async (page, id) => (await (await page.request.get(`/api/tasks/${id}`)).json()).details;

test("report, hours and mandatory return reason survive the full review cycle", async ({ page }) => {
  const { analyst, task } = await createWork(page, "review");
  await login(page, { email: analyst.email, password: PASSWORD });
  expect((await patch(page, task.id, { status: "progress" })).status()).toBe(200);
  expect((await patch(page, task.id, { status: "review" })).status()).toBe(400);
  expect((await patch(page, task.id, { report: { workPerformed: "Reviewed logs", outcome: "", revision: 0 } })).status()).toBe(200);
  expect((await details(page, task.id)).report).toMatchObject({ workPerformed: "Reviewed logs", outcome: "", hoursRecorded: false, revision: 1 });
  expect((await patch(page, task.id, { status: "review", hours: 2 })).status()).toBe(400);
  expect((await details(page, task.id)).report.hoursRecorded).toBe(false);

  const saved = await patch(page, task.id, { report: { workPerformed: "Reviewed logs", outcome: "Scheduled scan", revision: 1 }, hours: 2.5 });
  expect(saved.status()).toBe(200);
  expect((await saved.json()).details.report).toMatchObject({ outcome: "Scheduled scan", hoursRecorded: true, revision: 2 });
  expect((await patch(page, task.id, { report: { workPerformed: "stale", outcome: "stale", revision: 1 } })).status()).toBe(409);
  expect((await patch(page, task.id, { status: "review" })).status()).toBe(200);
  expect((await patch(page, task.id, { report: { workPerformed: "changed", outcome: "changed", revision: 2 } })).status()).toBe(409);
  expect((await patch(page, task.id, { hours: 4 })).status()).toBe(409);
  expect((await patch(page, task.id, { status: "done", quality: "good" })).status()).toBe(409);

  await login(page, ADMIN);
  expect((await patch(page, task.id, { report: { workPerformed: "manager edit", outcome: "x", revision: 2 } })).status()).toBe(403);
  expect((await patch(page, task.id, { status: "done", quality: "toString" })).status()).toBe(400);
  expect((await patch(page, task.id, { status: "returned" })).status()).toBe(400);
  expect((await patch(page, task.id, { status: "returned", returnReason: "  " })).status()).toBe(400);
  const returned = await patch(page, task.id, { status: "returned", returnReason: "Please include the source logs." });
  expect(returned.status()).toBe(200);
  const returnedBody = await returned.json();
  expect(returnedBody.task.status).toBe("returned");
  expect(returnedBody.details.reviewReturns[0].reason).toBe("Please include the source logs.");

  await login(page, { email: analyst.email, password: PASSWORD });
  expect((await details(page, task.id)).reviewReturns[0].reason).toBe("Please include the source logs.");
  expect((await patch(page, task.id, { status: "progress" })).status()).toBe(200);
  const revised = await patch(page, task.id, { report: { workPerformed: "Reviewed logs and added evidence", outcome: "Scheduled scan confirmed", revision: 2 }, hours: 3 });
  expect(revised.status()).toBe(200);
  expect((await patch(page, task.id, { status: "review" })).status()).toBe(200);
  await login(page, ADMIN);
  const approved = await patch(page, task.id, { status: "done", quality: "good", cx: 2 });
  expect(approved.status()).toBe(200);
  const final = await approved.json();
  expect(final.task).toMatchObject({ status: "done", hours: 3, quality: "good" });
  expect(final.details.report.outcome).toBe("Scheduled scan confirmed");
  expect(final.details.reviewReturns).toHaveLength(1);
});

test("review-exempt completion requires a report and an explicitly entered total", async ({ page }) => {
  const { analyst, task } = await createWork(page, "exempt", false);
  await login(page, { email: analyst.email, password: PASSWORD });
  expect((await patch(page, task.id, { status: "progress" })).status()).toBe(200);
  expect((await patch(page, task.id, { status: "done" })).status()).toBe(400);
  const incomplete = await patch(page, task.id, { report: { workPerformed: "Checked the ticket", outcome: "Resolved", revision: 0 } });
  expect(incomplete.status()).toBe(200);
  expect((await patch(page, task.id, { status: "done" })).status()).toBe(400);
  const finished = await patch(page, task.id, { status: "done", hours: 0 });
  expect(finished.status()).toBe(200);
  expect((await finished.json()).task).toMatchObject({ status: "done", reviewRequired: false, hours: 0, quality: null });
});

test("a manager's hours edit invalidates an older first report draft", async ({ page }) => {
  const { analyst, task } = await createWork(page, "hours-conflict");
  await login(page, { email: analyst.email, password: PASSWORD });
  expect((await patch(page, task.id, { status: "progress" })).status()).toBe(200);
  expect((await details(page, task.id)).report.revision).toBe(0);
  await login(page, ADMIN);
  expect((await patch(page, task.id, { hours: 2 })).status()).toBe(200);
  await login(page, { email: analyst.email, password: PASSWORD });
  const stale = await patch(page, task.id, { report: { workPerformed: "Checked", outcome: "Done", revision: 0 }, hours: 1 });
  expect(stale.status()).toBe(409);
  const current = await (await page.request.get(`/api/tasks/${task.id}`)).json();
  expect(current.task.hours).toBe(2);
  expect(current.details.report.revision).toBe(1);
});
