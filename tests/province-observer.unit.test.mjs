import test from "node:test";
import assert from "node:assert/strict";
import { IRAN_PROVINCES, ROLE_LABELS, assignableFor, canManageMember, canViewManagementAnalytics, isShiftEligible, canAssignTask } from "../lib/roles.js";
import { parseFilters, filterQuery, applyFilters } from "../lib/analytics/filters.js";

test("Iran has 31 canonical, distinct province values including Qom", () => {
  assert.equal(IRAN_PROVINCES.length, 31);
  assert.equal(new Set(IRAN_PROVINCES).size, 31);
  assert.ok(IRAN_PROVINCES.includes("قم"));
  assert.equal(parseFilters({ province: "قم" }).province, "قم");
  assert.equal(parseFilters({ province: "not-a-province" }).province, "");
  assert.match(filterQuery({ ...parseFilters({}), province: "قم" }), /province=/);
});

test("province filter scopes people, tasks, shifts, tickets and monthly evaluations", () => {
  const facts = {
    people: [
      { id: "q", name: "Qom Analyst", group: "SOC", level: "L1", province: "قم", role: "analyst" },
      { id: "t", name: "Tehran Analyst", group: "SOC", level: "L2", province: "تهران", role: "analyst" },
      { id: "old", name: "Unassigned Analyst", group: "SOC", level: "L2", province: null, role: "analyst" },
    ],
    tasks: [
      { id: "T-1", a: "q" }, { id: "T-2", a: "t" }, { id: "T-3", a: "old" },
    ],
    shifts: [{ a: "q", date: "2026-10-27" }, { a: "t", date: "2026-10-27" }],
    tickets: [{ a: "q", date: "2026-10-27", n: 2 }, { a: "t", date: "2026-10-27", n: 4 }],
    reviews: [{ a: "q", month: "1405-07" }, { a: "t", month: "1405-07" }],
  };
  const filtered = applyFilters(facts, parseFilters({ province: "قم" }));
  assert.deepEqual(filtered.people.map((x) => x.id), ["q"]);
  assert.deepEqual(filtered.tasks.map((x) => x.id), ["T-1"]);
  assert.deepEqual(filtered.shifts.map((x) => x.a), ["q"]);
  assert.deepEqual(filtered.tickets.map((x) => x.a), ["q"]);
  assert.deepEqual(filtered.reviews.map((x) => x.a), ["q"]);
  assert.equal(applyFilters(facts, parseFilters({})).people.length, 3);
});

test("observer is full-statistics read-only, never a manager or shift worker", () => {
  const observer = { id: "o", role: "observer", team: "Security Department", active: true };
  const security = { id: "m", role: "security_manager", team: "Security Department" };
  assert.equal(ROLE_LABELS.observer, "ناظر");
  assert.ok(canViewManagementAnalytics(observer));
  assert.equal(isShiftEligible(observer), false);
  assert.deepEqual(assignableFor(observer), { roles: [], teams: [] });
  assert.ok(assignableFor(security).roles.includes("observer"));
  assert.ok(canManageMember(security, observer));
  assert.equal(canManageMember(observer, { role: "analyst", id: "a", team: "SOC · L1" }), false);
  assert.equal(canAssignTask(observer, observer), false);
});
