const { test, expect } = require("@playwright/test");

const ADMIN = { email: "test-admin@local.invalid", password: "E2E-Only-Admin-2026!" };
const PASSWORD = "Shared-Task-2026!";
const login = async (request, credentials) => expect((await request.post("/api/auth/login", { data: credentials })).ok()).toBeTruthy();

test("a Design manager reviews both collaborative contributions while members see each other", async ({ request }) => {
  await login(request, ADMIN);
  const add = async (name, role, team, suffix) => {
    const response = await request.post("/api/members", { data: { name, role, team, password: PASSWORD, email: `shared-${suffix}@example.invalid` } });
    expect(response.status()).toBe(201);
    return (await response.json()).user;
  };
  const lead = await add("Collab Lead", "engineer", "Design & Automation", "lead");
  const peer = await add("Collab Peer", "engineer", "Design & Automation", "peer");
  const reviewer = await add("Collab Manager", "automation_manager", "Design & Automation", "manager");
  const outsider = await add("Collab SOC Manager", "soc_manager", "SOC", "soc");
  const taskResponse = await request.post("/api/tasks", { data: {
    title: "Collaborative rollout", a: lead.id,
    collaboration: { mode: "split", leadResponsibility: "Build rollout", members: [{ userId: peer.id, responsibility: "Test and document" }] },
  } });
  expect(taskResponse.status()).toBe(201);
  const task = (await taskResponse.json()).task;
  await login(request, { email: outsider.email, password: PASSWORD });
  expect((await request.get(`/api/tasks/${task.id}`)).status()).toBe(404);
  await login(request, { email: lead.email, password: PASSWORD });
  expect((await request.patch(`/api/tasks/${task.id}`, { data: { status: "progress" } })).status()).toBe(200);
  await login(request, { email: peer.email, password: PASSWORD });
  expect((await request.get(`/api/tasks/${task.id}`)).status()).toBe(200);
  const endpoint = `/api/tasks/${task.id}/collaboration`;
  const report = { action: "submit", revision: 0, workPerformed: "Verified design", outcome: "Passed", hours: 2, links: ["https://example.org/test-results"] };
  const peerResponse = await request.patch(endpoint, { data: report });
  expect(peerResponse.status()).toBe(200);
  expect((await peerResponse.json()).details.collaboration.members.find((m) => m.userId === peer.id).links).toEqual(["https://example.org/test-results"]);
  await login(request, { email: lead.email, password: PASSWORD });
  const shared = await request.get(`/api/tasks/${task.id}`);
  expect((await shared.json()).details.collaboration.members.find((m) => m.userId === peer.id).links).toEqual(["https://example.org/test-results"]);
  expect((await request.patch(endpoint, { data: { ...report, workPerformed: "Lead completed rollout", hours: 3 } })).status()).toBe(200);
  await login(request, { email: reviewer.email, password: PASSWORD });
  const review = await request.get(`/api/tasks/${task.id}`);
  expect(review.status()).toBe(200);
  expect((await review.json()).task.status).toBe("review");
  expect((await request.patch(endpoint, { data: { action: "approve", userId: peer.id } })).status()).toBe(200);
  expect((await request.patch(endpoint, { data: { action: "approve", userId: lead.id } })).status()).toBe(200);
  const approved = await request.patch(`/api/tasks/${task.id}`, { data: { status: "done", quality: "good" } });
  expect(approved.status()).toBe(200);
  expect((await approved.json()).task.hours).toBe(5);
});
