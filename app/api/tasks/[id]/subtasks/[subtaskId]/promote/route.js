import { requireUser } from "@/lib/server/auth";
import { err, viewableTask } from "@/lib/server/access";
import { canReviewTask } from "@/lib/roles";
import { getTask, promoteSubtask } from "@/lib/server/repo";

export async function POST(_request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id, subtaskId } = await params;
  const [parent, no] = viewableTask(user, id);
  if (no) return no;
  const child = getTask(subtaskId);
  if (!child || child.originParentTaskId !== id) return err(404, "Subtask not found.");
  if (!canReviewTask(user, parent) || !canReviewTask(user, child))
    return err(403, "Only the responsible manager can promote this subtask.");
  try {
    return Response.json({ task: promoteSubtask(id, subtaskId, user.id) });
  } catch (error) { return err(error.status || 500, error.status ? error.message : "The subtask could not be promoted."); }
}
