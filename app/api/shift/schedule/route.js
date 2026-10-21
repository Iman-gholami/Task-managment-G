import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { getDayStatus, listCenterHolidays, listShiftSchedules, removeDayStatus, removeShiftSchedule, scheduleStatsByUser, setDayStatus, setShiftSchedule } from "@/lib/server/repo";
import { replaceDayShiftAssignments, replaceShiftAssignments, updateCenterHoliday } from "@/lib/server/shift-batch";
import { isDayStatus, isIsoDate, monthBounds } from "@/lib/shifts";
import { isShiftAnalyst } from "@/lib/server/stats";

function canView(user) {
  return isManager(user) || isShiftAnalyst(user);
}

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 864e5);
}

export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!canView(user)) return err(403, "Shift schedule is available to SOC analysts and managers.");

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  let bounds;
  let month = null;

  if (fromParam || toParam) {
    if (!isIsoDate(fromParam) || !isIsoDate(toParam) || fromParam > toParam || daysBetween(fromParam, toParam) > 400) {
      return err(400, "Invalid date range.");
    }
    bounds = { from: fromParam, to: toParam };
  } else {
    month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    bounds = monthBounds(month);
    if (!bounds) return err(400, "Invalid month.");
  }

  const schedules = listShiftSchedules(bounds.from, bounds.to);
  return Response.json({ month, ...bounds, schedules, centerHolidays: listCenterHolidays(bounds.from, bounds.to), statsByUser: scheduleStatsByUser(schedules) });
}

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only SOC or Security Managers can assign shifts.");

  const body = await request.json().catch(() => ({}));
  try {
    const userId = String(body.userId || "");
    const date = String(body.date || "");
    const shiftType = String(body.shiftType || "");
    const schedule = isDayStatus(shiftType)
      ? (setDayStatus(userId, date, shiftType, user.id), { userId, date, shiftType })
      : setShiftSchedule(userId, date, shiftType, user.id);
    return Response.json({ schedule }, { status: 201 });
  } catch (e) {
    return err(409, e.message);
  }
}

/** Replace all shifts for a day atomically; legacy clients may replace one shift. */
export async function PUT(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only SOC or Security Managers can assign shifts.");

  const body = await request.json().catch(() => ({}));
  try {
    const assignments = body.assignments !== undefined
      ? replaceDayShiftAssignments(String(body.date || ""), body.assignments, user.id)
      : replaceShiftAssignments(
          String(body.date || ""),
          String(body.shiftType || ""),
          Array.isArray(body.userIds) ? body.userIds.map(String) : [],
          user.id
        );
    return Response.json({ assignments });
  } catch (e) {
    return err(409, e.message);
  }
}

export async function DELETE(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only SOC or Security Managers can remove shifts.");

  const body = await request.json().catch(() => ({}));
  try {
    const userId = String(body.userId || "");
    const date = String(body.date || "");
    if (getDayStatus(userId, date)) removeDayStatus(userId, date);
    else removeShiftSchedule(userId, date);
    return Response.json({ ok: true });
  } catch (e) {
    return err(409, e.message);
  }
}

/** Manager-only organization-wide holiday; never conflated with individual leave. */
export async function PATCH(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only managers can change center holidays.");
  const body = await request.json().catch(() => ({}));
  try {
    const holiday = updateCenterHoliday(body.date, body.closed, body.note ?? "", user.id);
    return Response.json({ holiday, ok: true });
  } catch (error) {
    return err(409, error.message);
  }
}
