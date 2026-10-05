import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { inReportScope } from "@/lib/roles";
import { getUser } from "@/lib/server/repo";
import { employeeStats, overview, resolvePeriod, teamStats } from "@/lib/server/stats";

/** GET ?user=<id>&period=this|last|quarter|custom&from&to  — one employee, or the overview when no user. */
export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const period = resolvePeriod(q);
  if (!q.user) {
    if (!isManager(user)) return err(403, "Performance overview is available to managers.");
    // A SOC Manager sees their SOC analysts and the SOC team only.
    const soc = user.role === "soc_manager";
    return Response.json({
      period,
      rows: overview(period).filter((r) => r.id !== user.id && inReportScope(user, r)),
      teams: teamStats(period).filter((t) => !soc || t.team === "SOC"),
    });
  }
  if (q.user !== user.id && !isManager(user)) return err(403, "You can only view your own performance.");
  const u = getUser(q.user);
  if (!u) return err(404, "Employee not found.");
  if (!inReportScope(user, u)) return err(403, "This employee is outside your team.");
  const { password_hash, ...safe } = u;
  return Response.json(employeeStats({ ...safe, active: !!u.active }, period));
}
