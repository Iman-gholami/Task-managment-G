import "server-only";
import { db } from "@/lib/server/db";
import { ShiftLogError, findShiftLog, getShiftSchedule, getUser, patchActivities } from "@/lib/server/repo";
import { isIsoDate } from "@/lib/shifts";

function existingLog(userId, date) {
  if (!isIsoDate(date)) throw new ShiftLogError(400, "Invalid shift date.");
  if (!getShiftSchedule(userId, date)) throw new ShiftLogError(404, "No shift is scheduled for this day.");
  const log = findShiftLog(userId, date);
  if (!log) throw new ShiftLogError(404, "No shift log was recorded for this day.");
  return log;
}

/**
 * Managers may correct an existing shift log even after the analyst submitted it. The log keeps the checklist
 * items it was created with; each corrected activity records who corrected it and when.
 */
export function managerUpdateShiftActivity(userId, date, n, patch, itemId, managerId) {
  const log = existingLog(userId, date);
  if (log.mode === "ticket_analysis")
    throw new ShiftLogError(403, "This daytime Layer 2 log accepts ticket analysis only.");
  const activities = patchActivities(log.activities, n, patch, itemId, { correctedBy: managerId, correctedAt: new Date().toISOString() });
  db.prepare("UPDATE shift_logs SET data = ?, updated_at = datetime('now') WHERE user_id = ? AND date = ?")
    .run(JSON.stringify(activities), userId, date);
  return findShiftLog(userId, date);
}

/** Completion is one-way. Managers can complete an old/incomplete log, but nobody reopens a submitted log. */
export function managerCompleteShiftLog(userId, date) {
  const log = existingLog(userId, date);
  if (log.completedAt) return log;
  if (log.mode !== "ticket_analysis" && log.activities.some((activity) => !activity.done))
    throw new ShiftLogError(409, "Complete all activities first.");
  db.prepare("UPDATE shift_logs SET completed_at = ?, updated_at = datetime('now') WHERE user_id = ? AND date = ?")
    .run(new Date().toISOString(), userId, date);
  return findShiftLog(userId, date);
}
