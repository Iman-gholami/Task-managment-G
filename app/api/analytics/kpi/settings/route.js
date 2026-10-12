import { requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { kpiSettingsFor, saveKpiConfig, kpiScopesFor } from "@/lib/server/kpi";

const fail = (e) => err(e?.status || 500, e?.message || "KPI settings operation failed.");

export async function GET() {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!kpiScopesFor(user).length) return err(403, "KPI settings are available to managers.");
  try {
    return Response.json(kpiSettingsFor(user), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!kpiScopesFor(user).length) return err(403, "KPI settings are available to managers.");
  const body = await request.json().catch(() => ({}));
  try {
    return Response.json({ config: saveKpiConfig(user, body) });
  } catch (e) {
    return fail(e);
  }
}
