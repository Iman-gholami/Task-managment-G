import { requireUser } from "@/lib/server/auth";
import { editableTask, err, viewableTask } from "@/lib/server/access";
import { deleteAttachment, getAttachment, getTaskDetails } from "@/lib/server/repo";
import { readUpload, removeUpload } from "@/lib/server/uploads";

export async function GET(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id, attachmentId } = await params;
  const [, no] = viewableTask(user, id);
  if (no) return no;
  const a = getAttachment(Number(attachmentId));
  if (!a || a.task_id !== id) return err(404, "File not found.");
  let data;
  try {
    data = readUpload(a.path);
  } catch {
    return err(404, "File is missing on the server.");
  }
  return new Response(data, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id, attachmentId } = await params;
  const [, no] = editableTask(user, id);
  if (no) return no;
  const a = getAttachment(Number(attachmentId));
  if (!a || a.task_id !== id) return err(404, "File not found.");
  deleteAttachment(a.id);
  removeUpload(a.path);
  return Response.json({ attachments: getTaskDetails(id).attachments });
}
