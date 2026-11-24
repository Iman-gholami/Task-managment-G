import "server-only";
import { tehranDate } from "@/lib/shifts";
import { continuingNightDate } from "@/lib/shift-log-window";
import { findShiftLog, getShiftSchedule } from "@/lib/server/repo";

/** A normal entry is allowed on its calendar day or during the following night-shift hours. */
export function isRegularShiftLogDate(userId, date, now = new Date()) {
  if (date === tehranDate(now)) return true;
  return date === continuingNightDate(now) && getShiftSchedule(userId, date)?.shiftType === "night";
}

/** Prefer the still-unsubmitted overnight log until 08:00, even after midnight. */
export function activeShiftLogDate(userId, now = new Date()) {
  const nightDate = continuingNightDate(now);
  if (nightDate && getShiftSchedule(userId, nightDate)?.shiftType === "night" && !findShiftLog(userId, nightDate)?.completedAt)
    return nightDate;
  return tehranDate(now);
}
