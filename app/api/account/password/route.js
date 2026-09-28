import { cookies } from "next/headers";
import { SESSION_COOKIE, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { endSessions, getUser, updateMember } from "@/lib/server/repo";

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { current, next } = await request.json().catch(() => ({}));
  if (!verifyPassword(String(current ?? ""), getUser(user.id).password_hash)) return err(400, "Current password is incorrect.");
  if (String(next ?? "").length < 8) return err(400, "New password must be at least 8 characters.");
  if (next === current) return err(400, "New password must be different.");
  updateMember(user.id, { passwordHash: hashPassword(next) });
  endSessions(user.id, (await cookies()).get(SESSION_COOKIE)?.value); // sign out other devices
  return Response.json({ ok: true });
}
