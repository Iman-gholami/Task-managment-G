import "server-only";
import { db } from "@/lib/server/db";
import { listShiftSchedules, removeShiftSchedule, setShiftSchedule } from "@/lib/server/repo";
import { isIsoDate, isShiftType } from "@/lib/shifts";

export function replaceShiftAssignments(date, shiftType, userIds, actorId) {
  if (!isIsoDate(date)) throw new Error("Invalid shift date.");
  if (!isShiftType(shiftType)) throw new Error("Invalid shift type.");

  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  const current = listShiftSchedules(date, date).filter((row) => row.shiftType === shiftType);
  const wanted = new Set(uniqueIds);

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of current) {
      if (!wanted.has(row.userId)) removeShiftSchedule(row.userId, date);
    }
    for (const userId of uniqueIds) setShiftSchedule(userId, date, shiftType, actorId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return listShiftSchedules(date, date);
}
