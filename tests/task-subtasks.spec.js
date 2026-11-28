const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PASSWORD = "Subtask-Test-2026!";
const login = async (request, credentials) => expect((await request.post("/api/auth/login", { data: credentials })).ok()).toBeTruthy();

test("subtasks use normal task reports and promotion retains their ID, work and audit link", async ({ request }) => {
  await login(request, ADMIN);
  const personResponse = await request.post("/api/members", { data: {
    name: "Subtask Engineer", role: "engineer", team: "Design & Automation",
    email: "subtask-engineer@example.invalid", password: PASSWORD,
  } });
  expect(personResponse.status()).toBe(201);
  const engineer = (await personResponse.json()).user;
  const parentResponse = await request.post("/api/tasks", { data: {
    title: "SOC monitoring rollout", description: "Main deployment plan", a: engineer.id,
  } });
  expect(parentResponse.status()).toBe(201);
  const parent = (await parentResponse.json()).task;
  const endpoint = `/api/tasks/${parent.id}/subtasks`;
  const created = await request.post(endpoint, { data: {
    title: "Configure alert rules", description: "Tune severity thresholds", a: engineer.id,
    prio: "high", cx: 3, due: "2026-12-20",
  } });
  expect(created.status()).toBe(201);
  const child = (await created.json()).task;
  expect(child.parentTaskId).toBe(parent.id);
  expect(child.originParentTaskId).toBe(parent.id);
  expect(child.prio).toBe("high");
  expect(child.due).toBe("2026-12-20");
  expect((await (await request.get(endpoint)).json()).subtasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: child.id, relation: "active" })]));

  await login(request, { email: engineer.email, password: PASSWORD });
  expect((await request.get(`/api/tasks/${child.id}`)).status()).toBe(200);
  expect((await request.post(endpoint, { data: { title: "Forbidden", a: engineer.id } })).status()).toBe(403);
  const started = await request.patch(`/api/tasks/${child.id}`, { data: { status: "progress" } });
  expect(started.status()).toBe(200);
  const report = await request.patch(`/api/tasks/${child.id}`, { data: {
    report: { revision: 0, workPerformed: "Configured alert thresholds", outcome: "Ready for validation", links: ["https://example.com/evidence"] },
    hours: 1.5,
  } });
  expect(report.status()).toBe(200);

  await login(request, ADMIN);
  const promoted = await request.post(`${endpoint}/${child.id}/promote`);
  expect(promoted.status()).toBe(200);
  const independent = (await promoted.json()).task;
  expect(independent.id).toBe(child.id);
  expect(independent.parentTaskId).toBeNull();
  expect(independent.originParentTaskId).toBe(parent.id);
  expect(independent.hours).toBe(1.5);
  const existing = await request.get(`/api/tasks/${child.id}`);
  expect((await existing.json()).details.report).toMatchObject({ workPerformed: "Configured alert thresholds", outcome: "Ready for validation", links: ["https://example.com/evidence"] });
  expect((await (await request.get(endpoint)).json()).subtasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: child.id, relation: "promoted" })]));
  expect((await request.post(`${endpoint}/${child.id}/promote`)).status()).toBe(409);
});

test("subtask access is scoped and nested subtasks are rejected", async ({ request }) => {
  await login(request, ADMIN);
  const add = async (suffix, team, role) => {
    const res = await request.post("/api/members", { data: {
      name: `Subtask ${suffix}`, role, team, email: `subtask-${suffix}@example.invalid`, password: PASSWORD,
    } });
    expect(res.status()).toBe(201);
    return (await res.json()).user;
  };
  const owner = await add("owner", "Design & Automation", "engineer");
  const worker = await add("worker", "Design & Automation", "engineer");
  const outsider = await add("outsider", "SOC · L1", "analyst");
  const main = await request.post("/api/tasks", { data: { title: "Parent access example", a: owner.id } });
  const parent = (await main.json()).task;
  const url = `/api/tasks/${parent.id}/subtasks`;
  const res = await request.post(url, { data: { title: "Independent work package", a: worker.id } });
  expect(res.status()).toBe(201);
  const child = (await res.json()).task;
  expect((await request.post(`/api/tasks/${child.id}/subtasks`, { data: { title: "Nested", a: worker.id } })).status()).toBe(409);

  await login(request, { email: outsider.email, password: PASSWORD });
  expect((await request.get(url)).status()).toBe(404);
  expect((await request.get(`/api/tasks/${child.id}`)).status()).toBe(404);
  expect((await request.post(`${url}/${child.id}/promote`)).status()).toBe(404);

  await login(request, { email: worker.email, password: PASSWORD });
  expect((await request.get(`/api/tasks/${child.id}`)).status()).toBe(200);
  expect((await request.get(url)).status()).toBe(404);
  expect((await request.post(`${url}/${child.id}/promote`)).status()).toBe(404);
});

test("manager sees a connected work breakdown and opens an accessible creation dialog", async ({ page }) => {
  await login(page.request, ADMIN);
  const person = await page.request.post("/api/members", { data: {
    name: "Subtask UI Owner", role: "engineer", team: "Design & Automation",
    email: "subtask-ui-owner@example.invalid", password: PASSWORD,
  } });
  expect(person.status()).toBe(201);
  const owner = (await person.json()).user;
  const created = await page.request.post("/api/tasks", { data: { title: "Parent UI example", a: owner.id } });
  expect(created.status()).toBe(201);
  const parent = (await created.json()).task;
  const childResponse = await page.request.post(`/api/tasks/${parent.id}/subtasks`, { data: { title: "Independent work package", a: owner.id } });
  expect(childResponse.status()).toBe(201);
  await page.goto(`/tasks/${parent.id}`);
  const panel = page.getByTestId("task-subtasks");
  await expect(panel.getByRole("link", { name: /Independent work package/ })).toBeVisible();
  await panel.getByRole("button", { name: /Add subtask|افزودن زیرتسک/ }).click();
  await expect(page.getByRole("dialog", { name: /Create subtask|ایجاد زیرتسک/ })).toBeVisible();
  await page.getByRole("dialog").getByLabel(/Subtask title|عنوان زیرتسک/).fill("Validate on staging");
  await page.getByRole("dialog").getByRole("button", { name: /Create subtask|ایجاد زیرتسک/ }).click();
  await expect(panel.getByRole("link", { name: /Validate on staging/ })).toBeVisible();
});
