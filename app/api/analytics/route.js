import { requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { factsFor } from "@/lib/server/analytics";

/**
 * GET /api/analytics?wf&wt[&rf&rt&cf&ct][&demo=1]
 * Facts for the analytics screens, scoped to the viewer (department, SOC, or only themselves).
 * wf/wt: the window of history to load; rf/rt and cf/ct: the selected and comparison periods
 * (used for the anonymous team medians in the personal view). demo=1 returns fictional data (managers).
 */
export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const facts = factsFor(user, q);
  if (!facts) return err(403, "Demo data is available to managers.");
  return Response.json(facts, { headers: { "Cache-Control": "no-store" } });
}
