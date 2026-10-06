import "server-only";
import { db } from "@/lib/server/db";
import { findShiftLog, getShiftSchedule } from "@/lib/server/repo";
import { isIsoDate } from "@/lib/shifts";

const ACTIVITY_FIELDS = ["done", "iocs", "bale", "mispRef", "issue", "note"];

function existingLog(userId, date) {
  if (!isIsoDate(date)) throw new Error("Invalid shift date.");
  if (!getShiftSchedule(userId, date)) throw new Error("No shift is scheduled for this day.");
  const log = findShiftLog(userId, date);
  if (!log) throw new Error("No shift log was recorded for this day.");
  return log;
}

/** Managers may correct an existing shift log even after the analyst submitted it. */
export function managerUpdateShiftActivity(userId, date, n, patch) {
  const log = existingLog(userId, date);
  const clean = Object.fromEntries(Object.entries(patch ?? {}).filter(([key]) => ACTIVITY_FIELDS.includes(key)));
  if (!Object.keys(clean).length) throw new Error("No editable shift-log fields were provided.");
  if (!log.activities.some((activity) => activity.n === n)) throw new Error("Shift activity was not found.");

  const activities = log.activities.map((activity) => activity.n === n ? { ...activity, ...clean } : activity);
  db.prepare("UPDATE shift_logs SET data = ?, updated_at = datetime('now') WHERE user_id = ? AND date = ?")
    .run(JSON.stringify(activities), userId, date);
  return findShiftLog(userId, date);
}

/** Completion is one-way. Managers can complete an old/incomplete log, but nobody reopens a submitted log. */
export function managerCompleteShiftLog(userId, date) {
  const log = existingLog(userId, date);
  if (log.completedAt) return log;
  if (log.activities.some((activity) => !activity.done)) throw new Error("Complete all activities first.");
  db.prepare("UPDATE shift_logs SET completed_at = ?, updated_at = datetime('now') WHERE user_id = ? AND date = ?")
    .run(new Date().toISOString(), userId, date);
  return findShiftLog(userId, date);
}
