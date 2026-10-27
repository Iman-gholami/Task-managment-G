import { isManager, requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { getUser, listDayStatuses, listShiftLogs } from "@/lib/server/repo";
import { listEnabledBackfillDates } from "@/lib/server/shift-backfill";
import { isShiftAnalyst, resolvePeriod } from "@/lib/server/stats";

export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const url = new URL(request.url);
  const target = url.searchParams.get("user") || user.id;
  if (target !== user.id && !isManager(user)) return err(403, "You can only view your own shift logs.");
  const owner = getUser(target);
  if (!owner || !isShiftAnalyst(owner)) return err(404, "Shift logs are kept by SOC analysts only.");
  const period = resolvePeriod(Object.fromEntries(url.searchParams));
  const logs = listShiftLogs(target, period.from, period.to);
  const absences = listDayStatuses(period.from, period.to)
    .filter((row) => row.userId === target)
    .map((row) => ({
      date: row.date, shiftType: row.shiftType, absence: true,
      completed: false, done: 0, total: 0, iocs: 0, tickets: 0,
      issues: 0, report: false, checklist: null, checklistVersion: null,
    }));
  const eligible = listEnabledBackfillDates(target, period.from, period.to);
  const eligibleDates = new Set(eligible.map((item) => item.date));
  const existing = new Set(logs.map((item) => item.date));
  const historical = eligible.filter((item) => !existing.has(item.date)).map((item) => ({
    date: item.date, shiftType: item.shiftType, completed: false,
    done: 0, total: 0, iocs: 0, tickets: 0, analyzedTickets: 0,
    issues: 0, report: false, checklist: null, checklistVersion: null,
    backfill: true,
  }));
  return Response.json({
    period, logs: [...logs.map((item) => ({ ...item, backfill: eligibleDates.has(item.date) })),
      ...absences, ...historical].sort((a, b) => b.date.localeCompare(a.date)),
  });
}
