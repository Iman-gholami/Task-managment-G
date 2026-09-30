import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { actOnShiftChange, createShiftChangeRequest, listShiftChangeRequests } from "@/lib/server/repo";
import { isShiftAnalyst } from "@/lib/server/stats";

export async function GET() {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user) && !isShiftAnalyst(user)) return err(403, "Shift changes are available to SOC analysts and managers.");
  return Response.json({ requests: listShiftChangeRequests(user.id, isManager(user)) });
}

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isShiftAnalyst(user)) return err(403, "Only SOC analysts can request a shift change.");
  const body = await request.json().catch(() => ({}));
  try {
    const change = createShiftChangeRequest(user.id, String(body.targetId || ""), String(body.date || ""), String(body.reason || ""));
    return Response.json({ request: change }, { status: 201 });
  } catch (e) {
    return err(409, e.message);
  }
}

export async function PATCH(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  const action = String(body.action || "");
  if (!Number.isInteger(id) || id < 1) return err(400, "Invalid request id.");
  try {
    return Response.json({ request: actOnShiftChange(id, user, action) });
  } catch (e) {
    return err(409, e.message);
  }
}
