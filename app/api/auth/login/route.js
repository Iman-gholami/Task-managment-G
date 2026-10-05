import { cookies } from "next/headers";
import { SESSION_COOKIE, login } from "@/lib/server/auth";
import {
  checkLoginRateLimit,
  loginClientAddress,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/server/login-rate-limit";

export async function POST(request) {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });

  const address = loginClientAddress(request);
  const limit = checkLoginRateLimit(email, address);
  if (limit.limited) {
    return Response.json(
      { error: "Too many sign-in attempts. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfter),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const session = login(email, password);
  if (!session) {
    recordLoginFailure(email, address);
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  recordLoginSuccess(email);
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: new Date(session.expires),
  });
  return Response.json({ user: session.user });
}
