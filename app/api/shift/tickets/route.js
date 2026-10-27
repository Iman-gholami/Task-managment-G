import { requireUser } from "@/lib/server/auth";
import { addTicket, getShiftLog } from "@/lib/server/repo";
import { isShiftAnalyst } from "@/lib/server/stats";
import { today } from "@/lib/server/repo";
import { isBackfillAllowed } from "@/lib/server/shift-backfill";

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isShiftAnalyst(user)) return Response.json({ error: "Shift logs are kept by SOC analysts only." }, { status: 403 });
  if (user.team === "SOC · L2") return Response.json({ error: "Layer 2 uses analyzed tickets only." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const date = body.date === undefined ? today() : String(body.date);
  if (date !== today() && !isBackfillAllowed(user.id, date))
    return Response.json({ error: "Historical entry requires manager authorization." }, { status: 403 });
  const log = getShiftLog(user.id, date);
  if (!log) return Response.json({ error: "No shift is scheduled for today." }, { status: 404 });
  if (log.completedAt) return Response.json({ error: "Shift is already completed." }, { status: 409 });
  const no = String(body.no ?? "").trim();
  if (!no) return Response.json({ error: "Ticket number is required." }, { status: 400 });
  const tickets = addTicket(user.id, { no, ref: String(body.ref ?? "").trim(), desc: String(body.desc ?? "").trim() }, date);
  return Response.json({ tickets }, { status: 201 });
}
