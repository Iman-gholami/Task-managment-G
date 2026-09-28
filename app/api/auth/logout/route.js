import { cookies } from "next/headers";
import { SESSION_COOKIE, logout } from "@/lib/server/auth";

export async function POST() {
  const store = await cookies();
  logout(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
