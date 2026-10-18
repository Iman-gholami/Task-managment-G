import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, isSessionExpired } from "@/lib/session-policy";

export const SESSION_COOKIE = "so_session";

const publicUser = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role, team: u.team, color: u.color, assist: u.assist };

export function login(email, password) {
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(String(email).trim());
  if (!user || !verifyPassword(String(password), user.password_hash)) return null;
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const expires = now + SESSION_ABSOLUTE_MS;
  db.prepare("INSERT INTO sessions (token, user_id, expires_at, last_activity_at) VALUES (?, ?, ?, ?)")
    .run(token, user.id, expires, now);
  return { token, expires, user: publicUser(user) };
}

export function logout(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/**
 * Reads a session without extending it. Only the dedicated activity endpoint
 * touches last_activity_at, so polling and background API calls do not keep
 * unattended devices signed in.
 */
export async function getCurrentUser({ touch = false } = {}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const now = Date.now();
  const row = db.prepare(
    "SELECT u.*, s.expires_at, s.last_activity_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.active = 1"
  ).get(token);
  if (!row) return null;
  if (isSessionExpired(row, now)) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  if (touch) {
    // Recheck both limits in the UPDATE so a concurrent touch cannot revive a timed-out session.
    const result = db.prepare(
      "UPDATE sessions SET last_activity_at = ? WHERE token = ? AND expires_at > ? AND last_activity_at > ?"
    ).run(now, token, now, now - SESSION_IDLE_MS);
    if (result.changes !== 1) return null;
  }
  return publicUser(row);
}

/** Route-handler guard: returns [user, null] or [null, Response]. */
export async function requireUser() {
  const user = await getCurrentUser();
  return user ? [user, null] : [null, Response.json({ error: "Not signed in" }, { status: 401 })];
}

export { canManageMember, isManager } from "@/lib/roles";
