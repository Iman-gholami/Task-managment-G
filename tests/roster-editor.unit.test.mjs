import test from "node:test";
import assert from "node:assert/strict";
import { availableRosterCandidates, bulkRosterSelection, draftAssignment, rosterCandidates } from "../lib/roster-editor.js";

const people = [
  { id: "leave", name: "Ali Leave", team: "SOC · L1" },
  { id: "night", name: "Bahram Night", team: "SOC · L1" },
  { id: "off", name: "Cyrus Off", team: "SOC · L1" },
  { id: "free", name: "Darya Free", team: "SOC · L1" },
  { id: "evening", name: "Ehsan Evening", team: "SOC · L1" },
  { id: "morning", name: "Farhad Morning", team: "SOC · L1" },
];
const draft = { morning: ["morning"], evening: ["evening"], night: ["night"], off: ["off"], leave: ["leave"] };

test("morning roster orders selected/free, then other work, night, off, and leave", () => {
  const results = rosterCandidates(people, draft, "morning");
  assert.deepEqual(results.map((p) => p.id), ["morning", "free", "evening", "night", "off", "leave"]);
  assert.deepEqual(rosterCandidates(people, draft, "morning", "night").map((p) => p.id), ["night"]);
  assert.equal(draftAssignment(draft, "free"), null);
});

test("select all only adds visible unassigned people without overwriting other shifts", () => {
  const free = availableRosterCandidates(people, draft, "morning");
  assert.deepEqual(free.map((p) => p.id), ["free", "morning"]);
  const selected = bulkRosterSelection(draft, "morning", free, true);
  assert.deepEqual(selected.morning, ["morning", "free"]);
  assert.deepEqual(selected.night, ["night"]);
  assert.deepEqual(selected.off, ["off"]);
  assert.deepEqual(selected.leave, ["leave"]);
  const cleared = bulkRosterSelection(selected, "morning", [{ id: "free" }], false);
  assert.deepEqual(cleared.morning, ["morning"]);
  assert.deepEqual(cleared.night, ["night"]);
});
