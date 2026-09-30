import { redirect } from "next/navigation";
import ShiftSchedule from "@/components/screens/ShiftSchedule";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";
import { isShiftAnalyst } from "@/lib/server/stats";

export const metadata = { title: "Shift Schedule" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!user || (!isManager(user) && !isShiftAnalyst(user))) redirect("/dashboard");
  return <ShiftSchedule />;
}
