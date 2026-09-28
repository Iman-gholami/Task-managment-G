import { requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { addComment, getTask, getTaskDetails } from "@/lib/server/repo";

export async function POST(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  if (!getTask(id)) return err(404, "Task not found.");
  const body = String((await request.json().catch(() => ({}))).body ?? "").trim();
  if (!body) return err(400, "Comment can't be empty.");
  addComment(id, user.id, body.slice(0, 5000));
  return Response.json({ comments: getTaskDetails(id).comments }, { status: 201 });
}
