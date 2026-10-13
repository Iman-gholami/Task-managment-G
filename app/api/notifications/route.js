import { requireUser } from "@/lib/server/auth";
import { NOTIFICATION_GROUPS, listNotifications, unreadCount } from "@/lib/server/notifications";

/**
 * GET /api/notifications?group=tasks|mentions|shifts&before=<id>&limit=30&unread=1  → { items, more, unread }
 * GET /api/notifications?count=1 → { unread } (cheap; the top bar polls it every 30 seconds)
 * Only the signed-in user's own notifications.
 */
export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const q = new URL(request.url).searchParams;
  const headers = { "Cache-Control": "no-store" };
  if (q.get("count")) return Response.json({ unread: unreadCount(user.id) }, { headers });
  const group = q.get("group") in NOTIFICATION_GROUPS ? q.get("group") : "";
  const page = listNotifications(user.id, { group, before: Number(q.get("before")) || 0, limit: Number(q.get("limit")) || 30, unread: q.get("unread") === "1" });
  return Response.json({ ...page, unread: unreadCount(user.id) }, { headers });
}
