import { requireUser } from "@/lib/server/auth";
import { getShiftLog, setShiftCompleted, updateActivity } from "@/lib/server/repo";

export async function GET() {
  const [user, denied] = await requireUser();
  return denied ?? Response.json(getShiftLog(user.id));
}

/** PATCH { n, patch } updates one activity; PATCH { completed } completes / reopens the shift. */
export async function PATCH(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  if ("completed" in body) {
    if (body.completed && getShiftLog(user.id).activities.some((a) => !a.done)) {
      return Response.json({ error: "Complete all activities first." }, { status: 400 });
    }
    return Response.json(setShiftCompleted(user.id, !!body.completed));
  }
  const n = Number(body.n);
  if (!Number.isInteger(n) || typeof body.patch !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  if ("iocs" in body.patch && !(Number.isInteger(body.patch.iocs) && body.patch.iocs >= 0)) return Response.json({ error: "IOC count must be a whole number." }, { status: 400 });
  try {
    return Response.json({ activities: updateActivity(user.id, n, body.patch) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 409 });
  }
}
