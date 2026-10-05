import { requireUser } from "@/lib/server/auth";
import { today } from "@/lib/server/repo";
import { toXlsx } from "@/lib/server/reports";
import { TEAM_GROUPS, workforceReport, workforceWorkbook } from "@/lib/server/workforce";
import { resolveJalaliPeriod } from "@/lib/jalali";

/**
 * GET /api/reports/workforce?period=month|season|year|custom&key&from&to[&team][&format=xlsx]
 * Workforce Performance: one row per person with an overall score. Scope follows the viewer's role
 * (see workforceReport); the team filter is for Security Managers.
 */
export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const period = resolveJalaliPeriod(q, today());
  const team = user.role === "security_manager" && TEAM_GROUPS.includes(q.team) ? q.team : undefined;
  const data = workforceReport(user, period, { team, details: q.format === "xlsx" });
  if (q.format !== "xlsx") return Response.json(data);

  const file = await toXlsx(workforceWorkbook(data, user), period);
  const name = `گزارش عملکرد نیروها - ${period.label}${team ? ` - ${team}` : ""}.xlsx`;
  const ascii = `Workforce_Performance_${period.key}${team ? `_${team.replace(/\W+/g, "_")}` : ""}.xlsx`;
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
