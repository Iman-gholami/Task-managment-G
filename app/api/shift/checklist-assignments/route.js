import { err, requireChecklistManager } from "@/lib/server/access";
import { checklistFailure, listAssignments, setAssignment } from "@/lib/server/shift-checklists";

/** Managers: which checklist each SOC group uses, and whether it is on. */
export async function GET() {
  const [, denied] = await requireChecklistManager();
  if (denied) return denied;
  return Response.json({ groups: listAssignments() });
}

/** Managers: { team, checklistId?: number | null, enabled?: boolean }. checklistId null removes the group's checklist. */
export async function PUT(request) {
  const [user, denied] = await requireChecklistManager();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  if (typeof body.team !== "string") return err(400, "Choose a group.");
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") return err(400, "enabled must be true or false.");
  try {
    const group = setAssignment(body.team, { checklistId: body.checklistId, enabled: body.enabled }, user.id);
    return Response.json({ group, groups: listAssignments() });
  } catch (e) {
    return checklistFailure(e);
  }
}
