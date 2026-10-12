import { requireChecklistManager } from "@/lib/server/access";
import { checklistFailure, createChecklist, listAssignments, listChecklists } from "@/lib/server/shift-checklists";

/** Managers: every checklist with its items, and which group uses which checklist. */
export async function GET() {
  const [, denied] = await requireChecklistManager();
  if (denied) return denied;
  return Response.json({ checklists: listChecklists(), groups: listAssignments() });
}

/** Managers: new checklist { name, description?, copyFrom? }. It is not used by any group until assigned. */
export async function POST(request) {
  const [user, denied] = await requireChecklistManager();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  try {
    return Response.json({ checklist: createChecklist(body, user.id) }, { status: 201 });
  } catch (e) {
    return checklistFailure(e);
  }
}
