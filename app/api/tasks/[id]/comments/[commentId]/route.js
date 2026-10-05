import { requireUser } from "@/lib/server/auth";
import { err, viewableTask } from "@/lib/server/access";
import { deleteComment, editComment, getComment, getTaskDetails } from "@/lib/server/repo";

async function own(params) {
  const [user, denied] = await requireUser();
  if (denied) return [null, denied];
  const { id, commentId } = await params;
  const [, no] = viewableTask(user, id);
  if (no) return [null, no];
  const c = getComment(Number(commentId));
  if (!c || c.task_id !== id) return [null, err(404, "Comment not found.")];
  if (c.user_id !== user.id) return [null, err(403, "You can only change your own comments.")];
  return [{ id, c }, null];
}

export async function PATCH(request, { params }) {
  const [ctx, no] = await own(params);
  if (no) return no;
  const body = String((await request.json().catch(() => ({}))).body ?? "").trim();
  if (!body) return err(400, "Comment can't be empty.");
  editComment(ctx.c.id, body.slice(0, 5000));
  return Response.json({ comments: getTaskDetails(ctx.id).comments });
}

export async function DELETE(request, { params }) {
  const [ctx, no] = await own(params);
  if (no) return no;
  deleteComment(ctx.c.id);
  return Response.json({ comments: getTaskDetails(ctx.id).comments });
}
