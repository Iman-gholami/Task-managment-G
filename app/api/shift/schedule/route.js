import { canManageMember, isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { getUser, listShiftAssignments, replaceShiftAssignments } from "@/lib/server/repo";
import { isShiftAnalyst } from "@/lib/server/stats";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHIFTS = new Set(["morning", "evening", "night"]);

function validRange(from, to) {
  if (!DATE.test(from || "") || !DATE.test(to || "") || from > to) return false;
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
  return days >= 0 && days <= 62;
}

/** Manager-only schedule for a calendar range. */
export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only managers can manage the shift schedule.");

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!validRange(from, to)) return err(400, "Invalid schedule date range.");

  return Response.json({ assignments: listShiftAssignments(from, to) });
}

/** Replace the roster for one shift on one day. Selected people are moved from another shift that day. */
export async function PUT(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only managers can manage the shift schedule.");

  const body = await request.json().catch(() => ({}));
  const date = String(body.date || "");
  const shift = String(body.shift || "");
  const userIds = Array.isArray(body.userIds) ? [...new Set(body.userIds.map(String))] : null;
  if (!DATE.test(date) || !SHIFTS.has(shift) || !userIds) return err(400, "Invalid shift assignment.");

  for (const id of userIds) {
    const target = getUser(id);
    if (!target || !target.active || !isShiftAnalyst(target) || !canManageMember(user, target)) {
      return err(403, "One or more selected employees cannot be assigned by this manager.");
    }
  }

  replaceShiftAssignments({ date, shift, userIds, by: user.id });
  return Response.json({ assignments: listShiftAssignments(date, date) });
}
