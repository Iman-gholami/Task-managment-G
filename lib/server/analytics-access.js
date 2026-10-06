import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";

/** Team analytics are for managers; everyone else is sent to their own statistics. */
export async function requireAnalyticsManager() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!isManager(me)) redirect(`/analytics/people/${encodeURIComponent(me.id)}`);
  return me;
}

/** A person's page: managers may open anyone in their scope (the API enforces it); others only themselves. */
export async function requirePersonAccess(id) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!isManager(me) && me.id !== id) redirect(`/analytics/people/${encodeURIComponent(me.id)}`);
  return me;
}
