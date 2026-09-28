import { redirect } from "next/navigation";
import AppProvider from "@/components/AppProvider";
import AppShell from "@/components/shell/AppShell";
import { getCurrentUser } from "@/lib/server/auth";
import { getShiftLog, listAllTickets, listTasks, listUsers, shiftStatusToday } from "@/lib/server/repo";

export default async function AppLayout({ children }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const shift = getShiftLog(me.id);
  const initial = { me, users: listUsers(), tasks: listTasks(), shift, allTickets: listAllTickets(), shiftStatus: shiftStatusToday() };
  return (
    <AppProvider initial={initial}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
