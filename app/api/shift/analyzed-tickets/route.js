import { requireUser, isManager } from "@/lib/server/auth";
import { canManageShift } from "@/lib/roles";
import { getShiftLog, getUser, findShiftLog } from "@/lib/server/repo";
import { isIsoDate } from "@/lib/shifts";
import { isShiftAnalyst } from "@/lib/server/stats";
import { saveAnalyzedTicket, removeAnalyzedTicket } from "@/lib/server/l2-analyzed-tickets";

async function target(body) {
  const [actor, denied] = await requireUser();
  if (denied) return { denied };
  if (isManager(actor)) {
    const userId = String(body.user ?? "");
    const date = String(body.date ?? "");
    if (!userId || !isIsoDate(date) || !canManageShift(actor, getUser(userId)))
      return { denied: Response.json({ error: "Not permitted to correct this shift log." }, { status: 403 }) };
    if (!findShiftLog(userId, date))
      return { denied: Response.json({ error: "The selected shift log does not exist." }, { status: 404 }) };
    return { userId, date, opts: { manager: true, actorId: actor.id } };
  }
  if (!isShiftAnalyst(actor) || actor.team !== "SOC · L2")
    return { denied: Response.json({ error: "Only SOC Layer 2 can record analyzed tickets." }, { status: 403 }) };
  if (body.user !== undefined || body.date !== undefined)
    return { denied: Response.json({ error: "Analysts can only edit their own current shift." }, { status: 403 }) };
  const log = getShiftLog(actor.id);
  if (!log) return { denied: Response.json({ error: "No shift scheduled for today." }, { status: 404 }) };
  return { userId: actor.id, date: log.date, opts: {} };
}

function fail(e) { return Response.json({ error: e.message }, { status: e.status ?? 409 }); }

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const t = await target(body);
  if (t.denied) return t.denied;
  try {
    const value = saveAnalyzedTicket(t.userId, t.date, { ticketNumber: body.ticketNumber, verdict: body.verdict }, t.opts);
    return Response.json(value, { status: 201 });
  } catch (e) { return fail(e); }
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const t = await target(body);
  if (t.denied) return t.denied;
  try {
    return Response.json(saveAnalyzedTicket(t.userId, t.date,
      { id: body.id, ticketNumber: body.ticketNumber, verdict: body.verdict }, t.opts));
  } catch (e) { return fail(e); }
}

export async function DELETE(request) {
  const body = await request.json().catch(() => ({}));
  const t = await target(body);
  if (t.denied) return t.denied;
  try { return Response.json(removeAnalyzedTicket(t.userId, t.date, body.id, t.opts)); }
  catch (e) { return fail(e); }
}
