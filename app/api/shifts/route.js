import { canManageMember, isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { getUser, listShiftSchedules, removeShiftSchedule, scheduleStatsByUser, setShiftSchedule, today } from "@/lib/server/repo";
import { SHIFT_TYPES, monthBounds } from "@/lib/shifts";
import { isShiftAnalyst } from "@/lib/server/stats";

function allowed(user) {
  return isManager(user) || isShiftAnalyst(user);
}

export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!allowed(user)) return err(403, "Shift scheduling is available to SOC analysts and managers.");
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || today().slice(0, 7);
  const bounds = monthBounds(month);
  if (!bounds) return err(400, "Invalid month. Use YYYY-MM.");
  const schedules = listShiftSchedules(bounds.from, bounds.to);
  return Response.json({
    month,
    ...bounds,
    schedules,
    statsByUser: scheduleStatsByUser(schedules),
    shiftTypes: SHIFT_TYPES,
  });
}

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only managers can edit the shift schedule.");
  const body = await request.json().catch(() => ({}));
  const target = getUser(String(body.userId ?? ""));
  if (!target) return err(404, "Analyst not found.");
  if (!canManageMember(user, target)) return err(403, "You cannot schedule this analyst.");
  try {
    const schedule = setShiftSchedule(target.id, String(body.date ?? ""), String(body.shiftType ?? ""), user.id);
    return Response.json({ schedule });
  } catch (e) {
    return err(409, e.message);
  }
}

export async function DELETE(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only managers can edit the shift schedule.");
  const body = await request.json().catch(() => ({}));
  const target = getUser(String(body.userId ?? ""));
  if (!target) return err(404, "Analyst not found.");
  if (!canManageMember(user, target)) return err(403, "You cannot schedule this analyst.");
  try {
    removeShiftSchedule(target.id, String(body.date ?? ""));
    return Response.json({ ok: true });
  } catch (e) {
    return err(409, e.message);
  }
}
