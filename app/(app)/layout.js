import { redirect } from "next/navigation";
import AppProvider from "@/components/AppProvider";
import AppShell from "@/components/shell/AppShell";
import { getCurrentUser } from "@/lib/server/auth";
import { getShiftLog, listTasks, listUsers, shiftStatusToday } from "@/lib/server/repo";
import { dashboardStats, isShiftAnalyst } from "@/lib/server/stats";

const EMPTY_SHIFT = { date: null, activities: [], tickets: [], completedAt: null };

export default async function AppLayout({ children }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const keepsShiftLog = isShiftAnalyst(me);
  const initial = {
    me: { ...me, keepsShiftLog },
    users: listUsers(),
    tasks: listTasks(),
    shift: keepsShiftLog ? getShiftLog(me.id) : EMPTY_SHIFT,
    shiftStatus: shiftStatusToday(),
    stats: dashboardStats(me),
  };
  return (
    <AppProvider initial={initial}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
