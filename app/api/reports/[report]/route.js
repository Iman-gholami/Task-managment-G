import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { inReportScope } from "@/lib/roles";
import { getUser } from "@/lib/server/repo";
import { buildReport, reportFileName, toXlsx } from "@/lib/server/reports";
import { resolvePeriod } from "@/lib/server/stats";

/** GET /api/reports/<key>?period&from&to&user&team&status&cx&quality&q[&format=xlsx] */
export async function GET(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { report } = await params;
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const period = resolvePeriod(q);
  // Analysts only see their own data; team reports are for managers.
  if (!isManager(user)) {
    if (report === "team") return err(403, "Team reports are available to managers.");
    q.user = user.id;
  }
  // A SOC Manager's reports cover their SOC analysts only.
  if (q.user) {
    const target = getUser(q.user);
    if (!target) return err(404, "Employee not found.");
    if (!inReportScope(user, target)) return err(403, "This employee is outside your team.");
  }
  const scope = (u) => inReportScope(user, u);
  const data = buildReport(report, { period, scope, userId: q.user || (report === "employee" ? user.id : undefined), team: q.team, status: q.status, cx: q.cx, quality: q.quality, q: q.q });
  if (!data) return err(404, "Report not found.");
  if (q.format !== "xlsx") return Response.json({ period, ...data });
  const file = await toXlsx(data, period);
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportFileName(report, period)}"`,
    },
  });
}
