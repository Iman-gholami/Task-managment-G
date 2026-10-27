import { requireUser } from "@/lib/server/auth";
import { canManageShift } from "@/lib/roles";
import { getUser } from "@/lib/server/repo";
import { backfillDays, setBackfillDays } from "@/lib/server/shift-backfill";

export async function GET(request) {
  const [actor, denied] = await requireUser();
  if (denied) return denied;
  const userId = new URL(request.url).searchParams.get("user") || "";
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
