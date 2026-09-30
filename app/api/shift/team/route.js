import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { listShiftLogs, listShiftSchedules, today } from "@/lib/server/repo";

/** Managers: today's scheduled SOC shifts, enriched with shift-log progress when started. */
export async function GET() {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Team shift logs are available to managers.");
  const d = today();
  const schedules = listShiftSchedules(d, d);
  const rows = schedules.map((s) => {
    const log = listShiftLogs(s.userId, d, d)[0];
    return log ? { id: s.userId, shiftType: s.shiftType, started: true, ...log } : { id: s.userId, shiftType: s.shiftType, started: false };
  });
  return Response.json({ date: d, rows });
}
