import { requireUser } from "@/lib/server/auth";
import { listVisibleTasks } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { canAssignTask, isManager } from "@/lib/roles";
import { addAttachment, addEvent, createTask, getUser } from "@/lib/server/repo";
import { removeUpload, saveUpload } from "@/lib/server/uploads";
import { MAX_UPLOAD, MAX_TASK_FILES, MAX_TASK_UPLOAD_TOTAL } from "@/lib/task-upload";

const PRIOS = ["low", "normal", "high", "critical"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  return Response.json({ tasks: listVisibleTasks(user) });
}

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  let body, files = [];
  if ((request.headers.get("content-type") || "").startsWith("multipart/form-data")) {
    try {
      const form = await request.formData();
      body = JSON.parse(String(form.get("task") ?? "{}"));
      files = form.getAll("files");
    } catch { return Response.json({ error: "Could not read the task and its files." }, { status: 400 }); }
  } else body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json({ error: "Invalid task details." }, { status: 400 });
  if (files.length > MAX_TASK_FILES)
    return Response.json({ error: `Attach at most ${MAX_TASK_FILES} files when creating a task.` }, { status: 400 });
  if (files.some((file) => typeof file === "string" || !file.size))
    return Response.json({ error: "Every attachment must be a non-empty file." }, { status: 400 });
  if (files.some((file) => file.size > MAX_UPLOAD) || files.reduce((sum, file) => sum + file.size, 0) > MAX_TASK_UPLOAD_TOTAL)
    return Response.json({ error: "Files must be at most 20 MB each and 40 MB in total." }, { status: 413 });
  const title = String(body.title ?? "").trim();
  if (!title) return Response.json({ error: "Title is required." }, { status: 400 });
  const assignee = getUser(body.a);
  if (!assignee || !assignee.active) return Response.json({ error: "Assignee not found." }, { status: 400 });
  if (!canAssignTask(user, assignee)) return Response.json({ error: "You can't assign a task to this member." }, { status: 403 });

  if (body.reviewRequired === false && !isManager(user))
    return Response.json({ error: "Only managers can create tasks without review." }, { status: 403 });
  const start = DATE.test(body.start ?? "") ? body.start : null;
  const prepared = [];
  try {
    for (const file of files) {
      const stored = await saveUpload(file);
      const name = String(file.name || "file").replace(/[\\/\r\n"]/g, "_").slice(0, 200);
      prepared.push({ path: stored, name, size: file.size, mime: file.type || "application/octet-stream" });
    }
    db.exec("BEGIN IMMEDIATE");
    let task;
    try {
      task = createTask({
        title, description: String(body.description ?? ""), a: assignee.id,
        prio: PRIOS.includes(body.prio) ? body.prio : "normal",
        cx: [1, 2, 3, 4].includes(body.cx) ? body.cx : 2,
        reviewRequired: body.reviewRequired !== false,
        due: DATE.test(body.due ?? "") ? body.due : "—",
      }, user.id);
      if (start) db.prepare("UPDATE tasks SET started_at = ? WHERE id = ?").run(`${start} 00:00:00`, task.id);
      addEvent(task.id, user.id, "created the task");
      for (const file of prepared) {
        addAttachment({ taskId: task.id, userId: user.id, ...file });
        addEvent(task.id, user.id, `attached ${file.name}`);
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    for (const file of prepared) { try { removeUpload(file.path); } catch {} }
    return Response.json({ error: "The task could not be created. Check the files and try again." }, { status: 500 });
  }
}
