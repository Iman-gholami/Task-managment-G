import { isManager, requireUser } from "@/lib/server/auth";
import { canManageShift } from "@/lib/roles";
import { err } from "@/lib/server/access";
import { findShiftLog, getShiftLog, getUser, setShiftCompleted, updateActivity } from "@/lib/server/repo";
import { managerCompleteShiftLog, managerUpdateShiftActivity } from "@/lib/server/shift-log-admin";
import { isShiftAnalyst } from "@/lib/server/stats";
import { isIsoDate } from "@/lib/shifts";

/** Maps a failed write to a response. A stale client gets the current log back so it can show the latest checklist. */
function failure(e, currentLog) {
  if (e.stale) return Response.json({ error: e.message, stale: true, log: currentLog() }, { status: 409 });
  return err(e.status ?? 409, e.message);
}

/** `itemId` names the checklist item the client believes it is changing (null for the built-in routine). */
const itemIdOf = (body) => (body.itemId === undefined ? undefined : body.itemId === null ? null : Number(body.itemId));

function managedAnalyst(actor, id) {
  const owner = getUser(id);
  return owner && canManageShift(actor, owner) ? owner : null;
}

/** GET ?user=<id>&date=<yyyy-mm-dd>: own log, or (managers) a managed analyst's log, read-only. */
export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const url = new URL(request.url);
  const target = url.searchParams.get("user") || user.id;
  const date = url.searchParams.get("date") || undefined;

  if (target !== user.id) {
    if (!isManager(user)) return err(403, "You can only view your own shift log.");
    if (!managedAnalyst(user, target)) return err(403, "You cannot manage this analyst's shift log.");
  }

  const owner = getUser(target);
  if (!owner || !isShiftAnalyst(owner)) return err(404, "Shift logs are kept by SOC analysts only.");
  const log = target === user.id && !date ? getShiftLog(target) : findShiftLog(target, date);
  if (!log) return err(404, "No shift log was recorded for this day.");
  return Response.json(log);
}

/**
 * Analysts may edit only today's own log until they submit it once.
 * Managers may correct an existing managed analyst log for an explicit user/date, including after submission.
 * Completion is one-way: submitted logs are never reopened for analysts.
 */
export async function PATCH(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));

  if (isManager(user)) {
    const hasCorrectionTarget = body.user !== undefined || body.date !== undefined;
    if (!hasCorrectionTarget) return err(403, "Managers do not have personal shift logs. Use Log corrections to edit an analyst log.");

    const target = String(body.user ?? "");
    const date = String(body.date ?? "");
    if (!target || !isIsoDate(date)) return err(400, "Manager corrections require a valid analyst and date.");
    if (!managedAnalyst(user, target)) return err(403, "You cannot manage this analyst's shift log.");

    if ("completed" in body) {
      if (!body.completed) return err(409, "Submitted shift logs cannot be reopened. Managers can correct them directly while they remain submitted.");
      try {
        return Response.json(managerCompleteShiftLog(target, date));
      } catch (e) {
        return err(409, e.message);
      }
    }

    if (getUser(target)?.team === "SOC · L2") return err(403, "Layer 2 shift logs accept ticket analysis only.");
    const n = Number(body.n);
    if (!Number.isInteger(n) || !body.patch || typeof body.patch !== "object") return err(400, "Invalid request.");
    if ("iocs" in body.patch && !(Number.isInteger(body.patch.iocs) && body.patch.iocs >= 0)) return err(400, "IOC count must be a whole number.");
    try {
      const log = managerUpdateShiftActivity(target, date, n, body.patch, itemIdOf(body), user.id);
      return Response.json({ activities: log.activities, log });
    } catch (e) {
      return failure(e, () => findShiftLog(target, date));
    }
  }

  if (!isShiftAnalyst(user)) return err(403, "Shift logs are kept by SOC analysts only.");
  const log = getShiftLog(user.id);
  if (!log) return err(404, "No shift is scheduled for today.");

  if ("completed" in body) {
    if (!body.completed) return err(409, "Submitted shift logs are locked. Ask a manager to make any correction.");
    if (log.completedAt) return err(409, "Shift is already completed.");
    if (user.team !== "SOC · L2" && log.activities.some((a) => !a.done)) return err(400, "Complete all activities first.");
    try {
      return Response.json(setShiftCompleted(user.id, true));
    } catch (e) {
      return err(409, e.message);
    }
  }

  if (user.team === "SOC · L2") return err(403, "Layer 2 shift logs accept ticket analysis only.");
  const n = Number(body.n);
  if (!Number.isInteger(n) || !body.patch || typeof body.patch !== "object") return err(400, "Invalid request.");
  if ("iocs" in body.patch && !(Number.isInteger(body.patch.iocs) && body.patch.iocs >= 0)) return err(400, "IOC count must be a whole number.");
  try {
    return Response.json({ activities: updateActivity(user.id, n, body.patch, itemIdOf(body)) });
  } catch (e) {
    return failure(e, () => getShiftLog(user.id));
  }
}
