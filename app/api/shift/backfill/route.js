import { requireUser } from "@/lib/server/auth";
import { canManageShift } from "@/lib/roles";
import { getUser } from "@/lib/server/repo";
import { backfillDays, setBackfillDays, returnedShiftsForAnalyst, returnedShiftsForManager } from "@/lib/server/shift-backfill";

export async function GET(request) {
  const [actor, denied] = await requireUser();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  // The same endpoint also powers live dashboard queues. No manager-only data
  // can be requested by an analyst: both scopes are checked on the server.
  if (params.get("scope") === "self" || params.get("scope") === "pending") {
    try {
      const pending = params.get("scope") === "self"
        ? returnedShiftsForAnalyst(actor) : returnedShiftsForManager(actor);
      return Response.json({ count: pending.length, pending }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      return Response.json({ error: e.message }, { status: e.status ?? 403 });
    }
  }
  const userId = params.get("user") || "";
  if (!canManageShift(actor, getUser(userId)))
    return Response.json({ error: "Not authorized to manage this analyst." }, { status: 403 });
  return Response.json({ days: backfillDays(userId) });
}

export async function POST(request) {
  const [actor, denied] = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  try {
    const result = setBackfillDays(actor, String(body.userId ?? ""), body.dates, body.enabled, body.reason ?? "");
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status ?? 409 });
  }
}
