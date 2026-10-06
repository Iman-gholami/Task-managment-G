// Thresholds for statistics, alerts and insights. Change them here; nothing else hard-codes them.

/** Smallest sample a rate or median is shown for; below it the UI shows "—" with the sample size. */
export const MIN_SAMPLE = 5;
/** A percentage change is only stated when the earlier value is at least this big. */
export const MIN_BASE_FOR_CHANGE = 5;

export const ALERTS = {
  overdueOldDays: 7, // overdue longer than this → critical
  missedLogDays: 3, // shift logs not completed in the last N days → critical
  blockedDays: 3, // blocked longer than this → warning
  reviewDays: 2, // waiting for review longer than this → warning
  growthWeeks: 3, // created > completed in each of the last N full weeks → warning
  loadFactor: 2, // open tasks ≥ factor × team median …
  loadMin: 5, // … and at least this many → warning
  iocDrop: 0.3, // IOC per shift down by this share vs the comparison period → info
  iocMinShifts: 10,
};

export const INSIGHTS = {
  deptChange: 0.1, // department completed tasks
  teamChange: 0.15, // one team's completed tasks
  trendWeeks: 3, // consecutive weeks of rise or fall
  trendMinChange: 0.2,
  qualityDropPoints: 0.1, // share of Excellent + Good, in points
  qualityMinRated: 8,
  volumeRise: 0.1,
  netBacklogMin: 5,
  onTimePoints: 0.1,
  onTimeMinN: 8,
  cycleChange: 0.25,
  cycleMinN: 8,
  concentration: 0.4, // one person's share of a team's open tasks
  concentrationMinOpen: 6,
  complexPoints: 0.1,
  complexMinN: 10,
  routinePoints: 0.05,
  routineMinActs: 50,
  activityLow: 0.8,
  activityMinN: 10,
  ticketSpike: 3, // a day with ≥ 3 × the median daily tickets …
  ticketSpikeMin: 5, // … and at least this many
  hoursPerTaskChange: 0.2,
  hoursMinN: 10,
  maxOnOverview: 4,
};

/** Facts are loaded for at least this many days back, so trends and the yearly heatmap have history. */
export const HISTORY_DAYS = 371;
/** Longest window the API serves in one request (days). */
export const MAX_WINDOW_DAYS = 1100;
/** Most items on the Compare page. */
export const MAX_COMPARE = 4;
