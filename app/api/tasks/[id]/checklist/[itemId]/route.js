import { requireUser } from "@/lib/server/auth";
import { editableTask, err } from "@/lib/server/access";
import { deleteChecklistItem, getChecklistItem, getTaskDetails, updateChecklistItem } from "@/lib/server/repo";

async function load(params) {
  const [user, denied] = await requireUser();
  if (denied) return [null, denied];
  const { id, itemId } = await params;
  const [, no] = editableTask(user, id);
  if (no) return [null, no];
  const item = getChecklistItem(Number(itemId));
  if (!item || item.task_id !== id) return [null, err(404, "Checklist item not found.")];
  return [{ id, item }, null];
}

export async function PATCH(request, { params }) {
  const [ctx, no] = await load(params);
  if (no) return no;
  const body = await request.json().catch(() => ({}));
  updateChecklistItem(ctx.item.id, { done: typeof body.done === "boolean" ? body.done : undefined, label: body.label?.trim() || undefined });
  return Response.json({ checklist: getTaskDetails(ctx.id).checklist });
}

export async function DELETE(request, { params }) {
  const [ctx, no] = await load(params);
  if (no) return no;
  deleteChecklistItem(ctx.item.id);
  return Response.json({ checklist: getTaskDetails(ctx.id).checklist });
}
