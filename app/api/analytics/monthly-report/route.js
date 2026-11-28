import { requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { buildMonthlyReport, createMonthlyBundle, renderMonthlyHtml, renderMonthlyComparisonHtml } from "@/lib/server/monthly-report";

export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const query = new URL(request.url).searchParams, format = query.get("format") || "zip";
  if (!["zip", "html", "compare"].includes(format)) return err(400, "Unsupported report format.");
  try {
    const report = buildMonthlyReport(user, { month:query.get("month"), team:query.get("team"), level:query.get("level"), province:query.get("province"), person:query.get("person"), locale:query.get("lang"), demo:query.get("demo"), sections:query.get("sections") });
    if (format !== "zip") return new Response(format === "compare" ? renderMonthlyComparisonHtml(report) : renderMonthlyHtml(report), { headers: {
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; frame-ancestors 'none'; sandbox",
      "Content-Disposition": `inline; filename="Sentinel_Monthly_${report.month}${format === "compare" ? "_Compare" : ""}.html"`,
    } });
    return new Response(await createMonthlyBundle(report), { headers: {
      "Content-Type": "application/zip", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="Sentinel_Monthly_${report.month}.zip"`,
    } });
  } catch (error) {
    if (error?.status) return err(error.status, error.message);
    console.error("Monthly report failed", error);
    return err(500, "Unable to create the monthly report. Please try again.");
  }
}
