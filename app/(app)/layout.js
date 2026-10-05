import { redirect } from "next/navigation";
import AppProvider from "@/components/AppProvider";
import AppShell from "@/components/shell/AppShell";
import { getCurrentUser } from "@/lib/server/auth";
import { getShiftLog, listTasks, listUsers, shiftStatusToday, today } from "@/lib/server/repo";
import { dashboardStats, isShiftAnalyst } from "@/lib/server/stats";
import { canAccessTask } from "@/lib/roles";

const emptyShift = () => ({ date: today(), activities: [], tickets: [], completedAt: null });

export default async function AppLayout({ children }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const keepsShiftLog = isShiftAnalyst(me);
  const tasks = listTasks().filter((task) => canAccessTask(me, task));
  const initial = {
    me: { ...me, keepsShiftLog },
    users: listUsers(),
    tasks,
    shift: keepsShiftLog ? (getShiftLog(me.id) ?? emptyShift()) : emptyShift(),
    shiftStatus: shiftStatusToday(),
    stats: dashboardStats(me),
  };
  return (
    <AppProvider initial={initial}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
