import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { findShiftLog, getShiftLog, getUser, setShiftCompleted, updateActivity } from "@/lib/server/repo";
import { isShiftAnalyst } from "@/lib/server/stats";

/** GET ?user=<id>&date=<yyyy-mm-dd>: own log, or (managers) any analyst's log, read-only. */
export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const url = new URL(request.url);
  const target = url.searchParams.get("user") || user.id;
  const date = url.searchParams.get("date") || undefined;
  if (target !== user.id && !isManager(user)) return err(403, "You can only view your own shift log.");
  const owner = getUser(target);
  if (!owner || !isShiftAnalyst(owner)) return err(404, "Shift logs are kept by SOC analysts only.");
  const log = target === user.id && !date ? getShiftLog(target) : findShiftLog(target, date);
  if (!log) return err(404, date ? "No shift activity has been recorded for this day." : "No shift is scheduled for today.");
  return Response.json(log);
}

/** PATCH { n, patch } updates one activity; PATCH { completed } completes / reopens the shift. */
export async function PATCH(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isShiftAnalyst(user)) return err(403, "Shift logs are kept by SOC analysts only.");
  const body = await request.json().catch(() => ({}));
  if ("completed" in body) {
    const log = getShiftLog(user.id);
    if (!log) return err(404, "No shift is scheduled for today.");
    if (body.completed && log.activities.some((a) => !a.done)) return err(400, "Complete all activities first.");
    try {
      return Response.json(setShiftCompleted(user.id, !!body.completed));
    } catch (e) {
      return err(409, e.message);
    }
  }
  const n = Number(body.n);
  if (!Number.isInteger(n) || typeof body.patch !== "object") return err(400, "Invalid request.");
  if ("iocs" in body.patch && !(Number.isInteger(body.patch.iocs) && body.patch.iocs >= 0)) return err(400, "IOC count must be a whole number.");
  try {
    return Response.json({ activities: updateActivity(user.id, n, body.patch) });
  } catch (e) {
    return err(409, e.message);
  }
}
