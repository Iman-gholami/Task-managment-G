import { ROSTER_KEYS } from "./shifts.js";

/** A person can have only one assignment per day. */
export function draftAssignment(draft, userId) {
  return ROSTER_KEYS.find((key) => (draft[key] ?? []).includes(userId)) ?? null;
}

/**
 * For each tab, show its assigned people first, then free people.
 * Other daytime shifts follow; night, off, and leave remain at the bottom,
 * in that order. This is only sorting: individual manual changes still work.
 */
export function rosterCandidates(people, draft, activeShift, query = "") {
  const needle = String(query).trim().toLocaleLowerCase();
  const rank = (userId) => {
    const status = draftAssignment(draft, userId);
    if (status === activeShift) return 0;
    if (status === null) return 1;
    if (status === "night") return 3;
    if (status === "off") return 4;
    if (status === "leave") return 5;
    return 2;
  };
  return people
    .filter((person) => !needle || (person.name + " " + person.team).toLocaleLowerCase().includes(needle))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "fa"));
}

/** Bulk selection must never steal people assigned to another shift or day status. */
export function availableRosterCandidates(visiblePeople, draft, activeShift) {
  return visiblePeople.filter((person) => {
    const status = draftAssignment(draft, person.id);
    return status === null || status === activeShift;
  });
}

/** Applies to the visible, eligible people only; preserves all other tabs. */
export function bulkRosterSelection(draft, activeShift, people, selected) {
  const ids = new Set(people.map((person) => person.id));
  const current = draft[activeShift] ?? [];
  return {
    ...draft,
    [activeShift]: selected
      ? [...new Set([...current, ...ids])]
      : current.filter((id) => !ids.has(id)),
  };
}
