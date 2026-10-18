import { getCurrentUser } from "@/lib/server/auth";

/** Only real user interaction in a visible app tab triggers this heartbeat. */
export async function POST() {
  const user = await getCurrentUser({ touch: true });
  return Response.json(
    user ? { ok: true } : { error: "Session expired. Sign in again." },
    { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } }
  );
}
