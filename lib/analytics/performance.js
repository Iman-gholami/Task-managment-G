import { isNum } from "./format.js";
import { groupFa, ROLE_FA } from "./labels.js";
import { peopleRows } from "./metrics.js";

/**
 * Activity index weights. The score is deliberately about visible output, not quality:
 * - task volume is led by weighted units, with raw completed tasks kept visible;
 * - SOC shift cohorts also include completed routine activities and shift-log closure.
 * Every metric is normalized to the best person inside the same cohort, then weights are re-scaled
 * over metrics that actually exist in that cohort. The result is 0..100 and must never be compared
 * across different cohorts.
 */
export const ACTIVITY_WEIGHTS = {
  standard: { units: 0.7, completed: 0.3 },
  shift: { units: 0.5, completed: 0.25, actsDone: 0.15, closureRate: 0.1 },
};

export function cohortFor(person) {
  if (!person || person.manager || !person.group) return null;
  const discriminator = person.level ?? person.role ?? "member";
  return {
    key: `${person.group}|${discriminator}`,
    label: person.level
      ? `${groupFa(person.group)} · ${person.level}`
      : `${groupFa(person.group)} · ${ROLE_FA[person.role] ?? person.role ?? ""}`.replace(/ · $/, ""),
  };
}

export function performanceCohorts(facts, range) {
  const map = new Map();
  for (const row of peopleRows(facts, range, null)) {
    const cohort = cohortFor(row.person);
    if (!cohort) continue;
    if (!map.has(cohort.key)) map.set(cohort.key, { ...cohort, rows: [] });
    map.get(cohort.key).rows.push(row);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "fa"));
}

function ranksFor(rows, key) {
  const values = rows
    .map((row) => ({ id: row.person.id, value: row.cur[key] }))
    .filter((x) => isNum(x.value))
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));

  const out = new Map();
  let rank = 0;
  let prev = null;
  values.forEach((item, index) => {
    if (index === 0 || item.value !== prev) rank = index + 1;
    out.set(item.id, rank);
    prev = item.value;
  });
  return out;
}

export function buildActivityLeaderboard(rows) {
  const shift = rows.some((row) => row.person.shift);
  const weights = shift ? ACTIVITY_WEIGHTS.shift : ACTIVITY_WEIGHTS.standard;
  const max = Object.fromEntries(
    Object.keys(weights).map((key) => [
      key,
      Math.max(0, ...rows.map((row) => (isNum(row.cur[key]) ? row.cur[key] : 0))),
    ]),
  );
  const active = Object.entries(weights).filter(([key]) => max[key] > 0);
  const totalWeight = active.reduce((sum, [, weight]) => sum + weight, 0);
  const metricRanks = Object.fromEntries(Object.keys(weights).map((key) => [key, ranksFor(rows, key)]));

  const scored = rows.map((row) => {
    const score = totalWeight
      ? (active.reduce((sum, [key, weight]) => {
        const value = isNum(row.cur[key]) ? row.cur[key] : 0;
        return sum + weight * (value / max[key]);
      }, 0) / totalWeight) * 100
      : 0;
    return {
      ...row,
      score: Math.round(score * 10) / 10,
      ranks: Object.fromEntries(Object.keys(weights).map((key) => [key, metricRanks[key].get(row.person.id) ?? null])),
    };
  }).sort((a, b) => b.score - a.score || b.cur.units - a.cur.units || a.person.name.localeCompare(b.person.name, "fa"));

  let previousScore = null;
  let previousRank = 0;
  return scored.map((row, index) => {
    const rank = index === 0 || row.score !== previousScore ? index + 1 : previousRank;
    previousScore = row.score;
    previousRank = rank;
    return { ...row, rank };
  });
}

export function activityLeaderboard(facts, range, cohortKey) {
  const cohorts = performanceCohorts(facts, range);
  const cohort = cohorts.find((x) => x.key === cohortKey) ?? cohorts[0] ?? null;
  if (!cohort) return { cohorts, cohort: null, shift: false, rows: [] };
  const rows = buildActivityLeaderboard(cohort.rows);
  return { cohorts, cohort, shift: rows.some((row) => row.person.shift), rows };
}
