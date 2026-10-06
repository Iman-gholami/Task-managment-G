import { requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { factsFor, scopeFor } from "@/lib/server/analytics";
import { analyticsWorkbook, workbookName } from "@/lib/server/analytics-export";
import { minIso } from "@/lib/analytics/calendar";
import { applyFilters, parseFilters } from "@/lib/analytics/filters";
import { comparisonRange, resolveRange } from "@/lib/analytics/periods";
import { today } from "@/lib/server/repo";

/**
 * GET /api/analytics/export?kind=full|teams|person[&id=<person>]&<the dashboard's filters>
 * The same filters, period and comparison as the screen, computed by the same code, as .xlsx.
 * Non-managers can only export their own figures.
 */
export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const kind = ["full", "teams", "person"].includes(params.get("kind")) ? params.get("kind") : "full";
  const filters = parseFilters(params);
  const scope = scopeFor(user);
  if (scope.kind === "self" && kind !== "person") return err(403, "Team analytics are available to managers.");
  const personId = scope.kind === "self" ? user.id : params.get("id");

  const now = today();
  const range = resolveRange(filters, now);
  const cmp = comparisonRange(range, filters.cmp);
  const facts = factsFor(user, {
    wf: minIso(range.from, cmp?.from), wt: now, demo: filters.demo,
    rf: range.from, rt: range.end, cf: cmp?.from, ct: cmp?.to,
  });
  if (!facts) return err(403, "Demo data is available to managers.");
  const view = applyFilters(facts, filters);
  if (kind === "person" && !view.people.some((p) => p.id === personId && !p.manager)) return err(404, "Employee not found in this view.");

  const file = await analyticsWorkbook({ kind, facts: view, filters, range, cmp, viewer: user, personId });
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${workbookName(kind, range, facts.demo)}"`,
      "Cache-Control": "no-store",
    },
  });
}
