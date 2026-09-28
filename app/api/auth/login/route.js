import { cookies } from "next/headers";
import { SESSION_COOKIE, login } from "@/lib/server/auth";

export async function POST(request) {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });
  const session = login(email, password);
  if (!session) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: new Date(session.expires),
  });
  return Response.json({ user: session.user });
}
