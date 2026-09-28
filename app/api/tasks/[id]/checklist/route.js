import { requireUser } from "@/lib/server/auth";
import { editableTask, err } from "@/lib/server/access";
import { addChecklistItem, getTaskDetails } from "@/lib/server/repo";

export async function POST(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const [, no] = editableTask(user, id);
  if (no) return no;
  const label = String((await request.json().catch(() => ({}))).label ?? "").trim();
  if (!label) return err(400, "Checklist item can't be empty.");
  addChecklistItem(id, label.slice(0, 300));
  return Response.json({ checklist: getTaskDetails(id).checklist }, { status: 201 });
}
