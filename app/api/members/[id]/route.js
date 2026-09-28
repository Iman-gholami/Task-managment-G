import { canManageMember, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { hashPassword } from "@/lib/server/password";
import { deactivateMember, endSessions, getUser, updateMember } from "@/lib/server/repo";
import { assignableFor } from "@/lib/roles";

async function target(params) {
  const [user, denied] = await requireUser();
  if (denied) return [null, null, denied];
  const { id } = await params;
  const t = getUser(id);
  if (!t || !t.active) return [null, null, err(404, "Member not found.")];
  if (!canManageMember(user, t)) return [null, null, err(403, "You don't have permission to manage this member.")];
  return [user, t, null];
}

/** Edit role / team, or reset the password. */
export async function PATCH(request, { params }) {
  const [user, t, no] = await target(params);
  if (no) return no;
  const b = await request.json().catch(() => ({}));
  const { roles, teams } = assignableFor(user);
  const role = b.role ?? t.role;
  const team = b.team ?? t.team;
  if ((b.role && !roles.includes(role)) || (b.team && !teams.includes(team))) return err(403, "You can't assign that role or team.");
  if (!canManageMember(user, { id: t.id, role, team })) return err(403, "That change is outside what you can manage.");
  let passwordHash;
  if (b.password !== undefined && b.password !== "") {
    if (String(b.password).length < 8) return err(400, "Password must be at least 8 characters.");
    passwordHash = hashPassword(String(b.password));
  }
  const member = updateMember(t.id, { role, team, passwordHash });
  if (passwordHash || role !== t.role) endSessions(t.id);
  return Response.json({ user: member });
}

export async function DELETE(request, { params }) {
  const [, t, no] = await target(params);
  if (no) return no;
  deactivateMember(t.id);
  return Response.json({ ok: true });
}
