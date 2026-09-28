import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { listShiftLogs, listUsers, today } from "@/lib/server/repo";
import { isShiftAnalyst } from "@/lib/server/stats";

/** Managers: today's shift log summary for every active SOC analyst (only those who started one). */
export async function GET() {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  if (!isManager(user)) return err(403, "Team shift logs are available to managers.");
  const d = today();
  const rows = listUsers().filter((u) => u.active && isShiftAnalyst(u)).flatMap((u) => listShiftLogs(u.id, d, d).map((l) => ({ id: u.id, ...l })));
  return Response.json({ date: d, rows });
}
