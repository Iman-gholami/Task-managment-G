import test from "node:test";
import assert from "node:assert/strict";
import {
  CHECKLIST_GROUPS,
  CHECKLIST_LIMITS,
  STANDARD_CHECKLIST,
  activitiesForShift,
  changeSummary,
  describeChanges,
  legacyActivityNumber,
  normalizeChecklist,
} from "../lib/checklists.js";
import { EXTENDED_SHIFT_TASK_TITLES } from "../lib/shifts.js";

const withIds = (items) => items.map((it, i) => ({ ...it, id: i + 1 }));

test("the standard checklist is the original built-in routine, item for item", () => {
  assert.equal(STANDARD_CHECKLIST.items.length, 8);
  assert.deepEqual(STANDARD_CHECKLIST.items.map((it) => it.legacyN), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(STANDARD_CHECKLIST.items.map((it) => it.kind), ["basic", "files", "monitor", "report", "monitor", "monitor", "basic", "misp"]);
  for (const it of STANDARD_CHECKLIST.items) {
    const extendedOnly = EXTENDED_SHIFT_TASK_TITLES.includes(it.title);
    assert.deepEqual(it.shiftTypes, extendedOnly ? ["evening"] : ["morning", "evening", "night"], it.title);
  }
  assert.deepEqual(CHECKLIST_GROUPS, ["SOC · L1", "SOC · L2", "SOC · L3"]);
});

test("a shift log copies only the active items that apply to its shift type", () => {
  const items = withIds(STANDARD_CHECKLIST.items);
  const evening = activitiesForShift(items, "evening");
  assert.deepEqual(evening.map((a) => a.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(evening.map((a) => a.legacyN), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(evening.find((a) => a.kind === "misp"), {
    n: 8, itemId: 8, legacyN: 8, title: "Add IOCs to MISP and Share Them via Bale", kind: "misp", done: false, iocs: 0, bale: false, mispRef: "",
  });

  const morning = activitiesForShift(items, "morning");
  assert.deepEqual(morning.map((a) => a.legacyN), [1, 3, 5, 6, 7]);
  assert.deepEqual(morning.map((a) => a.n), [1, 2, 3, 4, 5], "numbers are positions in this log");
  assert.ok(morning.every((a) => a.done === false));

  const custom = activitiesForShift([
    { id: 40, title: "Review escalated incidents", hint: "Start with P1", kind: "basic", shiftTypes: ["night"], active: true },
    { id: 41, title: "Retired step", hint: "", kind: "basic", shiftTypes: ["night"], active: false },
  ], "night");
  assert.deepEqual(custom, [{ n: 1, itemId: 40, title: "Review escalated incidents", kind: "basic", hint: "Start with P1", done: false }]);
});

test("normalizeChecklist trims, fills defaults and keeps the given order", () => {
  const { value, errors } = normalizeChecklist({
    name: "  Layer 2   technical routine ",
    description: " For L2 ",
    items: [
      { title: "  Investigate   unresolved alerts " },
      { id: "7", title: "Verify ongoing investigations", kind: "monitor", shiftTypes: ["night", "morning", "bogus"], active: false, hint: " Ask L3 if blocked " },
    ],
  });
  assert.equal(errors, null);
  assert.equal(value.name, "Layer 2 technical routine");
  assert.equal(value.description, "For L2");
  assert.deepEqual(value.items, [
    { id: null, title: "Investigate unresolved alerts", hint: "", kind: "basic", shiftTypes: ["morning", "evening", "night"], active: true },
    { id: 7, title: "Verify ongoing investigations", hint: "Ask L3 if blocked", kind: "monitor", shiftTypes: ["morning", "night"], active: false },
  ]);
});

test("normalizeChecklist rejects incomplete or ambiguous definitions with field-level errors", () => {
  const r = normalizeChecklist({
    name: "",
    items: [
      { title: "" },
      { title: "Review rules", shiftTypes: [] },
      { title: "review RULES" },
      { id: 3, title: "A", kind: "unknown" },
      { id: 3, title: "B" },
      { id: -1, title: "C" },
    ],
  });
  assert.equal(r.errors.name, "Give the checklist a name.");
  assert.match(r.errors.items[0].title, /Describe what the analyst should do/);
  assert.match(r.errors.items[1].shiftTypes, /at least one shift/);
  assert.match(r.errors.items[2].title, /already has this title/);
  assert.match(r.errors.items[3].kind, /item type/);
  assert.match(r.errors.items[4].form, /appears twice/);
  assert.match(r.errors.items[5].form, /not valid/);
  assert.equal(r.message, "Give the checklist a name.");

  const many = normalizeChecklist({ name: "Big", items: Array.from({ length: CHECKLIST_LIMITS.items + 1 }, (_, i) => ({ title: `Step ${i}` })) });
  assert.match(many.message, /at most 40 items/);
  assert.match(normalizeChecklist({ name: "x".repeat(CHECKLIST_LIMITS.name + 1) }).message, /under 80 characters/);
  assert.match(normalizeChecklist({ name: "Ok", items: "nope" }).message, /must be a list/);
  assert.equal(normalizeChecklist({ name: "Empty is allowed" }).errors, null);
});

test("describeChanges reports additions, removals, edits, reordering and renames", () => {
  const before = { name: "L2", description: "", items: withIds([
    { title: "A", hint: "", kind: "basic", shiftTypes: ["morning", "evening", "night"], active: true },
    { title: "B", hint: "", kind: "basic", shiftTypes: ["morning", "evening", "night"], active: true },
    { title: "C", hint: "", kind: "basic", shiftTypes: ["morning", "evening", "night"], active: true },
  ]) };
  const same = normalizeChecklist(before).value;
  assert.equal(describeChanges(before, same).any, false);
  assert.equal(changeSummary(describeChanges(before, same)), "no changes");

  const after = normalizeChecklist({
    name: "L2 routine",
    items: [
      { ...before.items[2] },
      { ...before.items[0], active: false },
      { title: "D" },
    ],
  }).value;
  const c = describeChanges(before, after);
  assert.deepEqual(c, { added: 1, removed: 1, edited: 1, reordered: true, details: true, any: true });
  assert.equal(changeSummary(c), "1 added · 1 removed · 1 edited · reordered · name or description changed");
});

test("per-activity statistics keep the historical numbering and ignore custom items", () => {
  // Logs written before checklists were configurable: no itemId, n is the historical number.
  assert.equal(legacyActivityNumber({ n: 6, title: "Monitor Security Center Website" }), 6);
  assert.equal(legacyActivityNumber({ n: 9 }), null);
  // Configured standard items carry their number even when the log numbers them differently (morning shift).
  assert.equal(legacyActivityNumber({ n: 2, itemId: 3, legacyN: 3 }), 3);
  // Items added through the editor are not one of the eight standard activities.
  assert.equal(legacyActivityNumber({ n: 1, itemId: 40 }), null);
});
