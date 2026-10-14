import "server-only";
import { db } from "@/lib/server/db";
import { listShiftSchedules, removeDayStatus, removeShiftSchedule, setDayStatus, setShiftSchedule } from "@/lib/server/repo";
import { isDayStatus, isIsoDate, isShiftType, ROSTER_KEYS } from "@/lib/shifts";

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

/**
 * Replace all of a day's work shifts and off/leave statuses atomically.
 * Moving a person between shifts is an update, never two simultaneous shifts.
 * Any conflict with a started shift log rolls the whole operation back.
 */
export function replaceDayShiftAssignments(date, assignments, actorId) {
  if (!isIsoDate(date)) throw new Error("Invalid shift date.");
  const types = ROSTER_KEYS;
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments) ||
      Object.keys(assignments).some((key) => !types.includes(key))) {
    throw new Error("Provide morning, evening, night, off and leave assignments.");
  }

  const desired = new Map();
  for (const type of types) {
    if (!Array.isArray(assignments[type])) throw new Error(`Missing ${type} assignments.`);
    for (const userId of assignments[type]) {
      if (typeof userId !== "string" || !userId.trim()) throw new Error("Invalid shift assignee.");
      if (desired.has(userId)) throw new Error("One person cannot have more than one work shift or absence on the same date.");
      desired.set(userId, type);
    }
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = listShiftSchedules(date, date);
    const current = new Map(existing.map((row) => [row.userId, row.shiftType]));
    // Remove old records first, then add new ones, all inside one transaction.
    for (const row of existing) {
      if (desired.get(row.userId) === row.shiftType) continue;
      if (isDayStatus(row.shiftType)) removeDayStatus(row.userId, date);
      else removeShiftSchedule(row.userId, date);
    }
    for (const [userId, type] of desired) {
      if (current.get(userId) === type) continue;
      if (isDayStatus(type)) setDayStatus(userId, date, type, actorId);
      else setShiftSchedule(userId, date, type, actorId);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listShiftSchedules(date, date);
}
