import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { listShiftSchedules, removeShiftSchedule, scheduleStatsByUser, setShiftSchedule } from "@/lib/server/repo";
import { monthBounds } from "@/lib/shifts";
import { isShiftAnalyst } from "@/lib/server/stats";

function canView(user) {
  return isManager(user) || isShiftAnalyst(user);
}

export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!canView(user)) return err(403, "Shift schedule is available to SOC analysts and managers.");

  const url = new URL(request.url);
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const bounds = monthBounds(month);
  if (!bounds) return err(400, "Invalid month.");
  const schedules = listShiftSchedules(bounds.from, bounds.to);
  return Response.json({ month, ...bounds, schedules, statsByUser: scheduleStatsByUser(schedules) });
}

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only SOC or Security Managers can assign shifts.");

  const body = await request.json().catch(() => ({}));
  try {
    const schedule = setShiftSchedule(String(body.userId || ""), String(body.date || ""), String(body.shiftType || ""), user.id);
    return Response.json({ schedule }, { status: 201 });
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
    removeShiftSchedule(String(body.userId || ""), String(body.date || ""));
    return Response.json({ ok: true });
  } catch (e) {
    return err(409, e.message);
  }
}
