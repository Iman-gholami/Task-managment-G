import { redirect } from "next/navigation";
import ShiftLog from "@/components/screens/ShiftLog";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";
import { isShiftAnalyst } from "@/lib/server/stats";

export const metadata = { title: "Shift Log" };

// Shift logs are kept by SOC analysts only; managers see the team overview instead.
export default async function Page() {
  const me = await getCurrentUser();
  if (!isShiftAnalyst(me)) redirect(isManager(me) ? "/shift/team" : "/dashboard");
  return <ShiftLog />;
}
