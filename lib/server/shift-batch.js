import "server-only";
import { db } from "@/lib/server/db";
import { getCenterHoliday, listShiftSchedules, removeDayStatus, removeShiftSchedule, setDayStatus, setShiftSchedule } from "@/lib/server/repo";
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
export function replaceDayShiftAssignments(date, assignments, actorId, { withinTransaction = false } = {}) {
  if (!isIsoDate(date)) throw new Error("Invalid shift date.");
  const types = ROSTER_KEYS;
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments) ||
      Object.keys(assignments).some((key) => !types.includes(key))) {
    throw new Error("Provide morning, evening, night, off and leave assignments.");
  }

  // Keep old three-shift clients compatible: omitted absence fields retain
  // existing off/leave entries unless their users are moved into a work shift.
  const planned = new Set(types.filter((t) => Array.isArray(assignments[t]))
    .flatMap((t) => assignments[t]));
  const retained = listShiftSchedules(date, date);
  const desired = new Map();
  for (const type of types) {
    const userIds = assignments[type] === undefined && isDayStatus(type)
      ? retained.filter((row) => row.shiftType === type && !planned.has(row.userId)).map((row) => row.userId)
      : assignments[type];
    if (!Array.isArray(userIds)) throw new Error(`Missing ${type} assignments.`);
    for (const userId of userIds) {
      if (typeof userId !== "string" || !userId.trim()) throw new Error("Invalid shift assignee.");
      if (desired.has(userId)) throw new Error("One person cannot have more than one work shift or absence on the same date.");
      desired.set(userId, type);
    }
  }

  if (!withinTransaction) db.exec("BEGIN IMMEDIATE");
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
    if (!withinTransaction) db.exec("COMMIT");
  } catch (error) {
    if (!withinTransaction) db.exec("ROLLBACK");
    throw error;
  }
  return listShiftSchedules(date, date);
}

/** Organization-wide holiday marker independent of scheduled coverage. */
export function updateCenterHoliday(date, closed, note, actorId, { withinTransaction = false } = {}) {
  if (!isIsoDate(date)) throw new Error("Invalid center holiday date.");
  if (typeof closed !== "boolean") throw new Error("Center holiday status must be a boolean.");
  if (typeof note !== "string" || note.trim().length > 240) throw new Error("Holiday reason is too long.");

  if (!withinTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    if (closed) {
      db.prepare(
        `INSERT INTO shift_center_holidays (date, note, created_by, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET note = excluded.note,
           updated_by = excluded.updated_by, updated_at = datetime('now')`
      ).run(date, note.trim(), actorId, actorId);
    } else {
      db.prepare("DELETE FROM shift_center_holidays WHERE date = ?").run(date);
    }
    if (!withinTransaction) db.exec("COMMIT");
  } catch (error) {
    if (!withinTransaction) db.exec("ROLLBACK");
    throw error;
  }
  return getCenterHoliday(date);
}

/** Import a set of daily rosters as one transaction: never partially apply a file. */
export function importShiftDays(days, actorId) {
  if (!Array.isArray(days) || !days.length || days.length > 370) throw new Error("Invalid import day count.");
  const seen = new Set();
  for (const day of days) {
    if (!isIsoDate(day?.date) || seen.has(day.date)) throw new Error("Duplicate or invalid import date.");
    seen.add(day.date);
    if (!day.assignments || typeof day.assignments !== "object") throw new Error("Invalid import assignments.");
    if (day.holidayNote != null && (typeof day.holidayNote !== "string" || day.holidayNote.length > 240))
      throw new Error("Invalid center holiday note.");
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const day of days) {
      replaceDayShiftAssignments(day.date, day.assignments, actorId, { withinTransaction: true });
      if (typeof day.holidayNote === "string")
        updateCenterHoliday(day.date, true, day.holidayNote, actorId, { withinTransaction: true });
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { importedDays: days.length, importedEntries: days.reduce((n, day) =>
    n + Object.values(day.assignments).reduce((m, ids) => m + (Array.isArray(ids) ? ids.length : 0), 0), 0) };
}
