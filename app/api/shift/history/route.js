import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { getUser, listShiftLogs } from "@/lib/server/repo";
import { isShiftAnalyst, resolvePeriod } from "@/lib/server/stats";

export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const url = new URL(request.url);
  const target = url.searchParams.get("user") || user.id;
  if (target !== user.id && !isManager(user)) return err(403, "You can only view your own shift logs.");
  const owner = getUser(target);
  if (!owner || !isShiftAnalyst(owner)) return err(404, "Shift logs are kept by SOC analysts only.");
  const period = resolvePeriod(Object.fromEntries(url.searchParams));
  return Response.json({ period, logs: listShiftLogs(target, period.from, period.to) });
}
