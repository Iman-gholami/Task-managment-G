import { canManageMember, requireUser } from "@/lib/server/auth";
import { deactivateMember, getUser } from "@/lib/server/repo";

export async function DELETE(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const target = getUser(id);
  if (!target || !target.active) return Response.json({ error: "Member not found." }, { status: 404 });
  if (!canManageMember(user, target)) return Response.json({ error: "You don't have permission to remove this member." }, { status: 403 });
  deactivateMember(id);
  return Response.json({ ok: true });
}
