import { canManageMember, requireUser } from "@/lib/server/auth";
import { hashPassword } from "@/lib/server/password";
import { createMember, listUsers } from "@/lib/server/repo";
import { ROLE_LABELS, TEAMS } from "@/lib/roles";


export async function GET() {
  const [, denied] = await requireUser();
  return denied ?? Response.json({ users: listUsers() });
}

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const b = await request.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  const email = String(b.email ?? "").trim();
  const password = String(b.password ?? "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a name and a valid email." }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (!(b.role in ROLE_LABELS) || !TEAMS.includes(b.team)) return Response.json({ error: "Invalid role or team." }, { status: 400 });
  if (!canManageMember(user, { id: null, role: b.role, team: b.team })) {
    return Response.json({ error: "You don't have permission to add this member." }, { status: 403 });
  }
  if (listUsers().some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return Response.json({ error: "A user with this email already exists." }, { status: 409 });
  }
  const member = createMember({ name, email, role: b.role, team: b.team, passwordHash: hashPassword(password) });
  return Response.json({ user: member }, { status: 201 });
}
