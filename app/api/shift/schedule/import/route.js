import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { listUsers } from "@/lib/server/repo";
import { isShiftEligible } from "@/lib/roles";
import { readShiftExcelFiles, normalizeExcelName } from "@/lib/server/shift-excel";
import { importShiftDays, previewShiftImportConflicts, ShiftImportConflictError } from "@/lib/server/shift-batch";
import { isIsoDate, ROSTER_KEYS } from "@/lib/shifts";

function validateDays(days) {
  if (!Array.isArray(days) || !days.length || days.length > 370) return "Invalid import day count.";
  const valid = new Set(ROSTER_KEYS);
  const checked = new Set();
  for (const day of days) {
    if (!isIsoDate(day?.date) || checked.has(day.date)) return "Invalid or duplicated date.";
    checked.add(day.date);
    if (!day.assignments || typeof day.assignments !== "object" ||
      Object.keys(day.assignments).some((k) => !valid.has(k)) ||
      ROSTER_KEYS.some((k) => !Array.isArray(day.assignments[k]) || day.assignments[k].length > 150)) {
      return "Invalid roster assignments.";
    }
    const ids = ROSTER_KEYS.flatMap((k) => day.assignments[k]);
    if (ids.some((id) => typeof id !== "string" || !id.trim() || id.length > 128) || new Set(ids).size !== ids.length)
      return "A person cannot be assigned more than once on a date.";
    if (day.holidayNote != null && (typeof day.holidayNote !== "string" || day.holidayNote.length > 240))
      return "Invalid center holiday note.";
  }
  return null;
}

/** Read-only conflict check for the exact user-mapped Excel preview. */
export async function PATCH(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only managers can import rosters.");
  const body = await request.json().catch(() => ({}));
  const validationError = validateDays(body.days);
  if (validationError) return err(400, validationError);
  try {
    return Response.json({ conflicts: previewShiftImportConflicts(body.days) });
  } catch (error) {
    return err(400, error.message);
  }
}

export async function POST(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only managers can import rosters.");
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((file) => typeof file?.arrayBuffer === "function");
    const preview = await readShiftExcelFiles(files);
    const people = listUsers().filter(isShiftEligible).map((p) => ({ id: p.id, name: p.name, team: p.team }));
    const names = [...new Set(preview.days.flatMap((d) => d.entries.map((e) => e.name)))].sort((a, b) => a.localeCompare(b, "fa"));
    const match = names.map((name) => {
      const n = normalizeExcelName(name);
      const candidates = people.filter((p) => {
        const full = normalizeExcelName(p.name);
        return full === n || full.split(" ").at(-1) === n;
      });
      return { name, suggestedId: candidates.length === 1 ? candidates[0].id : "" };
    });
    return Response.json({ ...preview, people, match });
  } catch (error) {
    return err(400, error.message);
  }
}

export async function PUT(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Only managers can import rosters.");
  const body = await request.json().catch(() => ({}));
  const validationError = validateDays(body.days);
  if (validationError) return err(400, validationError);
  try {
    const result = importShiftDays(body.days, user.id);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ShiftImportConflictError) {
      return Response.json({
        error: "Import was not saved: " + error.message,
        conflicts: error.conflicts,
      }, { status: 409 });
    }
    return err(409, "Import was not saved: " + error.message);
  }
}
