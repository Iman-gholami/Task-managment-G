import { requireUser } from "@/lib/server/auth";
import { listAssignmentNotifications } from "@/lib/server/repo";

// This read never extends a user's session and exposes only their own current assignments.
export async function GET() {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  return Response.json({ notifications: user.role === "observer" ? [] : listAssignmentNotifications(user.id) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
