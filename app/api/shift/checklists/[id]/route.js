import { err, requireChecklistManager } from "@/lib/server/access";
import { archiveChecklist, checklistFailure, getChecklist, listEvents, listVersions, saveChecklist } from "@/lib/server/shift-checklists";

async function load(params) {
  const [user, denied] = await requireChecklistManager();
  if (denied) return [null, null, denied];
  const id = Number((await params).id);
  const checklist = Number.isInteger(id) && id > 0 ? getChecklist(id) : null;
  if (!checklist || checklist.archived) return [null, null, err(404, "Checklist not found.")];
  return [user, checklist, null];
}

/** Managers: one checklist with its version history and audit trail. */
export async function GET(request, { params }) {
  const [, checklist, no] = await load(params);
  if (no) return no;
  return Response.json({ checklist, versions: listVersions(checklist.id), events: listEvents(checklist.id) });
}

/**
 * Managers: save the whole definition { version, name, description, items: [{ id?, title, hint, kind, shiftTypes, active }] }
 * as the next version. Shift logs already started keep the items they were created with.
 */
export async function PUT(request, { params }) {
  const [user, checklist, no] = await load(params);
  if (no) return no;
  const body = await request.json().catch(() => ({}));
  if (body.version === undefined) return err(400, "Say which version you edited (version).");
  try {
    const { checklist: saved, changes } = saveChecklist(checklist.id, body, user.id);
    return Response.json({ checklist: saved, changes, versions: listVersions(checklist.id), events: listEvents(checklist.id) });
  } catch (e) {
    return checklistFailure(e);
  }
}

/** Managers: archive a checklist no group uses. */
export async function DELETE(request, { params }) {
  const [user, checklist, no] = await load(params);
  if (no) return no;
  try {
    return Response.json(archiveChecklist(checklist.id, user.id));
  } catch (e) {
    return checklistFailure(e);
  }
}
