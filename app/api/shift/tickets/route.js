import { requireUser } from "@/lib/server/auth";
import { addTicket, getShiftLog } from "@/lib/server/repo";
import { isShiftAnalyst } from "@/lib/server/stats";

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isShiftAnalyst(user)) return Response.json({ error: "Shift logs are kept by SOC analysts only." }, { status: 403 });
  if (getShiftLog(user.id).completedAt) return Response.json({ error: "Shift is already completed." }, { status: 409 });
  const body = await request.json().catch(() => ({}));
  const no = String(body.no ?? "").trim();
  if (!no) return Response.json({ error: "Ticket number is required." }, { status: 400 });
  const tickets = addTicket(user.id, { no, ref: String(body.ref ?? "").trim(), desc: String(body.desc ?? "").trim() });
  return Response.json({ tickets }, { status: 201 });
}
