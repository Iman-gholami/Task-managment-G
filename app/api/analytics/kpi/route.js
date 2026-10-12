import { requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { kpiResultsFor, saveKpiEvaluation, kpiScopesFor } from "@/lib/server/kpi";

const fail = (e) => err(e?.status || 500, e?.message || "KPI operation failed.");

export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!kpiScopesFor(user).length) return err(403, "KPI evaluation is available to managers.");
  const q = new URL(request.url).searchParams;
  try {
    return Response.json(kpiResultsFor(user, { from: q.get("from"), to: q.get("to") }), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!kpiScopesFor(user).length) return err(403, "KPI evaluation is available to managers.");
  const body = await request.json().catch(() => ({}));
  try {
    return Response.json({ row: saveKpiEvaluation(user, body) });
  } catch (e) {
    return fail(e);
  }
}
