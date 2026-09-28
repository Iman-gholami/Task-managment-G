import { requireUser } from "@/lib/server/auth";
import { editableTask, err } from "@/lib/server/access";
import { addAttachment, addEvent, getTaskDetails } from "@/lib/server/repo";
import { MAX_UPLOAD, saveUpload } from "@/lib/server/uploads";

export async function POST(request, { params }) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const { id } = await params;
  const [, no] = editableTask(user, id);
  if (no) return no;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string" || !file.size) return err(400, "Choose a file to upload.");
  if (file.size > MAX_UPLOAD) return err(413, "Files must be 20 MB or smaller.");
  const stored = await saveUpload(file);
  const name = String(file.name || "file").replace(/[\\/\r\n"]/g, "_").slice(0, 200);
  addAttachment({ taskId: id, userId: user.id, name, size: file.size, mime: file.type || "application/octet-stream", path: stored });
  addEvent(id, user.id, `attached ${name}`);
  return Response.json({ attachments: getTaskDetails(id).attachments }, { status: 201 });
}
