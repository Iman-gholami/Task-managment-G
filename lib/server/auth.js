import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";

export const SESSION_COOKIE = "so_session";
const SESSION_DAYS = 7;

const publicUser = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role, team: u.team, color: u.color, assist: u.assist };

export function login(email, password) {
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(String(email).trim());
  if (!user || !verifyPassword(String(password), user.password_hash)) return null;
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_DAYS * 864e5;
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, user.id, expires);
  return { token, expires, user: publicUser(user) };
}

export function logout(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? AND u.active = 1"
  ).get(token, Date.now());
  return publicUser(row);
}

/** Route-handler guard: returns [user, null] or [null, Response]. */
export async function requireUser() {
  const user = await getCurrentUser();
  return user ? [user, null] : [null, Response.json({ error: "Not signed in" }, { status: 401 })];
}

export { canManageMember, isManager } from "@/lib/roles";
