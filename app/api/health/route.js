import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** No identifying information: verifies both the HTTP server and SQLite access. */
export async function GET() {
  try {
    db.prepare("SELECT 1 AS ok").get();
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
