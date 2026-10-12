import { SCORE } from "./config.js";
import { groupFa, ROLE_FA } from "./labels.js";
import { peopleRows } from "./metrics.js";

/** Task contribution to the manager-only weighted peer score. */
export function taskPoints(task) {
  const base = SCORE.cxPoints[task?.cx] ?? 0;
  const quality = task?.quality && SCORE.quality[task.quality] !== undefined ? SCORE.quality[task.quality] : SCORE.unrated;
  const beforeLate = base * quality;
  const submitted = task?.submitted ?? task?.completed ?? null;
  const late = !!(task?.due && submitted && submitted > task.due);
  const lateFactor = late ? SCORE.lateFactor : 1;
  const score = beforeLate * lateFactor;
  return { base, quality, late, lateFactor, beforeLate, penalty: beforeLate - score, score };
}

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

const inRange = (day, range) => !!day && day >= range.from && day <= (range.end ?? range.to);
const overlaps = (item, range) => item?.from <= (range.end ?? range.to) && item?.to >= range.from;

function reviewPoints(review, level) {
  const base = SCORE.monthlyShiftBase[level] ?? 0;
  const quality = SCORE.quality[review.rating];
  return quality === undefined ? 0 : base * quality;
}

/**
 * Score rows that already belong to one like-for-like cohort.
 * Existing analytics statistics stay untouched; the score is rebuilt directly from filtered facts.
 */
export function buildScoreLeaderboard(rows, facts, range) {
  const scored = rows.map((row) => {
    const tasks = (facts.tasks ?? [])
      .filter((task) => task.a === row.person.id && task.status === "done" && inRange(task.completed, range))
      .map((task) => ({ ...task, scoring: taskPoints(task) }));
    const reviews = row.person.shift
      ? (facts.reviews ?? [])
        .filter((review) => review.a === row.person.id && overlaps(review, range))
        .map((review) => ({ ...review, points: reviewPoints(review, row.person.level) }))
      : [];

    const taskScore = tasks.reduce((sum, task) => sum + task.scoring.score, 0);
    const lateDeduction = tasks.reduce((sum, task) => sum + task.scoring.penalty, 0);
    const reviewScore = reviews.reduce((sum, review) => sum + review.points, 0);
    return {
      ...row,
      taskScore,
      lateDeduction,
      reviewScore,
      score: taskScore + reviewScore,
      scoredTasks: tasks,
      scoredReviews: reviews,
    };
  }).sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name, "fa"));

  const leader = scored.length ? scored[0].score : 0;
  let previousScore = null;
  let previousRank = 0;
  return scored.map((row, index) => {
    const rank = index === 0 || row.score !== previousScore ? index + 1 : previousRank;
    previousScore = row.score;
    previousRank = rank;
    return { ...row, rank, leaderRatio: leader > 0 ? row.score / leader : null };
  });
}

export function scoreLeaderboard(facts, range, cohortKey) {
  const cohorts = performanceCohorts(facts, range);
  const cohort = cohorts.find((x) => x.key === cohortKey) ?? cohorts[0] ?? null;
  if (!cohort) return { cohorts, cohort: null, shift: false, rows: [] };
  const rows = buildScoreLeaderboard(cohort.rows, facts, range);
  return { cohorts, cohort, shift: rows.some((row) => row.person.shift), rows };
}
