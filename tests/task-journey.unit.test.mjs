import test from "node:test";
import assert from "node:assert/strict";
import { eligibleReviewers, taskJourney } from "../lib/task-journey.js";

const people = [
  { id: "security", role: "security_manager", active: true },
  { id: "soc", role: "soc_manager", active: true },
  { id: "soc2", role: "soc_manager", active: true },
  { id: "analyst", role: "analyst", team: "SOC · L1", active: true },
  { id: "inactive", role: "security_manager", active: false },
];

test("a SOC manager's own review can only go to an active security manager", () => {
  assert.deepEqual(eligibleReviewers({ a: "soc" }, people).map((user) => user.id), ["security"]);
  assert.deepEqual(eligibleReviewers({ a: "analyst" }, people).map((user) => user.id), ["security", "soc", "soc2"]);
  assert.ok(!eligibleReviewers({ a: "security" }, people).some((user) => user.id === "security"));
});

test("returned work goes back to work, and review-exempt tasks omit review", () => {
  assert.deepEqual(taskJourney({ status: "returned", reviewRequired: true }), { steps: ["assigned", "working", "review", "done"], current: 1 });
  assert.deepEqual(taskJourney({ status: "done", reviewRequired: false }), { steps: ["assigned", "working", "done"], current: 2 });
  assert.equal(taskJourney({ status: "cancelled", reviewRequired: true }).current, null);
});
