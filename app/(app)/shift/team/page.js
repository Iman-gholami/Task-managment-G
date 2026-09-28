import { redirect } from "next/navigation";
import { ShiftTeam } from "@/components/screens/ShiftLog";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";

export const metadata = { title: "Team Shift Logs" };

export default async function Page() {
  if (!isManager(await getCurrentUser())) redirect("/shift");
  return <ShiftTeam />;
}
