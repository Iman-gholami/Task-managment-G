import { requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { idsForTarget, markRead } from "@/lib/server/notifications";

/** POST { all: true } | { ids: [..] } | { target: "/tasks/T-1001" } → { unread }. Only the user's own notifications. */
export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  if (body.all === true) return Response.json({ unread: markRead(user.id, { all: true }) });
  if (typeof body.target === "string" && body.target.startsWith("/")) return Response.json({ unread: markRead(user.id, { ids: idsForTarget(user.id, body.target) }) });
  if (!Array.isArray(body.ids)) return err(400, "Say which notifications to mark as read.", "invalidNotificationIds");
  return Response.json({ unread: markRead(user.id, { ids: body.ids }) });
}
