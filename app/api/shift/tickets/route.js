import { requireUser } from "@/lib/server/auth";
import { addTicket } from "@/lib/server/repo";

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const no = String(body.no ?? "").trim();
  if (!no) return Response.json({ error: "Ticket number is required." }, { status: 400 });
  const tickets = addTicket(user.id, { no, ref: String(body.ref ?? "").trim(), desc: String(body.desc ?? "").trim() });
  return Response.json({ tickets }, { status: 201 });
}
