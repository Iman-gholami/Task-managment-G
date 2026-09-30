import { redirect } from "next/navigation";
import ShiftChanges from "@/components/screens/ShiftChanges";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";
import { isShiftAnalyst } from "@/lib/server/stats";

export const metadata = { title: "Shift Changes" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!user || (!isManager(user) && !isShiftAnalyst(user))) redirect("/dashboard");
  return <ShiftChanges />;
}
